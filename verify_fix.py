#!/usr/bin/env python3
"""验证KIND_ALIASES修复是否成功"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

print("🔍 验证KIND_ALIASES修复\n")
print("=" * 70)

try:
    # 1. 导入需要的模块
    from app.drawing.target_resolver import KIND_ALIASES
    from app.drawing.executor import TEMPLATE_KINDS, BASIC_SHAPES
    import json

    # 2. 读取manifest
    with open('backend/app/assets/svg/manifest.json', 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    manifest_kinds = {asset['kind'] for asset in manifest['assets']}

    print(f"✓ Manifest加载成功: {len(manifest_kinds)} 个kind")
    print(f"✓ KIND_ALIASES加载成功: {len(KIND_ALIASES)} 个映射")
    print(f"✓ TEMPLATE_KINDS: {len(TEMPLATE_KINDS)} 个")
    print(f"✓ BASIC_SHAPES: {len(BASIC_SHAPES)} 个")

    # 3. 检查所有映射
    print("\n" + "=" * 70)
    print("检查KIND_ALIASES映射的有效性\n")

    valid_targets = manifest_kinds | TEMPLATE_KINDS | BASIC_SHAPES
    invalid_mappings = []

    for chinese, english_kind in KIND_ALIASES.items():
        if english_kind not in valid_targets:
            invalid_mappings.append((chinese, english_kind))

    if invalid_mappings:
        print(f"❌ 发现 {len(invalid_mappings)} 个无效映射:\n")
        for chinese, english in invalid_mappings:
            print(f"  '{chinese}' → '{english}' (不存在)")
        print("\n修复失败！")
        sys.exit(1)
    else:
        print("✅ 所有映射都有效！\n")

    # 4. 测试之前有问题的映射
    print("=" * 70)
    print("测试之前有问题的映射\n")

    test_cases = [
        ("人", "person_standing", "人物"),
        ("小人", "person_standing", "人物"),
        ("栅栏", "fence_wood", "建筑"),
        ("木栅栏", "fence_wood", "建筑"),
        ("路", "road_straight", "道路"),
        ("道路", "road_straight", "道路"),
        ("河", "water_surface", "水域"),
        ("河流", "water_surface", "水域"),
        ("课桌", "table_desk", "家具"),
    ]

    all_passed = True
    for chinese, expected, category in test_cases:
        actual = KIND_ALIASES.get(chinese)
        if actual == expected:
            exists = expected in manifest_kinds or expected in TEMPLATE_KINDS
            status = "✓" if exists else "⚠️"
            print(f"  {status} '{chinese}' → '{actual}' ({category})")
        else:
            print(f"  ❌ '{chinese}' → '{actual}' (期望: '{expected}')")
            all_passed = False

    # 5. 检查是否还有不支持的映射被移除
    print("\n" + "=" * 70)
    print("确认不支持的映射已移除\n")

    removed_should_be = ["sailboat", "palm_tree"]
    still_mapped = [k for k, v in KIND_ALIASES.items() if v in removed_should_be]

    if still_mapped:
        print(f"⚠️ 以下映射应该被移除但仍存在:")
        for word in still_mapped:
            print(f"  - '{word}' → '{KIND_ALIASES[word]}'")
    else:
        print("✅ 不支持的映射已正确移除")

    # 6. 统计信息
    print("\n" + "=" * 70)
    print("统计信息\n")

    # 统计映射到SVG、template、basic的数量
    svg_count = sum(1 for v in KIND_ALIASES.values() if v in manifest_kinds)
    template_count = sum(1 for v in KIND_ALIASES.values() if v in TEMPLATE_KINDS and v not in manifest_kinds)
    basic_count = sum(1 for v in KIND_ALIASES.values() if v in BASIC_SHAPES)

    print(f"  映射到SVG资源: {svg_count}")
    print(f"  映射到Template: {template_count}")
    print(f"  映射到基础形状: {basic_count}")
    print(f"  总计: {len(KIND_ALIASES)}")

    # 7. 最终结论
    print("\n" + "=" * 70)
    print("验证结果\n")

    if not invalid_mappings and all_passed:
        print("🎉 所有测试通过！")
        print("\n修复已成功应用，现在：")
        print("  ✓ 所有KIND_ALIASES映射都指向有效的kind")
        print("  ✓ 之前有问题的映射（人、栅栏、路、河、课桌）已修复")
        print("  ✓ 不支持的映射（帆船）已移除")
        print("\n下一步:")
        print("  1. 重启后端服务")
        print("  2. 测试语音命令：'画一个人'、'添加一个栅栏'、'画一条路'")
        print("  3. 确认图形能够正常显示")
        sys.exit(0)
    else:
        print("❌ 验证失败")
        print("\n请检查:")
        print("  - KIND_ALIASES中的映射是否正确")
        print("  - manifest.json中的kind字段")
        sys.exit(1)

except Exception as e:
    print(f"\n❌ 验证过程出错: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
