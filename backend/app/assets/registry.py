import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional


ASSET_MANIFEST_PATH = Path(__file__).with_name("svg_manifest.json")

SCENE_CATEGORY_HINTS = {
    "beach_sunset": ["nature", "park"],
    "park": ["park", "nature", "people"],
    "birthday_card": ["birthday", "people"],
    "city_night": ["city", "nature"],
    "forest_house": ["nature", "park"],
    "mountain_landscape": ["nature"],
    "simple_classroom": ["people", "city"],
}

KIND_ALIASES = {
    "palm_tree": ["tree", "tree_oak", "tree_pine"],
    "grass": ["flower", "flower_patch"],
    "road": [],
    "river": [],
    "fence": [],
    "desk": [],
    "star": [],
    "rect": [],
    "circle": [],
    "line": [],
    "text": [],
}


@lru_cache(maxsize=1)
def load_svg_assets() -> List[Dict[str, Any]]:
    if not ASSET_MANIFEST_PATH.exists():
        return []

    with ASSET_MANIFEST_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)

    return data if isinstance(data, list) else []


def resolve_svg_asset(
    kind: str,
    label: Optional[str] = None,
    scene_type: Optional[str] = None,
    style: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    normalized_kind = str(kind or "").strip().lower()
    normalized_label = str(label or "").strip().lower()
    normalized_style = str(style or "").strip().lower()

    if not normalized_kind and not normalized_label:
        return None

    candidates = load_svg_assets()
    best_asset: Optional[Dict[str, Any]] = None
    best_score = 0

    for asset in candidates:
        score = _score_asset(
            asset,
            normalized_kind,
            normalized_label,
            scene_type,
            normalized_style,
        )
        if score > best_score:
            best_asset = asset
            best_score = score

    return best_asset if best_score >= 4 else None


def _score_asset(
    asset: Dict[str, Any],
    kind: str,
    label: str,
    scene_type: Optional[str],
    style: str,
) -> int:
    score = 0
    asset_id = str(asset.get("id") or "").lower()
    category = str(asset.get("category") or "").lower()
    asset_style = str(asset.get("style") or "").lower()
    asset_label = str(asset.get("label") or "").lower()
    kinds = [str(item).lower() for item in asset.get("kinds") or []]
    tags = [str(item).lower() for item in asset.get("tags") or []]
    alias_kinds = KIND_ALIASES.get(kind, [])

    if kind and kind in kinds:
        score += 8
    if kind and any(alias in kinds for alias in alias_kinds):
        score += 5
    if kind and (kind in asset_id or kind in tags):
        score += 4

    if label and (label == asset_label or label in tags):
        score += 4
    if label and any(label in tag or tag in label for tag in tags if tag):
        score += 2

    preferred_categories = SCENE_CATEGORY_HINTS.get(str(scene_type or ""), [])
    if category in preferred_categories:
        score += 3
    elif category == str(scene_type or "").lower():
        score += 2

    if style and style == asset_style:
        score += 1

    return score
