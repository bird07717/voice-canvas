import json
from typing import Any, Dict, List, Type

from pydantic import BaseModel, ValidationError

from app.drawing.schemas import (
    AskClarificationArgs,
    ControlCanvasArgs,
    CreateObjectArgs,
    DeleteObjectArgs,
    DrawingPlan,
    DrawingToolCall,
    EditObjectArgs,
    IgnoreInputArgs,
    ToolName
)


TOOL_ARGUMENT_MODELS: Dict[str, Type[BaseModel]] = {
    "create_object": CreateObjectArgs,
    "edit_object": EditObjectArgs,
    "delete_object": DeleteObjectArgs,
    "control_canvas": ControlCanvasArgs,
    "ask_clarification": AskClarificationArgs,
    "ignore_input": IgnoreInputArgs,
}


class ToolParseError(ValueError):
    pass


def parse_tool_arguments(tool_name: str, raw_arguments: Any) -> BaseModel:
    model = TOOL_ARGUMENT_MODELS.get(tool_name)
    if not model:
        raise ToolParseError(f"Unsupported tool: {tool_name}")

    if isinstance(raw_arguments, str):
        try:
            raw_arguments = json.loads(raw_arguments)
        except json.JSONDecodeError as exc:
            raise ToolParseError(f"Invalid JSON arguments for {tool_name}") from exc

    if not isinstance(raw_arguments, dict):
        raise ToolParseError(f"Arguments for {tool_name} must be an object")

    try:
        return model.model_validate(raw_arguments)
    except ValidationError as exc:
        raise ToolParseError(f"Invalid arguments for {tool_name}: {exc}") from exc


def parse_tool_call(raw_call: Dict[str, Any]) -> DrawingToolCall:
    tool_name = raw_call.get("tool") or raw_call.get("name")
    if not isinstance(tool_name, str):
        raise ToolParseError("Tool call missing tool name")

    arguments = parse_tool_arguments(tool_name, raw_call.get("arguments", {}))
    confidence = raw_call.get("confidence", 0.0)

    return DrawingToolCall(
        tool=tool_name,  # type: ignore[arg-type]
        arguments=arguments,
        confidence=confidence
    )


def parse_drawing_plan(raw_plan: Dict[str, Any]) -> DrawingPlan:
    raw_calls = raw_plan.get("calls", [])
    if not isinstance(raw_calls, list):
        raise ToolParseError("Drawing plan calls must be a list")

    calls: List[DrawingToolCall] = []
    for raw_call in raw_calls:
        if not isinstance(raw_call, dict):
            raise ToolParseError("Each tool call must be an object")
        calls.append(parse_tool_call(raw_call))

    return DrawingPlan(
        calls=calls,
        response=str(raw_plan.get("response", "") or ""),
        reasoning=raw_plan.get("reasoning")
    )


def intent_from_tool(tool_name: ToolName) -> str:
    if tool_name == "ignore_input":
        return "ignore"
    if tool_name == "ask_clarification":
        return "clarify"
    if tool_name == "control_canvas":
        return "control"
    if tool_name == "delete_object":
        return "delete"
    if tool_name == "edit_object":
        return "edit"
    return "draw"
