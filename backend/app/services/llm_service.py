import json
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.llm_config import LLMConfig


class LLMService:
    """LLM服务，负责调用OpenAI格式的API"""

    SYSTEM_PROMPT = """你是一个智能画布绘图助手。用户会通过语音告诉你要画什么，你需要将用户的指令转换为JSON格式的绘图命令。

支持的命令格式：

1. 创建图形 (create):
{
  "action": "create",
  "type": "circle|rect|line|text|triangle|star|house|animal|tree|person",
  "id": "obj_xxx",
  "params": {
    "x": 数字,
    "y": 数字,
    其他参数...
  }
}

2. 修改图形 (modify):
{
  "action": "modify",
  "target": "obj_xxx",
  "params": {
    "fill": "颜色",
    "stroke": "颜色",
    "x": 数字,
    "y": 数字,
    ...
  }
}

3. 移动图形 (move):
{
  "action": "move",
  "target": "obj_xxx",
  "params": {
    "x": 数字,
    "y": 数字
  }
}

4. 删除图形 (delete):
{
  "action": "delete",
  "target": "obj_xxx"
}

5. 清空画布 (clear):
{
  "action": "clear"
}

6. 撤销 (undo):
{
  "action": "undo"
}

图形类型参数说明：
- circle: {x, y, radius, fill, stroke, strokeWidth}
- rect: {x, y, width, height, fill, stroke, strokeWidth}
- line: {points: [x1, y1, x2, y2], stroke, strokeWidth}
- text: {x, y, text, fontSize, fill}
- star: {x, y, numPoints, innerRadius, outerRadius, fill, stroke}
- triangle: {x, y, width, height, fill, stroke}
- house: 组合图形，用Group包含rect+triangle
- animal: 简化的动物形状，用多个circle/rect组合
- tree: 树形，用rect(树干)+circle(树冠)组合
- person: 简化的人形，用circle(头)+rect(身体)+line(四肢)

画布默认大小: 800x600
坐标系: 左上角为(0,0)，右下角为(800,600)
默认颜色: fill="#cccccc", stroke="#000000"

你必须返回严格的JSON格式：
{
  "commands": [命令数组],
  "response": "对用户的自然语言回复"
}

示例：
用户："画一个红色的圆"
你的回复：
{
  "commands": [
    {
      "action": "create",
      "type": "circle",
      "id": "obj_1",
      "params": {
        "x": 400,
        "y": 300,
        "radius": 50,
        "fill": "red",
        "stroke": "black",
        "strokeWidth": 2
      }
    }
  ],
  "response": "好的，我在画布中心画了一个红色的圆形。"
}

用户："把它移到左边"
你的回复：
{
  "commands": [
    {
      "action": "move",
      "target": "obj_1",
      "params": {
        "x": 200,
        "y": 300
      }
    }
  ],
  "response": "已将圆形移到左边。"
}

用户："画一个房子"
你的回复：
{
  "commands": [
    {
      "action": "create",
      "type": "group",
      "id": "obj_2",
      "children": [
        {
          "type": "rect",
          "params": {
            "x": 300,
            "y": 350,
            "width": 200,
            "height": 150,
            "fill": "#8B4513",
            "stroke": "black",
            "strokeWidth": 2
          }
        },
        {
          "type": "polygon",
          "params": {
            "points": [300, 350, 400, 250, 500, 350],
            "fill": "red",
            "stroke": "black",
            "strokeWidth": 2,
            "closed": true
          }
        },
        {
          "type": "rect",
          "params": {
            "x": 370,
            "y": 420,
            "width": 60,
            "height": 80,
            "fill": "#654321",
            "stroke": "black",
            "strokeWidth": 2
          }
        }
      ]
    }
  ],
  "response": "好的，我画了一个房子，包括墙壁、屋顶和门。"
}

注意：
1. 必须返回有效的JSON格式
2. 为新创建的对象生成唯一的id（obj_1, obj_2, ...）
3. 移动、修改、删除操作需要引用已存在的对象id
4. 位置和大小要合理，在画布范围内
5. 复杂图形（房子、动物等）使用group组合多个基本图形
"""

    def __init__(self, db: Optional[AsyncSession]):
        self.db = db

    async def get_active_config(self, user_id: int) -> Optional[LLMConfig]:
        """获取用户的激活LLM配置"""
        if not self.db:
            return None

        result = await self.db.execute(
            select(LLMConfig).where(
                LLMConfig.user_id == user_id,
                LLMConfig.is_active == True
            )
        )
        return result.scalar_one_or_none()

    async def get_config_by_id(self, config_id: int) -> Optional[LLMConfig]:
        """根据ID获取LLM配置"""
        if not self.db:
            return None

        result = await self.db.execute(
            select(LLMConfig).where(LLMConfig.id == config_id)
        )
        return result.scalar_one_or_none()

    async def process_command(
        self,
        user_id: int,
        text: str,
        llm_config_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """处理用户语音命令，调用LLM生成绘图指令"""

        # 获取LLM配置
        if llm_config_id:
            config = await self.get_config_by_id(llm_config_id)
        else:
            config = await self.get_active_config(user_id)

        if not config:
            raise Exception("No active LLM configuration found")

        # 调用OpenAI API
        client = AsyncOpenAI(
            api_key=config.api_key,
            base_url=config.base_url
        )

        try:
            response = await client.chat.completions.create(
                model=config.model_name,
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": text}
                ],
                temperature=0.7,
                max_tokens=2000
            )

            content = response.choices[0].message.content

            # 解析JSON响应
            try:
                result = json.loads(content)
                return {
                    "commands": result.get("commands", []),
                    "response": result.get("response", "已执行命令")
                }
            except json.JSONDecodeError:
                # 如果返回的不是标准JSON，尝试提取
                return {
                    "commands": [],
                    "response": content
                }

        except Exception as e:
            raise Exception(f"LLM API call failed: {str(e)}")

    async def test_connection(
        self,
        base_url: str,
        api_key: str,
        model_name: str
    ) -> bool:
        """测试LLM连接"""
        try:
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url
            )

            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "user", "content": "Hello"}
                ],
                max_tokens=10
            )

            return bool(response.choices[0].message.content)
        except Exception:
            return False
