#!/usr/bin/env python3
"""最终验证 - 确保所有修复都正确应用"""

import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

print("\n" + "=" * 70)
print("🔍 最终验证：检查所有修复是否正确应用")
print("=" * 70 + "\n")

success_count = 0
total_tests = 0

# 测试1: 加载所有必需的模块
try:
    from app.drawing.target_resolver import KIND_ALIASES
    from app.drawing.executor import TEMPLATE_KINDS, BASIC_SHAPES
    from app.assets.resolver import AssetResolver

    print("✓ 所有模块加载成功")
    success_count += 1
except Exception as e:
    print(f"✗ 模块加载失败: {e}")
total_tests += 1

# 测试2: 读取manifest
try:
    with open('backend/app/assets/svg/manifest.json', 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    manifest_kinds = {asset['kind'] for asset in manifest['assets']}
    print(f"✓ Manifest加载成功 ({len(manifest_kinds)} 个kind)")
    success_count += 1
except Exception as e:
    print(f"✗ Manifest加载失败: {e}")
    manifest_kinds = set()
total_tests += 1

# 测试3: 检查关键修复
print("\n" + "=" * 70)
print("检查关键的kind映射修复")
print("=" * 70 + "\n")

critical_fixes = [
    ("人", "person_standing", "必须是person_standing而不是person"),
    ("小人", "person_standing", "必须是person_standing而不是person"),
    ("栅栏", "fence_wood", "必须是fence_wood而不是fence"),
    ("木栅栏", "fence_wood", "必须是fence_wood而不是fence"),
    ("路", "road_straight", "必须是road_straight而不是road"),
    ("道路", "road_straight", "必须是road_straight而不是road"),
    ("河", "water_surface", "必须是water_surface而不是river"),
    ("河流", "water_surface", "必须是water_surface而不是river"),
    ("课桌", "table_desk", "必须是table_desk而不是desk"),
]

fix_passed = 0
for chinese, expected_kind, note in critical_fixes:
    actual = KIND_ALIASES.get(chinese)
    if actual == expected_kind:
        exists = actual in manifest_kinds
        if exists:
            print(f"  ✓ '{chinese}' → '{actual}' (在manifest中)")
            fix_passed += 1
        else:
            print(f"  ⚠️ '{chinese}' → '{actual}' (不在manifest中)")
    else:
        print(f"  ✗ '{chinese}' → '{actual}' (期望: {expected_kind})")
        print(f"     说明: {note}")

total_tests += 1
if fix_passed == len(critical_fixes):
    print(f"\n✓ 所有关键修复都正确应用 ({fix_passed}/{len(critical_fixes)})")
    success_count += 1
else:
    print(f"\n✗ 部分关键修复失败 ({fix_passed}/{len(critical_fixes)})")

# 测试4: 检查是否移除了不存在的映射
print("\n" + "=" * 70)
print("检查不存在的映射是否已移除")
print("=" * 70 + "\n")

should_not_exist = ["sailboat", "palm_tree"]
found_invalid = []

for chinese, english_kind in KIND_ALIASES.items():
    if english_kind in should_not_exist:
        found_invalid.append((chinese, english_kind))

total_tests += 1
if not found_invalid:
    print("✓ 不存在的映射已正确移除")
    success_count += 1
else:
    print(f"✗ 仍有 {len(found_invalid)} 个无效映射:")
    for ch, en in found_invalid:
        print(f"  - '{ch}' → '{en}'")

# 测试5: 检查所有映射的有效性
print("\n" + "=" * 70)
print("检查所有KIND_ALIASES映射的有效性")
print("=" * 70 + "\n")

valid_targets = manifest_kinds | TEMPLATE_KINDS | BASIC_SHAPES
invalid_mappings = []

for chinese, english_kind in KIND_ALIASES.items():
    if english_kind not in valid_targets:
        invalid_mappings.append((chinese, english_kind))

total_tests += 1
if not invalid_mappings:
    print(f"✓ 所有 {len(KIND_ALIASES)} 个映射都有效")
    success_count += 1
else:
    print(f"✗ 发现 {len(invalid_mappings)} 个无效映射:")
    for ch, en in invalid_mappings[:10]:
        print(f"  - '{ch}' → '{en}'")
    if len(invalid_mappings) > 10:
        print(f"  ... 还有 {len(invalid_mappings) - 10} 个")

# 测试6: 测试AssetResolver
print("\n" + "=" * 70)
print("测试AssetResolver是否能正确解析")
print("=" * 70 + "\n")

resolver = AssetResolver()

test_resolves = [
    ("person_standing", "人物"),
    ("fence_wood", "栅栏"),
    ("road_straight", "道路"),
    ("water_surface", "水面"),
    ("table_desk", "桌子"),
]

resolve_passed = 0
for kind, label in test_resolves:
    asset = resolver.resolve(kind)
    if asset:
        print(f"  ✓ '{kind}' → {asset.asset_id}")
        resolve_passed += 1
    else:
        print(f"  ✗ '{kind}' 无法解析")

total_tests += 1
if resolve_passed == len(test_resolves):
    print(f"\n✓ AssetResolver工作正常 ({resolve_passed}/{len(test_resolves)})")
    success_count += 1
else:
    print(f"\n⚠️ AssetResolver部分测试失败 ({resolve_passed}/{len(test_resolves)})")

# 最终报告
print("\n" + "=" * 70)
print("验证总结")
print("=" * 70 + "\n")

print(f"通过测试: {success_count}/{total_tests}")

if success_count == total_tests:
    print("\n🎉 所有测试通过！修复成功！\n")
    print("下一步:")
    print("  1. 重启后端服务:")
    print("     pkill -f 'uvicorn app.main:app'")
    print("     cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload")
    print("")
    print("  2. 在前端测试这些语音命令:")
    print("     - '画一个人'")
    print("     - '添加一个栅栏'")
    print("     - '画一条路'")
    print("     - '画一条河'")
    print("     - '画一张课桌'")
    print("")
    print("  3. 检查浏览器控制台确认SVG加载成功")
    sys.exit(0)
else:
    print("\n⚠️ 部分测试失败\n")
    print("请检查:")
    print("  - KIND_ALIASES中的映射")
    print("  - manifest.json的完整性")
    sys.exit(1)
