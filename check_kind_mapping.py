#!/usr/bin/env python3
"""对比KIND_ALIASES与manifest.json的kind字段"""

import sys
import os
import json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# 读取manifest
manifest_path = 'backend/app/assets/svg/manifest.json'
with open(manifest_path, 'r', encoding='utf-8') as f:
    manifest = json.load(f)

# 提取所有的kind
manifest_kinds = set()
for asset in manifest['assets']:
    manifest_kinds.add(asset['kind'])

print(f"Manifest中的kind总数: {len(manifest_kinds)}")
print("\nManifest中的所有kind:")
for kind in sorted(manifest_kinds):
    print(f"  - {kind}")

# 导入KIND_ALIASES
from app.drawing.target_resolver import KIND_ALIASES

# 找出映射到不存在kind的别名
mapped_kinds = set(KIND_ALIASES.values())
print(f"\n\nKIND_ALIASES映射到的kind总数: {len(mapped_kinds)}")

# 从TEMPLATE_KINDS导入，这些kind可能没有SVG
from app.drawing.executor import TEMPLATE_KINDS, BASIC_SHAPES
template_and_basic = TEMPLATE_KINDS | BASIC_SHAPES

orphan_kinds = mapped_kinds - manifest_kinds - template_and_basic

if orphan_kinds:
    print(f"\n❌ 发现 {len(orphan_kinds)} 个映射到不存在kind的别名:")
    for kind in sorted(orphan_kinds):
        # 找出哪些中文词映射到了这个错误的kind
        chinese_words = [ch for ch, en in KIND_ALIASES.items() if en == kind]
        print(f"\n  '{kind}' (不存在) ← {chinese_words}")
else:
    print("\n✅ 所有KIND_ALIASES映射都正确")

# 找出可能的修正建议
if orphan_kinds:
    print("\n\n🔧 修正建议:\n")

    corrections = {
        "person": "person_sitting 或 person_standing",
        "fence": "fence_wood",
        "road": "road_straight",
        "desk": "table_desk",
        "river": "water_surface",
        "sailboat": "没有对应SVG",
        "palm_tree": "没有对应SVG",
    }

    for wrong_kind in sorted(orphan_kinds):
        if wrong_kind in corrections:
            print(f"  '{wrong_kind}' 应该改为: {corrections[wrong_kind]}")
        else:
            # 尝试模糊匹配
            similar = [k for k in manifest_kinds if wrong_kind in k or k in wrong_kind]
            if similar:
                print(f"  '{wrong_kind}' 可能应该是: {', '.join(similar)}")
            else:
                print(f"  '{wrong_kind}' 在manifest中找不到类似的kind")
