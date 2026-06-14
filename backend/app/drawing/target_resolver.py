from dataclasses import dataclass
from math import hypot
import re
from typing import Any, Dict, Iterable, List, Optional

from app.assets.resolver import AssetResolver, SVGAsset


CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600
PRECISE_MATCH_GAP = 18
SPATIAL_TIE_GAP = 24
LARGE_AREA_TIE_RATIO = 0.08

PENDING_TARGET = "__pending_target__"

BASE_KIND_PROFILES: Dict[str, Dict[str, Any]] = {
    "circle": {"category": "shape", "aliases": ["圆", "圆形", "圈"]},
    "round": {"category": "shape", "aliases": ["圆", "圆形", "圈"]},
    "rect": {"category": "shape", "aliases": ["矩形", "方形", "方块", "长方形"]},
    "rectangle": {"category": "shape", "aliases": ["矩形", "方形", "方块", "长方形"]},
    "square": {"category": "shape", "aliases": ["方形", "方块", "正方形"]},
    "line": {"category": "shape", "aliases": ["线", "线条", "直线"]},
    "star": {"category": "shape", "aliases": ["星星", "五角星"]},
    "text": {"category": "text", "aliases": ["文字", "文本", "字", "标题"]},
    "image": {"category": "asset", "aliases": ["素材", "图片", "图案"]},
    "group": {"category": "group", "aliases": ["组合", "对象"]},
    "background": {"category": "environment", "aliases": ["背景", "天空"]},
    "ground": {"category": "environment", "aliases": ["地面", "底部", "草地", "沙滩"]},
    "sun": {"category": "sky", "aliases": ["太阳", "日头", "落日", "夕阳"]},
    "tree": {"category": "nature", "aliases": ["树", "树木", "大树", "小树"]},
    "cloud": {"category": "sky", "aliases": ["云", "云朵", "白云", "云彩"]},
    "house": {"category": "structure", "aliases": ["房子", "小屋", "木屋", "屋子"]},
    "flower": {"category": "nature", "aliases": ["花", "小花", "鲜花", "花朵"]},
    "person": {"category": "person", "aliases": ["人", "小人", "人物", "老师"]},
    "car": {"category": "vehicle", "aliases": ["车", "汽车", "小车"]},
    "mountain": {"category": "nature", "aliases": ["山", "山峰", "远山"]},
    "grass": {"category": "nature", "aliases": ["草", "草地", "草丛"]},
    "road": {"category": "path", "aliases": ["路", "道路", "小路", "马路"]},
    "river": {"category": "water", "aliases": ["河", "河流", "水面", "海面", "水", "海"]},
    "palm_tree": {"category": "nature", "aliases": ["椰子树", "棕榈树", "树"]},
    "bench": {"category": "furniture", "aliases": ["长椅", "椅子", "椅", "公园长椅"]},
    "balloon": {"category": "decoration", "aliases": ["气球", "彩球"]},
    "gift": {"category": "prop", "aliases": ["礼物", "礼盒", "礼品"]},
    "cake": {"category": "food", "aliases": ["蛋糕", "生日蛋糕"]},
    "building": {"category": "structure", "aliases": ["楼", "高楼", "楼房", "建筑"]},
    "sailboat": {"category": "vehicle", "aliases": ["帆船", "船", "小船"]},
    "fence": {"category": "structure", "aliases": ["栅栏", "栏杆", "围栏"]},
    "desk": {"category": "furniture", "aliases": ["桌子", "课桌", "书桌"]},
}

CATEGORY_ALIASES: Dict[str, List[str]] = {
    "shape": ["图形", "形状"],
    "text": ["文字", "文本", "标题"],
    "asset": ["素材", "图案", "图片"],
    "group": ["组合", "对象"],
    "environment": ["背景", "环境"],
    "sky": ["天空物体", "天上"],
    "nature": ["自然", "植物"],
    "structure": ["建筑", "结构"],
    "person": ["人物", "角色"],
    "vehicle": ["交通工具"],
    "path": ["道路", "路径"],
    "water": ["水面", "水域"],
    "furniture": ["家具"],
    "prop": ["道具", "物品"],
    "food": ["食物"],
    "decoration": ["装饰", "点缀"],
    "animal": ["动物"],
    "electronics": ["电子设备", "设备"],
    "foreground": ["前景"],
    "background": ["背景"],
}

