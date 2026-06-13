import json
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.llm_config import LLMConfig


class LLMService:
    """LLM服务，负责调用OpenAI格式的API"""

    VALID_INTENTS = {"draw", "edit", "control", "delete", "clarify", "ignore"}

    SYSTEM_PROMPT = """你是语音绘画系统的意图门控和绘图命令生成器。

你的第一任务是判断用户语音是否应该影响当前画布。不是所有语音都应该响应。

意图类型：
- draw: 明确要求创建新内容，例如“画一个红色圆”“加一棵树”
- edit: 明确要求修改、移动、缩放、改色已有内容，例如“把它变大”“把房子移到左边”
- delete: 明确要求删除某个对象
- control: 明确要求控制画布，例如“撤销”“清空画布”“重做”
- clarify: 看起来有绘画意图，但缺少关键对象、位置、颜色或动作，需要追问
- ignore: 背景噪声、闲聊、对他人说话、残缺语句、犹豫词、ASR误识别、与当前画布无关的内容、只是讨论画图但没有要求当前执行

重要原则：
1. 宁可忽略不确定内容，也不要错误修改画布。
2. 只有明确要求创建、修改、删除、移动、清空、撤销、重做当前画布时，才生成 commands。
3. 如果用户只是说“等一下”“你听到了吗”“今天吃什么”“他说让我画一个圆，不是现在”，返回 ignore。
4. 如果用户说“把它弄大一点”“换个颜色”“移动到旁边”，但没有足够上下文确定对象，返回 clarify。
5. ignore 时 response 必须是空字符串，commands 必须是空数组。
6. clarify 时 commands 必须是空数组，response 用一句简短中文追问。

支持的绘图命令：

创建图形：
{
  "action": "create",
  "type": "circle|rect|line|text|star|group|polygon",
  "id": "obj_xxx",
  "params": {
    "x": 数字,
    "y": 数字
  }
}

修改图形：
{
  "action": "modify",
  "target": "obj_xxx",
  "params": {
    "fill": "颜色",
    "stroke": "颜色",
    "x": 数字,
    "y": 数字
  }
}

移动图形：
{
  "action": "move",
  "target": "obj_xxx",
  "params": {
    "x": 数字,
    "y": 数字
  }
}

删除、清空、撤销、重做：
{"action": "delete", "target": "obj_xxx"}
{"action": "clear"}
{"action": "undo"}
{"action": "redo"}

图形参数：
- circle: {x, y, radius, fill, stroke, strokeWidth}
- rect: {x, y, width, height, fill, stroke, strokeWidth}
- line: {points: [x1, y1, x2, y2], stroke, strokeWidth}
- text: {x, y, text, fontSize, fill}
- star: {x, y, numPoints, innerRadius, outerRadius, fill, stroke}
- polygon: {points: [x1, y1, x2, y2, x3, y3], fill, stroke, strokeWidth, closed}
- group: 组合图形，children 中放多个基础图形

画布大小: 800x600。坐标系左上角为(0,0)，右下角为(800,600)。

你必须只返回严格 JSON，不要返回 Markdown，不要包裹代码块：
{
  "intent": "draw|edit|control|delete|clarify|ignore",
  "confidence": 0.0到1.0之间的数字,
  "commands": [],
  "response": "给用户的简短中文回复；ignore 时为空字符串",
  "reason": "简短说明你的判断原因"
}

示例：
用户：“画一个红色的圆”
{
  "intent": "draw",
  "confidence": 0.95,
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
  "response": "好的，我画了一个红色圆形。",
  "reason": "明确的绘图创建请求"
}

用户：“今天晚上吃什么”
{
  "intent": "ignore",
  "confidence": 0.98,
  "commands": [],
  "response": "",
  "reason": "闲聊内容，与当前画布无关"
}

用户：“换个颜色”
{
  "intent": "clarify",
  "confidence": 0.62,
  "commands": [],
  "response": "你想修改哪个图形的颜色？",
  "reason": "有编辑意图但目标对象不明确"
}
"""

    def __init__(self, db: Optional[AsyncSession]):
        self.db = db

    def _extract_json(self, content: str) -> Dict[str, Any]:
        """Parse strict JSON, with a small fallback for models that add prose."""
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise
            return json.loads(content[start:end + 1])

    def _normalize_llm_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        intent = str(result.get("intent", "clarify")).strip().lower()
        if intent not in self.VALID_INTENTS:
            intent = "clarify"

        try:
            confidence = float(result.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
        confidence = max(0.0, min(1.0, confidence))

        commands = result.get("commands", [])
        if not isinstance(commands, list):
            commands = []

        response = result.get("response", "")
        if not isinstance(response, str):
            response = str(response) if response is not None else ""

        reason = result.get("reason")
        if reason is not None and not isinstance(reason, str):
            reason = str(reason)

        if intent == "ignore" or (confidence < 0.45 and not commands):
            return {
                "intent": "ignore",
                "confidence": confidence,
                "commands": [],
                "response": "",
                "reason": reason or "低置信度或非绘画相关内容"
            }

        if intent == "clarify":
            commands = []
            if not response:
                response = "请再具体说明一下你想怎么修改画布。"

        return {
            "intent": intent,
            "confidence": confidence,
            "commands": commands,
            "response": response,
            "reason": reason
        }

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

            # 解析并规范化JSON响应
            try:
                result = self._extract_json(content or "")
                return self._normalize_llm_result(result)
            except json.JSONDecodeError:
                # 无法解析时默认追问，避免误操作画布
                return {
                    "intent": "clarify",
                    "confidence": 0.0,
                    "commands": [],
                    "response": "我没能可靠理解这句话，请再说一次绘画指令。",
                    "reason": "LLM返回内容不是有效JSON"
                }

        except Exception as e:
            raise Exception(f"LLM API call failed: {str(e)}")

    async def test_connection(
        self,
        base_url: str,
        api_key: str,
        model_name: str
    ) -> tuple[bool, str]:
        """测试LLM连接"""
        try:
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url
            )

            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "user", "content": "Reply with exactly: OK"}
                ],
                temperature=0,
                max_tokens=50
            )

            content = response.choices[0].message.content or ""
            if content.strip():
                return True, "Connection successful"

            finish_reason = response.choices[0].finish_reason
            return False, f"Connection returned empty content (finish_reason={finish_reason})"
        except Exception as e:
            return False, f"{type(e).__name__}: {str(e)}"
