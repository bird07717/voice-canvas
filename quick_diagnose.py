#!/usr/bin/env python3
"""快速诊断 - 找出哪些图形会有问题"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.drawing.target_resolver import KIND_ALIASES
from app.drawing.executor import TEMPLATE_KINDS

print("🔍 快速诊断：找出可能显示异常的kind\n")
print("=" * 70)

# 检查KIND_ALIASES中映射到的kind是否都有对应的处理
print("检查 KIND_ALIASES 映射结果:\n")

mapped_kinds = set(KIND_ALIASES.values())
print(f"KIND_ALIASES 中映射到 {len(mapped_kinds)} 个不同的kind\n")

# 检查这些kind是否在TEMPLATE_KINDS或有SVG资源
from app.assets.resolver import AssetResolver
resolver = AssetResolver()
assets = resolver.list_assets()
asset_kinds = {asset.kind for asset in assets}

print(f"TEMPLATE_KINDS: {len(TEMPLATE_KINDS)} 个")
print(f"SVG资源kinds: {len(asset_kinds)} 个\n")

# 找出既不在TEMPLATE_KINDS也不在SVG中的kind
orphan_kinds = []
for chinese, english_kind in sorted(KIND_ALIASES.items()):
    has_template = english_kind in TEMPLATE_KINDS
    has_svg = english_kind in asset_kinds

    if not has_template and not has_svg:
        orphan_kinds.append((chinese, english_kind))

if orphan_kinds:
    print(f"⚠️ 发现 {len(orphan_kinds)} 个中文词映射到无效的kind:\n")
    for chinese, english_kind in orphan_kinds[:20]:  # 只显示前20个
        print(f"  '{chinese}' → '{english_kind}' (既无template也无SVG)")

    if len(orphan_kinds) > 20:
        print(f"\n  ... 还有 {len(orphan_kinds) - 20} 个")

    print("\n这些语音命令会:")
    print("  1. 如果LLM指定了render_strategy='template' → 使用_template_generic显示矩形")
    print("  2. 否则 → 显示占位符文字")
else:
    print("✓ 所有KIND_ALIASES映射都有对应的处理\n")

# 检查特定的常用词
print("\n" + "=" * 70)
print("检查常用词的处理情况:\n")

common_words = ["树", "房子", "太阳", "云", "花", "车", "人", "小猫", "小狗", "笔记本电脑", "气球", "灯笼"]

for word in common_words:
    if word in KIND_ALIASES:
        mapped = KIND_ALIASES[word]
        has_template = mapped in TEMPLATE_KINDS
        has_svg = mapped in asset_kinds

        if has_svg:
            status = "✓ SVG"
        elif has_template:
            status = "✓ template"
        else:
            status = "✗ 无处理"

        print(f"  '{word}' → '{mapped}' : {status}")
    else:
        print(f"  '{word}' → 未映射")

print("\n" + "=" * 70)
print("结论:\n")

if orphan_kinds:
    print(f"⚠️ 有 {len(orphan_kinds)} 个别名映射到了不存在的kind")
    print("\n修复建议:")
    print("  1. 检查这些kind是否拼写正确")
    print("  2. 确认manifest.json中的kind字段是否匹配")
    print("  3. 或者从KIND_ALIASES中移除这些映射")
else:
    print("✓ 所有别名映射都正确\n")
    print("如果仍有图形不显示，可能是:")
    print("  1. SVG文件加载失败（检查浏览器Network标签）")
    print("  2. CORS问题")
    print("  3. 前端API_BASE_URL配置错误")