ROLE_ALIASES: Dict[str, List[str]] = {
    "background": ["背景", "远景", "后面"],
    "midground": ["中景", "中间层"],
    "foreground": ["前景", "前面"],
    "decoration": ["装饰", "点缀"],
    "label": ["文字", "标签", "标题"],
}

KIND_ALIASES = {
    "太阳": "sun",
    "树": "tree",
    "云": "cloud",
    "房子": "house",
    "花": "flower",
    "人": "person",
    "小人": "person",
    "车": "car",
    "山": "mountain",
    "草": "grass",
    "草地": "grass",
    "路": "road",
    "道路": "road",
    "小路": "road",
    "河": "river",
    "河流": "river",
    "海": "river",
    "海面": "river",
    "椰子树": "palm_tree",
    "长椅": "bench",
    "气球": "balloon",
    "礼物": "gift",
    "蛋糕": "cake",
    "高楼": "building",
    "帆船": "sailboat",
    "栅栏": "fence",
    "课桌": "desk",
}


@dataclass
class ObjectProfile:
    object_id: str
    kind: str
    type: str
    category: str
    aliases: List[str]
    attributes: List[str]
    role: Optional[str]
    area: float
    center_x: float
    center_y: float


_ASSET_RESOLVER = AssetResolver()
_ASSET_INDEX: Optional[Dict[str, SVGAsset]] = None


@dataclass
class RankedCandidate:
    profile: ObjectProfile
    score: float
    reason: str
    spatial_score: float = 0


def normalize_text(text: Any) -> str:
    return re.sub(r"[，。！？、,.!?:：\s]+", "", str(text or "").strip()).lower()


def unique(items: Iterable[Any]) -> List[str]:
    seen = set()
    values: List[str] = []
    for item in items:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        values.append(value)
    return values


def normalize_kind(kind: Any) -> str:
    raw = str(kind or "").strip().lower()
    return KIND_ALIASES.get(raw, raw)


def asset_lookup_key(value: Any) -> str:
    return normalize_text(value).replace("_", "")


def asset_index() -> Dict[str, SVGAsset]:
    global _ASSET_INDEX
    if _ASSET_INDEX is not None:
        return _ASSET_INDEX

    index: Dict[str, SVGAsset] = {}
    for asset in _ASSET_RESOLVER.list_assets():
        terms = [
            asset.asset_id,
            asset.kind,
            asset.label,
            *asset.aliases,
            *asset.keywords,
        ]
        for term in terms:
            key = asset_lookup_key(term)
            if key and key not in index:
                index[key] = asset
    _ASSET_INDEX = index
    return index


def find_asset_semantic(obj: Dict[str, Any], kind: str) -> Optional[SVGAsset]:
    for value in [
        obj.get("assetId"),
        kind,
        obj.get("kind"),
        obj.get("kindLabel"),
        obj.get("label"),
        *list(obj.get("semanticAliases") or []),
    ]:
        key = asset_lookup_key(value)
        if key and key in asset_index():
            return asset_index()[key]
    return None


