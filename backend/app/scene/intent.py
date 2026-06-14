SCENE_KEYWORDS = [
    "场景",
    "一幅",
    "一张",
    "画面",
    "插画",
    "风景",
    "海边",
    "日落",
    "公园",
    "森林",
    "城市",
    "夜景",
    "生日贺卡",
    "贺卡",
    "山水",
    "教室",
    "课堂",
    "客厅",
    "书桌",
    "工作区",
    "办公桌",
    "桌面",
    "派对",
    "节日",
    "庆祝",
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

EDIT_COMMAND_WORDS = [
    "把",
    "将",
    "让",
    "改",
    "换",
    "变",
    "移动",
    "移到",
    "移去",
    "挪到",
    "放到",
    "放在",
    "去掉",
    "移除",
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


def has_scene_draw_prefix(text: str) -> bool:
    normalized = _normalize_text(text)
    return normalized.startswith((
        "画",
        "生成",
        "创建",
        "来一个",
        "来个",
        "做一个",
        "做个",
    ))


def is_open_scene_request(text: str) -> bool:
    normalized = _normalize_text(text)
    if not normalized:
        return False

    if any(word in normalized for word in SIMPLE_COMMAND_WORDS):
        return False

    if any(normalized.startswith(word) for word in EDIT_COMMAND_WORDS):
        return False

    if any(word in normalized for word in SIMPLE_DRAW_WORDS) and not any(
        keyword in normalized for keyword in SCENE_KEYWORDS
    ):
        return False

    if not has_scene_draw_prefix(normalized):
        return False

    has_scene_keyword = any(keyword in normalized for keyword in SCENE_KEYWORDS)
    if has_scene_keyword:
        return True

    if any(word in normalized for word in ("房间", "桌面", "海报", "卡片")):
        return True

    return False


def is_scene_request(text: str) -> bool:
    return is_open_scene_request(text)
