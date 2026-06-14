from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional
import os
import re


PROJECT_ROOT = Path(__file__).resolve().parents[3]

DEFAULT_ASSET_ROOTS = [
    PROJECT_ROOT / "frontend" / "public" / "svg-assets",
    PROJECT_ROOT / "backend" / "app" / "assets" / "svg",
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
    label: str
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
    if "frontend/public/svg-assets" in root.as_posix():
        return f"/svg-assets/{relative}"
    return f"/api/assets/svg/{relative}"


class AssetResolver:
    def __init__(self, roots: Optional[Iterable[Path]] = None):
        self.roots = [Path(root) for root in (roots or _configured_roots())]

    def list_assets(self) -> List[SVGAsset]:
        assets: List[SVGAsset] = []
        for root in self.roots:
            if not root.exists():
                continue
            for file_path in sorted(root.rglob("*.svg")):
                if not file_path.is_file():
                    continue
                stem_tokens = _tokens(file_path.stem)
                folder_tokens = _tokens(file_path.parent.relative_to(root).as_posix())
                keywords = sorted(set(stem_tokens + folder_tokens))
                assets.append(
                    SVGAsset(
                        asset_id=file_path.relative_to(root).with_suffix("").as_posix(),
                        label=file_path.stem.replace("_", " ").replace("-", " "),
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
            lines.append(f"- {asset.asset_id}: {asset.label}; keywords={','.join(asset.keywords[:8])}")
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
            haystack.update(_tokens(asset.asset_id))
            score = len(search_terms & haystack)
            if score > best_score:
                best_asset = asset
                best_score = score

        return best_asset if best_score > 0 else None
