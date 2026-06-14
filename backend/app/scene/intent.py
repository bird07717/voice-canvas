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
    "书房",
    "卧室",
    "厨房",
    "办公室",
    "工作室",
    "实验室",
    "咖啡馆",
    "餐厅",
    "商店",
    "房间",
    "室内",
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
    "赛博朋克",
]

LOCATION_NOUNS = [
    "图书馆",
    "庭院",
    "花园",
    "街道",
    "广场",
    "校园",
    "操场",
    "舞台",
    "车站",
    "机场",
    "医院",
    "博物馆",
    "美术馆",
    "游乐场",
    "海底",
    "太空",
    "宇宙",
    "星球",
    "城堡",
    "村庄",
    "小镇",
    "市场",
    "书店",
    "酒吧",
    "阳台",
    "阁楼",
]

OPEN_VISUAL_HINTS = [
    "场景",
    "画面",
    "插画",
    "风景",
    "海报",
    "卡片",
    "壁纸",
    "封面",
    "一幅",
    "一张",
]

STYLE_HINTS = [
    "风格",
    "氛围",
    "感觉",
    "未来感",
    "科幻",
    "赛博",
    "蒸汽朋克",
    "魔法",
    "童话",
    "梦幻",
    "像素",
    "水彩",
    "卡通",
    "写实",
    "复古",
    "霓虹",
    "暗黑",
    "温馨",
    "可爱",
]

COMPOSITION_HINTS = [
    "里面",
    "中间",
    "背景",
    "前景",
    "旁边",
    "窗边",
    "桌上",
    "桌面",
    "坐在",
    "站在",
    "躺在",
    "有",
    "带",
    "包含",
    "和",
    "以及",
]

OPEN_SCENE_NOUNS = (
    "房间",
    "室内",
    "书房",
    "卧室",
    "厨房",
    "办公室",
    "工作室",
    "实验室",
    "咖啡馆",
    "餐厅",
    "商店",
    "桌面",
    "海报",
    "卡片",
)

SIMPLE_COMMAND_WORDS = [
    "选中",
    "选择",
    "删除",
    "删掉",
    "清空",
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

REQUEST_PREFIXES = (
    "麻烦你",
    "麻烦",
    "请你",
    "请帮我",
    "帮我",
    "给我",
    "我想要",
    "我想",
    "想要",
    "请",
)

DRAW_PREFIXES = (
    "画",
    "绘制",
    "生成",
    "创建",
    "设计",
    "制作",
    "来一个",
    "来个",
    "做一个",
    "做个",
    "加一个",
    "加个",
    "加一只",
    "加一条",
    "加一辆",
    "添加一个",
    "添加个",
    "添加一只",
    "添加一条",
    "添加一辆",
    "添加",
)


def _normalize_text(text: str) -> str:
    return "".join(str(text or "").split())


def _strip_request_prefix(text: str) -> str:
    normalized = _normalize_text(text)
    changed = True
    while changed:
        changed = False
        for prefix in REQUEST_PREFIXES:
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):]
                changed = True
                break
    return normalized


def has_scene_draw_prefix(text: str) -> bool:
    normalized = _strip_request_prefix(text)
    return normalized.startswith(DRAW_PREFIXES)


def is_blocked_scene_command(text: str) -> bool:
    normalized = _strip_request_prefix(text)
    if not normalized:
        return True

    if any(normalized.startswith(word) for word in SIMPLE_COMMAND_WORDS):
        return True

    return any(normalized.startswith(word) for word in EDIT_COMMAND_WORDS)


def is_open_visual_draw_request(text: str) -> bool:
    normalized = _strip_request_prefix(text)
    if not normalized or is_blocked_scene_command(normalized):
        return False

    if any(word in normalized for word in SIMPLE_DRAW_WORDS) and not any(
        keyword in normalized for keyword in SCENE_KEYWORDS
    ):
        return False

    if not has_scene_draw_prefix(normalized):
        return False

    if is_open_scene_request(normalized):
        return True

    visual_terms = (
        OPEN_VISUAL_HINTS
        + STYLE_HINTS
        + COMPOSITION_HINTS
        + LOCATION_NOUNS
    )
    if any(keyword in normalized for keyword in visual_terms):
        return True

    return True


def is_open_scene_request(text: str) -> bool:
    normalized = _strip_request_prefix(text)
    if not normalized or is_blocked_scene_command(normalized):
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

    if any(word in normalized for word in OPEN_SCENE_NOUNS):
        return True

    return False


def is_scene_request(text: str) -> bool:
    return is_open_scene_request(text)
