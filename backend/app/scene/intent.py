SCENE_KEYWORDS = [
    "场景",
    "一幅",
    "一张",
    "海边",
    "日落",
    "公园",
    "森林",
    "城市",
    "夜景",
    "生日贺卡",
    "贺卡",
    "山水",
    "房子和树",
    "天空",
    "草地",
]

SIMPLE_COMMAND_WORDS = [
    "选中",
    "删除",
    "撤销",
    "重做",
    "保存",
    "导出",
    "变大",
    "变小",
    "左移",
    "右移",
    "上移",
    "下移",
]

SIMPLE_DRAW_WORDS = [
    "红色圆",
    "圆形",
    "矩形",
    "长方形",
    "正方形",
    "直线",
    "线条",
]


def _normalize_text(text: str) -> str:
    return "".join(str(text or "").split())


def is_scene_request(text: str) -> bool:
    normalized = _normalize_text(text)
    if not normalized:
        return False

    if any(word in normalized for word in SIMPLE_COMMAND_WORDS):
        return False

    if any(word in normalized for word in SIMPLE_DRAW_WORDS) and not any(
        keyword in normalized for keyword in SCENE_KEYWORDS
    ):
        return False

    return any(keyword in normalized for keyword in SCENE_KEYWORDS)