def detect_spatial_hint(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    if re.search(r"最大|最大的|最宽|最大的那个", normalized):
        return "largest"
    if re.search(r"最左|左边|左侧", normalized) and not re.search(r"左移|往左|向左", normalized):
        return "left"
    if re.search(r"最右|右边|右侧", normalized) and not re.search(r"右移|往右|向右", normalized):
        return "right"
    if re.search(r"最上|上边|上面|顶部", normalized) and not re.search(r"上移|往上|向上", normalized):
        return "top"
    if re.search(r"最下|下边|下面|底部", normalized) and not re.search(r"下移|往下|向下", normalized):
        return "bottom"
    if re.search(r"中间|中央|中心", normalized):
        return "center"
    return None


def best_term_match_score(input_text: Any, terms: Iterable[Any]) -> tuple[float, str]:
    normalized_input = normalize_text(input_text)
    best_score = 0.0
    best_term = ""
    if not normalized_input:
        return best_score, best_term

    for term in terms:
        normalized_term = normalize_text(term)
        if not normalized_term:
            continue
        score = 0.0
        if normalized_input == normalized_term:
            score = 120 + min(len(normalized_term), 8)
        elif normalized_term in normalized_input:
            score = (82 if len(normalized_term) >= 2 else 58) + min(len(normalized_term), 8)
        elif normalized_input in normalized_term and len(normalized_input) >= 2:
            score = 70 + min(len(normalized_input), 8)
        if score > best_score:
            best_score = score
            best_term = normalized_term
    return best_score, best_term


def infer_category(obj: Dict[str, Any], kind: str, type_name: str) -> str:
    base = BASE_KIND_PROFILES.get(kind) or BASE_KIND_PROFILES.get(type_name) or {}
    base_category = base.get("category")
    asset = find_asset_semantic(obj, kind)
    if obj.get("assetCategory"):
        return str(obj.get("assetCategory"))
    if asset:
        return asset.category
    if base_category and base_category not in {"shape", "group", "object"}:
        return str(base_category)
    scene_role = obj.get("sceneRole")
    if scene_role == "background":
        return "background"
    if scene_role == "decoration":
        return "decoration"
    if scene_role == "foreground":
        return "foreground"
    return str(base_category or "object")


def build_object_profiles(context: Optional[Dict[str, Any]]) -> List[ObjectProfile]:
    objects = (context or {}).get("objects") or []
    profiles: List[ObjectProfile] = []
    for obj in objects:
        object_id = str(obj.get("id") or "").strip()
        if not object_id:
            continue
        kind = normalize_kind(obj.get("kind") or obj.get("type") or "object")
        type_name = str(obj.get("type") or "object").lower()
        base = BASE_KIND_PROFILES.get(kind) or BASE_KIND_PROFILES.get(type_name) or {}
        asset = find_asset_semantic(obj, kind)
        category = infer_category(obj, kind, type_name)
        width = float(obj.get("width") or 0)
        height = float(obj.get("height") or 0)
        radius = obj.get("radius")
        if radius is not None and not width and not height:
            width = float(radius) * 2
            height = float(radius) * 2
        x = obj.get("x")
        y = obj.get("y")
        center_x = obj.get("centerX")
        center_y = obj.get("centerY")
        if center_x is None:
            center_x = float(x or 0) + width / 2 if x is not None else CANVAS_WIDTH / 2
        if center_y is None:
            center_y = float(y or 0) + height / 2 if y is not None else CANVAS_HEIGHT / 2
        area = float(obj.get("area") or max(0, width) * max(0, height))
        aliases = unique([
            obj.get("kindLabel"),
            asset.label if asset else None,
            obj.get("text"),
            obj.get("idHint"),
            obj.get("assetId"),
            asset.asset_id if asset else None,
            kind,
            type_name,
            asset.kind if asset else None,
            *((asset.aliases if asset else []) or []),
            *((asset.keywords if asset else []) or []),
            *(obj.get("semanticAliases") or []),
            *(base.get("aliases") or []),
            *CATEGORY_ALIASES.get(category, []),
        ])
        role = obj.get("sceneRole")
        attributes = unique([
            role,
            obj.get("sceneType"),
            category,
            *ROLE_ALIASES.get(str(role or ""), []),
        ])
        profiles.append(ObjectProfile(
            object_id=object_id,
            kind=kind,
            type=type_name,
            category=category,
            aliases=aliases,
            attributes=attributes,
            role=str(role) if role else None,
            area=area,
            center_x=float(center_x),
            center_y=float(center_y),
        ))
    return profiles


def score_profile(profile: ObjectProfile, query: Dict[str, Any], normalized_text: str) -> Optional[RankedCandidate]:
    reasons: List[str] = []
    score = 0.0
    target_term_matched = False

    def add_target_score(value: float, reason: str) -> None:
        nonlocal score, target_term_matched
        if value <= 0:
            return
        score += value
        reasons.append(reason)
        target_term_matched = True

    query_kind = normalize_kind(query.get("kind"))
    if query_kind:
        if profile.kind == query_kind or profile.type == query_kind:
            add_target_score(125, f"kind:{query_kind}")
        else:
            alias_score, alias = best_term_match_score(query_kind, profile.aliases)
            add_target_score(min(105, alias_score), f"kind-alias:{alias}")

    if query.get("label"):
        label_score, alias = best_term_match_score(query.get("label"), profile.aliases)
        add_target_score(label_score, f"label:{alias}")

    query_category = normalize_text(query.get("category"))
    if query_category and profile.category == query_category:
        add_target_score(78, f"category:{query_category}")

    query_role = normalize_text(query.get("role"))
    if query_role and normalize_text(profile.role) == query_role:
        add_target_score(52, f"role:{query_role}")

    raw_score, alias = best_term_match_score(normalized_text, profile.aliases)
    add_target_score(raw_score, f"alias:{alias}")

    if not target_term_matched:
        return None

    attribute_score, attribute = best_term_match_score(normalized_text, profile.attributes)
    if attribute_score > 0:
        score += min(28, attribute_score / 4)
        reasons.append(f"attribute:{attribute}")

    return RankedCandidate(profile=profile, score=score, reason=", ".join(reasons))


def rank_by_spatial_hint(candidates: List[RankedCandidate], spatial: str) -> List[RankedCandidate]:
    ranked: List[RankedCandidate] = []
    for candidate in candidates:
        spatial_score = 0.0
        if spatial == "left":
            spatial_score = CANVAS_WIDTH - candidate.profile.center_x
        elif spatial == "right":
            spatial_score = candidate.profile.center_x
        elif spatial == "top":
            spatial_score = CANVAS_HEIGHT - candidate.profile.center_y
        elif spatial == "bottom":
            spatial_score = candidate.profile.center_y
        elif spatial == "center":
            distance = hypot(candidate.profile.center_x - CANVAS_WIDTH / 2, candidate.profile.center_y - CANVAS_HEIGHT / 2)
            spatial_score = max(0, CANVAS_WIDTH - distance)
        elif spatial == "largest":
            spatial_score = candidate.profile.area
        ranked.append(RankedCandidate(
            profile=candidate.profile,
            score=candidate.score + min(35, spatial_score / 20),
            reason=f"{candidate.reason}, spatial:{spatial}",
            spatial_score=spatial_score,
        ))
    return sorted(ranked, key=lambda item: (item.spatial_score, item.score), reverse=True)


def spatial_winner_is_distinct(picked: RankedCandidate, runner_up: RankedCandidate, spatial: str) -> bool:
    if spatial == "largest":
        return picked.profile.area - runner_up.profile.area >= max(1, picked.profile.area * LARGE_AREA_TIE_RATIO)
    return abs(picked.spatial_score - runner_up.spatial_score) >= SPATIAL_TIE_GAP


def candidate_payload(candidates: List[RankedCandidate]) -> List[Dict[str, Any]]:
    return [
        {
            "objectId": candidate.profile.object_id,
            "score": round(candidate.score, 2),
            "reason": candidate.reason,
        }
        for candidate in candidates[:5]
    ]


def resolve_from_candidates(candidates: List[RankedCandidate], spatial: Optional[str]) -> Dict[str, Any]:
    score_ranked = sorted(candidates, key=lambda item: item.score, reverse=True)
    if spatial and len(score_ranked) > 1:
        top_score = score_ranked[0].score
        runner_up_score = score_ranked[1].score
        spatial_pool = [score_ranked[0]] if top_score - runner_up_score >= PRECISE_MATCH_GAP else [
            item for item in score_ranked if top_score - item.score < PRECISE_MATCH_GAP
        ]
        spatial_ranked = rank_by_spatial_hint(spatial_pool, spatial)
        picked = spatial_ranked[0]
        runner_up = spatial_ranked[1] if len(spatial_ranked) > 1 else None
        if not runner_up or spatial_winner_is_distinct(picked, runner_up, spatial):
            return {
                "status": "resolved",
                "objectId": picked.profile.object_id,
                "confidence": 0.92,
                "reason": picked.reason,
                "candidates": candidate_payload(spatial_ranked),
            }
        return {
            "status": "ambiguous",
            "objectId": None,
            "confidence": 0.74,
            "reason": f"位置描述仍不够明确：{spatial}",
            "candidates": candidate_payload(spatial_ranked),
        }

    picked = score_ranked[0]
    runner_up = score_ranked[1] if len(score_ranked) > 1 else None
    if not runner_up or picked.score - runner_up.score >= PRECISE_MATCH_GAP:
        return {
            "status": "resolved",
            "objectId": picked.profile.object_id,
            "confidence": 0.9,
            "reason": picked.reason,
            "candidates": candidate_payload(score_ranked),
        }

    return {
        "status": "ambiguous",
        "objectId": None,
        "confidence": 0.72,
        "reason": "找到多个同类目标，需要用户确认",
        "candidates": candidate_payload(score_ranked),
    }


def resolve_target_query(
    query: Dict[str, Any],
    context: Optional[Dict[str, Any]],
    action: Optional[str] = None,
) -> Dict[str, Any]:
    profiles = build_object_profiles(context)
    explicit_target = query.get("target")
    if explicit_target and explicit_target != "__last__":
        for profile in profiles:
            if profile.object_id == explicit_target:
                return {
                    "status": "resolved",
                    "objectId": profile.object_id,
                    "confidence": 0.98,
                    "reason": "exact target id",
                    "candidates": candidate_payload([RankedCandidate(profile, 100, "exact target id")]),
                }

    raw_text = query.get("rawText") or query.get("target") or query.get("label") or query.get("kind") or ""
    normalized_text = normalize_text(raw_text)
    spatial = query.get("spatial") or detect_spatial_hint(normalized_text)
    ranked = [
        candidate
        for profile in profiles
        for candidate in [score_profile(profile, query, normalized_text)]
        if candidate is not None
    ]

    if ranked:
        return resolve_from_candidates(ranked, spatial)

    if spatial:
        spatial_candidates = [
            RankedCandidate(profile=profile, score=34 if spatial == "largest" else 30, reason=f"spatial-only:{spatial}")
            for profile in profiles
        ]
        if spatial_candidates:
            return resolve_from_candidates(spatial_candidates, spatial)

    return {
        "status": "not_found",
        "objectId": None,
        "confidence": 0,
        "reason": "没有匹配到明确对象",
        "candidates": [],
    }


def object_bounds(obj: Dict[str, Any]) -> Optional[Dict[str, float]]:
    params = obj.get("params") or {}
    object_type = obj.get("type")
    if object_type == "group":
        child_bounds = [
            bounds
            for child in obj.get("children") or []
            for bounds in [object_bounds(child)]
            if bounds
        ]
        if not child_bounds:
            return None
        min_x = min(bounds["x"] for bounds in child_bounds)
        min_y = min(bounds["y"] for bounds in child_bounds)
        max_x = max(bounds["x"] + bounds["width"] for bounds in child_bounds)
        max_y = max(bounds["y"] + bounds["height"] for bounds in child_bounds)
        return {"x": min_x, "y": min_y, "width": max_x - min_x, "height": max_y - min_y}

    points = params.get("points")
    if isinstance(points, list) and len(points) >= 2:
        xs = [float(value) for index, value in enumerate(points) if index % 2 == 0]
        ys = [float(value) for index, value in enumerate(points) if index % 2 == 1]
        return {"x": min(xs), "y": min(ys), "width": max(xs) - min(xs), "height": max(ys) - min(ys)}

    if not isinstance(params.get("x"), (int, float)) or not isinstance(params.get("y"), (int, float)):
        return None

    x = float(params["x"])
    y = float(params["y"])
    if isinstance(params.get("radius"), (int, float)):
        radius = float(params["radius"])
        return {"x": x - radius, "y": y - radius, "width": radius * 2, "height": radius * 2}
    if object_type == "star":
        radius = float(params.get("outerRadius") or 40)
        return {"x": x - radius, "y": y - radius, "width": radius * 2, "height": radius * 2}
    if object_type == "text":
        text = str(params.get("text") or "")
        font_size = float(params.get("fontSize") or 24)
        return {"x": x, "y": y, "width": max(40, len(text) * font_size * 0.62), "height": font_size * 1.4}
    return {
        "x": x,
        "y": y,
        "width": float(params.get("width") or 0),
        "height": float(params.get("height") or 0),
    }


def command_context_from_create_commands(commands: List[Dict[str, Any]]) -> Dict[str, Any]:
    objects: List[Dict[str, Any]] = []
    for command in commands:
        if command.get("action") != "create" or not command.get("id"):
            continue
        params = command.get("params") or {}
        bounds = object_bounds(command) or {}
        width = params.get("width", bounds.get("width"))
        height = params.get("height", bounds.get("height"))
        objects.append({
            "id": command.get("id"),
            "type": command.get("type"),
            "kind": params.get("kind"),
            "kindLabel": params.get("kindLabel"),
            "text": params.get("text"),
            "x": params.get("x", bounds.get("x")),
            "y": params.get("y", bounds.get("y")),
            "width": width,
            "height": height,
            "radius": params.get("radius"),
            "centerX": bounds.get("x", 0) + bounds.get("width", 0) / 2 if bounds else None,
            "centerY": bounds.get("y", 0) + bounds.get("height", 0) / 2 if bounds else None,
            "area": float(width or 0) * float(height or 0),
            "sceneType": params.get("sceneType"),
            "sceneRole": params.get("sceneRole"),
            "idHint": params.get("idHint"),
            "assetId": params.get("assetId"),
            "assetCategory": params.get("assetCategory"),
            "semanticAliases": params.get("semanticAliases"),
        })
    return {"objects": objects}
