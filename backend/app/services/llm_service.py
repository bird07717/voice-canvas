import json
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.drawing.executor import DrawingExecutor
from app.drawing.tool_parser import ToolParseError, parse_drawing_plan
from app.models.llm_config import LLMConfig
from app.scene.executor import SceneExecutor
from app.scene.intent import is_scene_request
from app.scene.patch import ScenePatchPlanner, ScenePatchPlanningError
from app.scene.patch_executor import ScenePatchExecutor
from app.scene.planner import ScenePlanner, ScenePlanningError
from app.scene.templates import build_template_scene_plan


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

    TOOL_PLANNING_PROMPT = """你是语音绘画系统的工具调用规划器。

用户会用自然中文口语表达绘画需求。你的任务不是直接生成底层Canvas图形，而是选择合适的高层工具调用。

你必须只返回严格JSON，不要Markdown，不要代码块：
{
  "calls": [
    {
      "tool": "create_object|edit_object|delete_object|control_canvas|ask_clarification|ignore_input",
      "confidence": 0.0到1.0,
      "arguments": {}
    }
  ],
  "response": "给用户的简短中文回复",
  "reasoning": "简短说明判断原因"
}

工具说明：
1. create_object: 创建对象
arguments:
{
  "kind": "对象语义，如 circle/sun/tree/house/cloud/flower/person/car/mountain/grass/road/river/dragon",
  "render_strategy": "basic|template|svg",
  "position": {"anchor": "center|top|bottom|left|right|top_left|top_right|bottom_left|bottom_right|near_target|custom", "x": 数字, "y": 数字},
  "size": {"preset": "tiny|small|medium|large|huge"},
  "style": {"fill": "颜色", "stroke": "颜色", "text": "文字"},
  "description": "未知对象或复杂图形的详细视觉描述"
}

2. edit_object: 修改对象
arguments:
{
  "target": {"ref": "last|selected|kind|id", "kind": "对象类型", "label": "对象中文名", "spatial": "left|right|top|bottom|center|largest"},
  "operation": "move|resize|recolor|rotate|restyle",
  "changes": {"fill": "颜色", "x": 数字, "y": 数字, "dx": 数字, "dy": 数字, "scale": 数字, "scale_delta": 数字, "rotation": 数字}
}

3. delete_object: 删除对象
arguments: {"target": {"ref": "last|selected|kind|id", "kind": "对象类型", "label": "对象中文名", "spatial": "left|right|top|bottom|center|largest"}}

4. control_canvas: 画布控制
arguments: {"action": "undo|redo|clear|save|export"}

5. ask_clarification: 缺少关键信息时追问
arguments: {"question": "追问内容", "missing": ["缺少的信息"]}

6. ignore_input: 背景噪声、闲聊、和绘画无关
arguments: {"reason": "忽略原因"}

策略：
- 常见对象使用 template：sun/tree/cloud/house/flower/person/car/mountain/grass/road/river。
- 基础图形使用 basic：circle/rectangle/square/line/text/star/polygon。
- 模板库没有的对象使用 svg，例如恐龙、飞船、猫头鹰、小提琴。
- 只要用户有明确绘画对象、颜色、位置或编辑动作，就尽量调用工具，不要轻易 ignore。
- 只有完全无关的话才 ignore。
- “它”“刚才那个”“这个”默认 target.ref = "last"。
- 不要猜对象 id；除非用户明确指向当前/刚才/选中对象，否则优先用 target.ref="kind" 并填写 kind、label、spatial，让系统的语义 Resolver 绑定真实对象。
- “左边的树”“右边那个云”“最大的气球”应使用 target.spatial 表达位置或大小。
- “往左/右/上/下移动一点”使用 edit_object，operation="move"，changes 使用 dx/dy，例如左移一点 dx=-40。
- “变大/放大/小一点”使用 edit_object，operation="resize"，changes 使用 scale_delta，例如变大一点 scale_delta=1.2。
- “清空”“撤销”“重做”使用 control_canvas。

示例：
用户：“在右上角画一个黄色太阳”
{
  "calls": [
    {
      "tool": "create_object",
      "confidence": 0.95,
      "arguments": {
        "kind": "sun",
        "render_strategy": "template",
        "position": {"anchor": "top_right"},
        "size": {"preset": "medium"},
        "style": {"fill": "yellow"}
      }
    }
  ],
  "response": "好的，我在右上角画了一个太阳。",
  "reasoning": "明确的模板对象创建请求"
}

用户：“把它变成蓝色”
{
  "calls": [
    {
      "tool": "edit_object",
      "confidence": 0.82,
      "arguments": {
        "target": {"ref": "last"},
        "changes": {"fill": "blue"}
      }
    }
  ],
  "response": "好的，我把刚才的对象改成蓝色。",
  "reasoning": "编辑最近对象"
}

用户：“今天晚上吃什么”
{
  "calls": [
    {
      "tool": "ignore_input",
      "confidence": 0.98,
      "arguments": {"reason": "闲聊内容，与绘画无关"}
    }
  ],
  "response": "",
  "reasoning": "非绘画语音"
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
                "reason": reason or "低置信度或非绘画相关内容",
                "needs_disambiguation": bool(result.get("needs_disambiguation")),
                "disambiguation": result.get("disambiguation"),
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
            "reason": reason,
            "needs_disambiguation": bool(result.get("needs_disambiguation")),
            "disambiguation": result.get("disambiguation"),
        }

    def _format_canvas_context(self, canvas_context: Optional[Dict[str, Any]]) -> str:
        if not canvas_context:
            return "当前画布上下文：无。"

        objects = canvas_context.get("objects") or []
        object_lines = []
        for obj in objects[-20:]:
            object_lines.append(
                f"- id={obj.get('id')}, type={obj.get('type')}, kind={obj.get('kind')}, "
                f"text={obj.get('text')}, x={obj.get('x')}, y={obj.get('y')}"
            )

        recent_commands = canvas_context.get("recentCommands") or []
        recent_summary = json.dumps(recent_commands[-5:], ensure_ascii=False)

        return "\n".join([
            "当前画布上下文：",
            f"lastCreatedObjectId={canvas_context.get('lastCreatedObjectId')}",
            f"lastModifiedObjectId={canvas_context.get('lastModifiedObjectId')}",
            f"selectedObjectId={canvas_context.get('selectedObjectId')}",
            "objects:",
            *(object_lines or ["- 无对象"]),
            f"recentCommands={recent_summary}"
        ])

    def _execute_tool_plan(
        self,
        result: Dict[str, Any],
        canvas_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        plan = parse_drawing_plan(result)
        executed = DrawingExecutor(canvas_context).execute(plan)
        return self._normalize_llm_result(executed)

    def _has_scene_patch_hint(self, text: str, scene_title: str, scene_type: str) -> bool:
        normalized = "".join(str(text or "").split()).lower()
        title = "".join(scene_title.split()).lower()
        scene = str(scene_type or "").lower()

        if not normalized:
            return False

        command_prefixes = ("画一个", "画一幅", "画个", "生成一个", "生成一幅", "来一个", "创建一个")
        bare_scene_phrases = {
            title,
            f"一个{title}",
            f"一幅{title}",
            f"画一个{title}",
            f"画一幅{title}",
            f"画个{title}",
            f"生成一个{title}",
            f"生成一幅{title}",
            scene,
        }
        if normalized in bare_scene_phrases:
            return False

        patch_words = (
            "加",
            "添加",
            "放",
            "摆",
            "带",
            "有",
            "不要",
            "去掉",
            "删除",
            "移除",
            "改",
            "换",
            "变",
            "变成",
            "旁边",
            "左边",
            "右边",
            "上面",
            "下面",
            "文字",
            "写",
        )
        if any(word in normalized for word in patch_words):
            return True

        for prefix in command_prefixes:
            if normalized.startswith(prefix + title):
                return len(normalized) > len(prefix + title)
        return False

    async def _apply_scene_patch_if_needed(
        self,
        text: str,
        template_scene_plan: Any,
        commands: List[Dict[str, Any]],
        config: Optional[LLMConfig],
        canvas_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        scene_payload = {
            "scene_type": template_scene_plan.scene_type,
            "title": template_scene_plan.title,
            "style": template_scene_plan.style,
            "object_count": len(commands),
            "layout_notes": template_scene_plan.layout_notes,
            "source": "template",
        }

        if not self._has_scene_patch_hint(text, template_scene_plan.title, template_scene_plan.scene_type):
            return {
                "commands": commands,
                "response": template_scene_plan.response,
                "reason": "scene_template",
                "scene": scene_payload,
            }

        if not config:
            scene_payload["patch_status"] = "skipped_no_llm_config"
            return {
                "commands": commands,
                "response": template_scene_plan.response + " 额外描述需要配置 LLM 后才能继续细化。",
                "reason": "scene_template_patch_skipped_no_llm_config",
                "scene": scene_payload,
            }

        try:
            patch_plan = await ScenePatchPlanner().plan(
                text=text,
                scene_type=template_scene_plan.scene_type,
                title=template_scene_plan.title,
                template_commands=commands,
                llm_config=config,
            )
            patch_executor = ScenePatchExecutor(
                scene_type=template_scene_plan.scene_type,
                scene_title=template_scene_plan.title,
                template_commands=commands,
                canvas_context=canvas_context,
            )
            patch_commands = patch_executor.execute(patch_plan)
        except ScenePatchPlanningError as e:
            scene_payload["patch_status"] = "failed"
            return {
                "commands": commands,
                "response": template_scene_plan.response + e.message,
                "reason": e.reason,
                "scene": scene_payload,
            }
        except Exception as e:
            scene_payload["patch_status"] = "failed"
            return {
                "commands": commands,
                "response": template_scene_plan.response + " 额外描述暂时没有应用成功。",
                "reason": f"ScenePatch failed: {str(e)}",
                "scene": scene_payload,
            }

        if not patch_commands:
            scene_payload["patch_status"] = "empty"
            return {
                "commands": commands,
                "response": template_scene_plan.response,
                "reason": "scene_template_patch_empty",
                "scene": scene_payload,
            }

        needs_disambiguation = bool(patch_executor.needs_disambiguation and patch_executor.disambiguation)
        disambiguation = patch_executor.disambiguation if needs_disambiguation else None
        if disambiguation:
            disambiguation["commands"] = [
                command
                for command in patch_commands
                if command.get("target") == "__pending_target__"
            ]

        scene_payload.update(
            {
                "object_count": len(commands) + len(patch_commands),
                "patch_status": "applied",
                "patch_count": len(patch_commands),
            }
        )
        return {
            "commands": [*commands, *patch_commands],
            "response": patch_plan.response or f"好的，我在{template_scene_plan.title}模板上应用了额外描述。",
            "reason": "scene_template_patch",
            "scene": scene_payload,
            "needs_disambiguation": needs_disambiguation,
            "disambiguation": disambiguation,
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
        llm_config_id: Optional[int] = None,
        canvas_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """处理用户语音命令，调用LLM生成绘图指令"""

        template_scene_plan = build_template_scene_plan(text)
        if template_scene_plan:
            commands = SceneExecutor(canvas_context).execute(template_scene_plan)
            needs_patch = self._has_scene_patch_hint(
                text,
                template_scene_plan.title,
                template_scene_plan.scene_type,
            )
            config = None
            if needs_patch:
                if llm_config_id:
                    config = await self.get_config_by_id(llm_config_id)
                else:
                    config = await self.get_active_config(user_id)
            patched = await self._apply_scene_patch_if_needed(
                text=text,
                template_scene_plan=template_scene_plan,
                commands=commands,
                config=config,
                canvas_context=canvas_context,
            )
            return {
                "intent": "draw",
                "confidence": 1.0,
                "commands": patched["commands"],
                "response": patched["response"],
                "reason": patched["reason"],
                "scene": patched["scene"],
                "needs_disambiguation": bool(patched.get("needs_disambiguation")),
                "disambiguation": patched.get("disambiguation"),
            }

        # 获取LLM配置
        if llm_config_id:
            config = await self.get_config_by_id(llm_config_id)
        else:
            config = await self.get_active_config(user_id)

        if not config:
            raise Exception("No active LLM configuration found")

        if is_scene_request(text):
            try:
                scene_plan = await ScenePlanner().plan(text, canvas_context, config)
                commands = SceneExecutor(canvas_context).execute(scene_plan)
                return {
                    "intent": "draw",
                    "confidence": 0.9,
                    "commands": commands,
                    "response": scene_plan.response or f"好的，我规划了{scene_plan.title}场景。",
                    "reason": "scene_plan",
                    "scene": {
                        "scene_type": scene_plan.scene_type,
                        "title": scene_plan.title,
                        "style": scene_plan.style,
                        "object_count": len(commands),
                        "layout_notes": scene_plan.layout_notes,
                    },
                }
            except ScenePlanningError as e:
                return {
                    "intent": "clarify",
                    "confidence": 0.0,
                    "commands": [],
                    "response": e.message,
                    "reason": e.reason,
                }
            except Exception as e:
                return {
                    "intent": "clarify",
                    "confidence": 0.0,
                    "commands": [],
                    "response": "我暂时没能完成场景规划，请再说一次或换个简单场景。",
                    "reason": f"Scene Planner failed: {str(e)}",
                }

        # 调用OpenAI API
        client = AsyncOpenAI(
            api_key=config.api_key,
            base_url=config.base_url
        )

        try:
            response = await client.chat.completions.create(
                model=config.model_name,
                messages=[
                    {"role": "system", "content": self.TOOL_PLANNING_PROMPT},
                    {"role": "system", "content": self._format_canvas_context(canvas_context)},
                    {"role": "user", "content": text}
                ],
                temperature=0.7,
                max_tokens=2000
            )

            content = response.choices[0].message.content

            # 解析并规范化JSON响应
            try:
                result = self._extract_json(content or "")
                if "calls" in result:
                    return self._execute_tool_plan(result, canvas_context)
                return self._normalize_llm_result(result)
            except (json.JSONDecodeError, ToolParseError):
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
