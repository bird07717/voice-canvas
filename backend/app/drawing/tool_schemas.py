from typing import Any, Dict, List


DRAWING_TOOL_SCHEMAS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "create_object",
            "description": "Create a new visual object on the canvas. Use templates for common objects and svg for unknown objects.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["kind", "render_strategy"],
                "properties": {
                    "kind": {
                        "type": "string",
                        "description": "Semantic object kind, such as circle, sun, tree, house, cloud, dragon."
                    },
                    "render_strategy": {
                        "type": "string",
                        "enum": ["basic", "template", "svg"],
                        "description": "basic for primitive shapes, template for known common objects, svg for unknown/custom objects."
                    },
                    "position": {
                        "$ref": "#/$defs/position"
                    },
                    "size": {
                        "$ref": "#/$defs/size"
                    },
                    "style": {
                        "$ref": "#/$defs/style"
                    },
                    "description": {
                        "type": "string",
                        "description": "Detailed visual description, especially when render_strategy is svg."
                    }
                },
                "$defs": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit_object",
            "description": "Modify an existing object, such as move, resize, recolor, rotate, or change text.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["target", "changes"],
                "properties": {
                    "target": {
                        "$ref": "#/$defs/target"
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["move", "resize", "recolor", "rotate", "restyle"],
                        "description": "High-level edit operation."
                    },
                    "changes": {
                        "type": "object",
                        "additionalProperties": True,
                        "description": "Requested changes. Supports fill, stroke, x, y, dx, dy, scale, scale_delta, width, height, rotation, text."
                    }
                },
                "$defs": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_object",
            "description": "Delete an existing object from the canvas.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["target"],
                "properties": {
                    "target": {
                        "$ref": "#/$defs/target"
                    }
                },
                "$defs": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "control_canvas",
            "description": "Run a canvas-level command such as undo, redo, clear, save, or export.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["action"],
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["undo", "redo", "clear", "save", "export"]
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "ask_clarification",
            "description": "Ask the user a short clarification question when the drawing intent is real but key information is missing.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["question"],
                "properties": {
                    "question": {
                        "type": "string"
                    },
                    "missing": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "ignore_input",
            "description": "Ignore background speech, unrelated conversation, ASR noise, or content that should not affect the canvas.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["reason"],
                "properties": {
                    "reason": {
                        "type": "string"
                    }
                }
            }
        }
    }
]


COMMON_PARAMETER_DEFS: Dict[str, Any] = {
    "position": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "anchor": {
                "type": "string",
                "enum": [
                    "center",
                    "top",
                    "bottom",
                    "left",
                    "right",
                    "top_left",
                    "top_right",
                    "bottom_left",
                    "bottom_right",
                    "near_target",
                    "custom"
                ]
            },
            "x": {"type": "number"},
            "y": {"type": "number"},
            "relative_to": {"type": "string"},
            "offset_x": {"type": "number"},
            "offset_y": {"type": "number"}
        }
    },
    "size": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "preset": {
                "type": "string",
                "enum": ["tiny", "small", "medium", "large", "huge"]
            },
            "width": {"type": "number"},
            "height": {"type": "number"},
            "scale": {"type": "number"}
        }
    },
    "style": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "fill": {"type": "string"},
            "stroke": {"type": "string"},
            "stroke_width": {"type": "number", "minimum": 0},
            "opacity": {"type": "number", "minimum": 0, "maximum": 1},
            "rotation": {"type": "number"},
            "text": {"type": "string"},
            "font_size": {"type": "number", "exclusiveMinimum": 0}
        }
    },
    "target": {
        "type": "object",
        "additionalProperties": False,
        "required": ["ref"],
        "properties": {
            "ref": {
                "type": "string",
                "enum": ["last", "selected", "kind", "id"]
            },
            "id": {"type": "string"},
            "kind": {"type": "string"},
            "label": {"type": "string"},
            "category": {"type": "string"},
            "role": {"type": "string"},
            "spatial": {
                "type": "string",
                "enum": ["left", "right", "top", "bottom", "center", "largest"]
            },
            "raw_text": {"type": "string"}
        }
    }
}


def get_drawing_tool_schemas() -> List[Dict[str, Any]]:
    tools = []
    for tool in DRAWING_TOOL_SCHEMAS:
        copied_tool = {
            **tool,
            "function": {
                **tool["function"],
                "parameters": {
                    **tool["function"]["parameters"],
                    "$defs": COMMON_PARAMETER_DEFS
                }
            }
        }
        tools.append(copied_tool)
    return tools
