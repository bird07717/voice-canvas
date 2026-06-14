from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
import json
import os
import re


APP_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = APP_ROOT.parent
PROJECT_ROOT = BACKEND_ROOT.parent
BACKEND_SVG_ASSET_ROOT = APP_ROOT / "assets" / "svg"

DEFAULT_ASSET_ROOTS = [
    BACKEND_SVG_ASSET_ROOT,
    PROJECT_ROOT / "frontend" / "public" / "svg-assets",
]

KIND_ALIASES: Dict[str, List[str]] = {
    "cat": ["cat", "kitten", "猫", "小猫"],
    "dog": ["dog", "puppy", "狗", "小狗"],
    "bird": ["bird", "鸟", "小鸟"],
    "fountain": ["fountain", "喷泉"],
    "airplane": ["airplane", "plane", "飞机"],
    "rocket": ["rocket", "火箭"],
    "dragon": ["dragon", "龙"],
    "dinosaur": ["dinosaur", "恐龙"],
    "flower": ["flower", "花", "鲜花"],
    "tree": ["tree", "树"],
    "gift": ["gift", "礼物"],
    "balloon": ["balloon", "气球"],
    "cake": ["cake", "蛋糕"],
}


@dataclass(frozen=True)
class SVGAsset:
    asset_id: str
    kind: str
    label: str
    category: str
    aliases: List[str]
    keywords: List[str]
    file_path: Path
    public_url: str


def _configured_roots() -> List[Path]:
    raw_roots = os.getenv("SVG_ASSET_ROOTS", "")
    roots = [Path(item).expanduser() for item in raw_roots.split(os.pathsep) if item.strip()]
    return roots or DEFAULT_ASSET_ROOTS


def _tokens(text: str) -> List[str]:
    normalized = re.sub(r"[_\-./\\]+", " ", text.lower())
    return [part for part in re.split(r"\s+", normalized) if part]


def _public_url(root: Path, file_path: Path) -> str:
    relative = file_path.relative_to(root).as_posix()
    if root.resolve().as_posix().endswith("/frontend/public/svg-assets"):
        return f"/svg-assets/{relative}"
    return f"/api/assets/svg/{relative}"


def _load_manifest(root: Path) -> Dict[str, Dict[str, Any]]:
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        return {}

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    entries = payload.get("assets", [])
    if not isinstance(entries, list):
        return {}

    manifest: Dict[str, Dict[str, Any]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        asset_id = str(entry.get("asset_id") or "").strip()
        if asset_id:
            manifest[asset_id] = entry
    return manifest


def _fallback_kind(asset_id: str) -> str:
    return Path(asset_id).name.lower()


class AssetResolver:
    def __init__(self, roots: Optional[Iterable[Path]] = None):
        self.roots = [Path(root) for root in (roots or _configured_roots())]

    def list_assets(self) -> List[SVGAsset]:
        assets: List[SVGAsset] = []
        for root in self.roots:
            if not root.exists():
                continue
            manifest = _load_manifest(root)
            for file_path in sorted(root.rglob("*.svg")):
                if not file_path.is_file():
                    continue
                asset_id = file_path.relative_to(root).with_suffix("").as_posix()
                metadata = manifest.get(asset_id, {})
                stem_tokens = _tokens(file_path.stem)
                folder_tokens = _tokens(file_path.parent.relative_to(root).as_posix())
                aliases = [
                    str(alias).strip()
                    for alias in metadata.get("aliases", [])
                    if str(alias).strip()
                ]
                kind = str(metadata.get("kind") or _fallback_kind(asset_id)).strip().lower()
                label = str(metadata.get("label") or file_path.stem.replace("_", " ").replace("-", " ")).strip()
                category = str(metadata.get("category") or (folder_tokens[0] if folder_tokens else "asset")).strip().lower()
                keywords = sorted(set(
                    stem_tokens
                    + folder_tokens
                    + _tokens(kind)
                    + _tokens(label)
                    + [token for alias in aliases for token in _tokens(alias)]
                ))
                assets.append(
                    SVGAsset(
                        asset_id=asset_id,
                        kind=kind,
                        label=label,
                        category=category,
                        aliases=aliases,
                        keywords=keywords,
                        file_path=file_path,
                        public_url=_public_url(root, file_path),
                    )
                )
        return assets

    def catalog_summary(self, limit: int = 80) -> str:
        assets = self.list_assets()
        if not assets:
            return "当前 SVG 素材库为空；新增未知物体时应回退到 template 或 basic 几何。"

        lines = []
        for asset in assets[:limit]:
            aliases = ",".join(asset.aliases[:6])
            lines.append(
                f"- {asset.asset_id}: kind={asset.kind}; label={asset.label}; "
                f"category={asset.category}; aliases={aliases}; keywords={','.join(asset.keywords[:8])}"
            )
        if len(assets) > limit:
            lines.append(f"- 还有 {len(assets) - limit} 个素材未列出。")
        return "\n".join(lines)

    def resolve(self, kind: str, query: Optional[str] = None) -> Optional[SVGAsset]:
        assets = self.list_assets()
        if not assets:
            return None

        search_terms = set(_tokens(kind))
        search_terms.update(_tokens(query or ""))
        for alias in KIND_ALIASES.get(str(kind or "").lower(), []):
            search_terms.update(_tokens(alias))

        best_asset: Optional[SVGAsset] = None
        best_score = 0
        for asset in assets:
            haystack = set(asset.keywords)
            haystack.update(_tokens(asset.label))
            haystack.update(_tokens(asset.kind))
            haystack.update(_tokens(asset.asset_id))
            for alias in asset.aliases:
                haystack.update(_tokens(alias))
            score = len(search_terms & haystack)
            if str(kind or "").lower() == asset.kind:
                score += 3
            if score > best_score:
                best_asset = asset
                best_score = score

        return best_asset if best_score > 0 else None
