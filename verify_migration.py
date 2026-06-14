#!/usr/bin/env python3
"""验证SVG资源迁移是否成功"""

import sys
import os
import json
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

print("\n" + "=" * 70)
print("🔍 SVG资源迁移验证")
print("=" * 70 + "\n")

success_count = 0
total_tests = 0

# 测试1: 检查后端svg文件夹是否已删除
print("测试1: 检查后端svg文件夹是否已删除")
backend_svg_path = Path('backend/app/assets/svg')
total_tests += 1
if not backend_svg_path.exists():
    print("  ✅ 后端svg文件夹已成功删除")
    success_count += 1
else:
    print("  ❌ 后端svg文件夹仍然存在")

# 测试2: 检查前端svg-assets文件夹
print("\n测试2: 检查前端svg-assets文件夹")
frontend_svg_path = Path('frontend/public/svg-assets')
total_tests += 1
if frontend_svg_path.exists():
    svg_count = len(list(frontend_svg_path.rglob('*.svg')))
    if svg_count == 84:
        print(f"  ✅ 前端svg-assets包含84个SVG文件")
        success_count += 1
    else:
        print(f"  ❌ 前端svg-assets包含{svg_count}个SVG文件（期望84个）")
else:
    print("  ❌ 前端svg-assets文件夹不存在")

# 测试3: 检查manifest.json是否存在
print("\n测试3: 检查manifest.json")
manifest_path = frontend_svg_path / 'manifest.json'
total_tests += 1
if manifest_path.exists():
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        asset_count = len(manifest.get('assets', []))
        if asset_count == 84:
            print(f"  ✅ manifest.json包含84个资源定义")
            success_count += 1
        else:
            print(f"  ⚠️ manifest.json包含{asset_count}个资源定义（期望84个）")
    except Exception as e:
        print(f"  ❌ manifest.json格式错误: {e}")
else:
    print("  ❌ manifest.json不存在")

# 测试4: 检查AssetResolver配置
print("\n测试4: 检查AssetResolver配置")
total_tests += 1
try:
    from app.assets.resolver import DEFAULT_ASSET_ROOTS

    roots = [str(root) for root in DEFAULT_ASSET_ROOTS]

    # 检查是否只有前端路径
    has_backend = any('backend' in root and 'svg' in root for root in roots)
    has_frontend = any('frontend' in root and 'svg-assets' in root for root in roots)

    if has_frontend and not has_backend:
        print(f"  ✅ AssetResolver配置正确（只使用前端路径）")
        print(f"     路径: {roots}")
        success_count += 1
    elif has_backend:
        print(f"  ❌ AssetResolver仍包含后端路径")
        print(f"     路径: {roots}")
    else:
        print(f"  ❌ AssetResolver配置异常")
        print(f"     路径: {roots}")
except Exception as e:
    print(f"  ❌ 加载AssetResolver失败: {e}")

# 测试5: 检查URL生成函数
print("\n测试5: 检查URL生成函数")
total_tests += 1
try:
    from app.assets.resolver import AssetResolver

    resolver = AssetResolver()
    assets = resolver.list_assets()

    if assets:
        sample_asset = assets[0]
        url = sample_asset.public_url

        if url.startswith('/svg-assets/'):
            print(f"  ✅ URL格式正确: {url}")
            success_count += 1
        elif url.startswith('/api/assets/svg/'):
            print(f"  ❌ URL格式错误（仍使用旧格式）: {url}")
        else:
            print(f"  ⚠️ URL格式异常: {url}")
    else:
        print(f"  ❌ 无法加载任何资源")
except Exception as e:
    print(f"  ❌ 测试失败: {e}")

# 测试6: 检查main.py是否删除了静态文件挂载
print("\n测试6: 检查main.py静态文件挂载")
total_tests += 1
try:
    with open('backend/app/main.py', 'r') as f:
        main_content = f.read()

    has_svg_mount = 'app.mount("/api/assets/svg"' in main_content
    has_library_mount = 'app.mount("/api/assets/library"' in main_content

    if not has_svg_mount and not has_library_mount:
        print(f"  ✅ main.py已删除SVG静态文件挂载")
        success_count += 1
    else:
        print(f"  ❌ main.py仍包含SVG静态文件挂载")
        if has_svg_mount:
            print(f"     - 发现: app.mount('/api/assets/svg')")
        if has_library_mount:
            print(f"     - 发现: app.mount('/api/assets/library')")
except Exception as e:
    print(f"  ❌ 检查失败: {e}")

# 测试7: 测试资源解析
print("\n测试7: 测试资源解析")
total_tests += 1
try:
    from app.assets.resolver import AssetResolver

    resolver = AssetResolver()

    test_kinds = ['bird', 'cat', 'dog', 'laptop', 'tree']
    resolved_count = 0

    for kind in test_kinds:
        asset = resolver.resolve(kind)
        if asset:
            resolved_count += 1

    if resolved_count == len(test_kinds):
        print(f"  ✅ 所有测试kind都能成功解析 ({resolved_count}/{len(test_kinds)})")
        success_count += 1
    else:
        print(f"  ⚠️ 部分kind解析失败 ({resolved_count}/{len(test_kinds)})")
except Exception as e:
    print(f"  ❌ 测试失败: {e}")

# 总结
print("\n" + "=" * 70)
print("验证总结")
print("=" * 70 + "\n")

print(f"通过测试: {success_count}/{total_tests}")

if success_count == total_tests:
    print("\n🎉 SVG资源迁移完全成功！\n")
    print("资源位置:")
    print(f"  ✅ 前端: frontend/public/svg-assets/ (84个SVG)")
    print(f"  ✅ 后端: 已删除")
    print("\nURL格式:")
    print(f"  ✅ /svg-assets/{{path}}")
    print("\n下一步:")
    print("  1. 重启后端服务:")
    print("     pkill -f 'uvicorn app.main:app'")
    print("     cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload")
    print("")
    print("  2. 测试语音命令:")
    print("     - '画一只小鸟'")
    print("     - '画一只小猫'")
    print("     - '添加一台笔记本电脑'")
    print("")
    print("  3. 检查浏览器Network标签，SVG URL应该是:")
    print("     http://localhost:3000/svg-assets/animals/bird.svg")
    sys.exit(0)
else:
    print(f"\n⚠️ {total_tests - success_count} 个测试失败\n")
    print("请检查:")
    print("  1. 后端svg文件夹是否完全删除")
    print("  2. 前端svg-assets是否包含所有文件")
    print("  3. AssetResolver配置是否正确更新")
    print("  4. main.py的静态文件挂载是否已删除")
    sys.exit(1)
