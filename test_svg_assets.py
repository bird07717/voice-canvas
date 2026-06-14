#!/usr/bin/env python3
"""测试SVG资源加载和语音命中问题"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.assets.resolver import AssetResolver
from app.drawing.target_resolver import asset_index, find_asset_semantic

def test_asset_resolver():
    """测试AssetResolver是否能正确加载所有84个SVG"""
    print("=" * 60)
    print("测试 1: AssetResolver 加载资源")
    print("=" * 60)

    resolver = AssetResolver()
    assets = resolver.list_assets()

    print(f"\n✓ 总共找到 {len(assets)} 个SVG资源")

    if len(assets) != 84:
        print(f"⚠️  警告: 期望84个资源，实际找到{len(assets)}个")

    print("\n前10个资源的URL:")
    for i, asset in enumerate(assets[:10], 1):
        print(f"  {i}. {asset.asset_id}")
        print(f"     URL: {asset.public_url}")
        print(f"     文件存在: {asset.file_path.exists()}")

    # 检查是否有重复的asset_id
    asset_ids = [a.asset_id for a in assets]
    duplicates = [aid for aid in asset_ids if asset_ids.count(aid) > 1]
    if duplicates:
        print(f"\n⚠️  发现重复的asset_id: {set(duplicates)}")

    return assets

def test_semantic_matching():
    """测试语音命中逻辑"""
    print("\n" + "=" * 60)
    print("测试 2: 语音语义匹配")
    print("=" * 60)

    # 构建资产索引
    index = asset_index()
    print(f"\n✓ 语义索引包含 {len(index)} 个条目")

    # 测试一些常见的语音命令
    test_cases = [
        {"kind": "tree", "label": "树"},
        {"kind": "cloud", "label": "云"},
        {"kind": "house", "label": "房子"},
        {"kind": "flower", "label": "花"},
        {"kind": "car", "label": "汽车"},
        {"kind": "mountain", "label": "山"},
        {"kind": "sun", "label": "太阳"},
        {"kind": "dog", "label": "狗"},
        {"kind": "cat", "label": "猫"},
        {"kind": "balloon", "label": "气球"},
    ]

    print("\n测试常见语音命令的匹配:")
    success_count = 0
    for i, test in enumerate(test_cases, 1):
        obj = {"kind": test["kind"]}
        asset = find_asset_semantic(obj, test["kind"])

        if asset:
            print(f"  {i}. '{test['label']}' -> ✓ 匹配到 {asset.asset_id}")
            success_count += 1
        else:
            print(f"  {i}. '{test['label']}' -> ✗ 未匹配")

    print(f"\n匹配成功率: {success_count}/{len(test_cases)} ({success_count*100//len(test_cases)}%)")

    return success_count == len(test_cases)

def test_url_format():
    """测试URL格式是否正确"""
    print("\n" + "=" * 60)
    print("测试 3: URL格式检查")
    print("=" * 60)

    resolver = AssetResolver()
    assets = resolver.list_assets()

    url_issues = []
    for asset in assets:
        # 检查URL是否以/api/assets/svg/开头
        if not asset.public_url.startswith('/api/assets/svg/'):
            url_issues.append((asset.asset_id, asset.public_url))

    if url_issues:
        print(f"\n⚠️  发现 {len(url_issues)} 个URL格式问题:")
        for asset_id, url in url_issues[:5]:
            print(f"  - {asset_id}: {url}")
    else:
        print("\n✓ 所有URL格式正确")

    # 显示URL样例
    print("\nURL格式样例:")
    for asset in assets[:3]:
        print(f"  {asset.asset_id} -> {asset.public_url}")

    return len(url_issues) == 0

def test_manifest_consistency():
    """测试manifest.json是否与实际文件一致"""
    print("\n" + "=" * 60)
    print("测试 4: Manifest 一致性检查")
    print("=" * 60)

    import json
    from pathlib import Path

    manifest_path = Path(__file__).parent / "backend/app/assets/svg/manifest.json"

    if not manifest_path.exists():
        print("⚠️  manifest.json 不存在")
        return False

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    manifest_assets = manifest.get('assets', [])
    print(f"\n✓ Manifest包含 {len(manifest_assets)} 个资源定义")

    resolver = AssetResolver()
    actual_assets = resolver.list_assets()

    print(f"✓ 实际SVG文件 {len(actual_assets)} 个")

    # 检查是否有manifest中定义但文件不存在的
    manifest_ids = {a['asset_id'] for a in manifest_assets}
    actual_ids = {a.asset_id for a in actual_assets}

    missing_files = manifest_ids - actual_ids
    extra_files = actual_ids - manifest_ids

    if missing_files:
        print(f"\n⚠️  Manifest中定义但文件缺失: {len(missing_files)}个")
        for aid in list(missing_files)[:5]:
            print(f"  - {aid}")

    if extra_files:
        print(f"\n⚠️  存在文件但未在Manifest中定义: {len(extra_files)}个")
        for aid in list(extra_files)[:5]:
            print(f"  - {aid}")

    return len(missing_files) == 0 and len(extra_files) == 0

if __name__ == '__main__':
    print("\n🔍 开始诊断 Voice Canvas SVG资源问题\n")

    try:
        # 运行所有测试
        assets = test_asset_resolver()
        semantic_ok = test_semantic_matching()
        url_ok = test_url_format()
        manifest_ok = test_manifest_consistency()

        # 总结
        print("\n" + "=" * 60)
        print("诊断总结")
        print("=" * 60)

        if len(assets) == 84 and semantic_ok and url_ok and manifest_ok:
            print("\n✓ 所有测试通过！")
            print("\n可能的问题:")
            print("  1. 前端API_BASE_URL配置不正确")
            print("  2. 后端服务未正确启动")
            print("  3. CORS配置问题")
            print("  4. 浏览器控制台有具体的加载错误")
        else:
            print("\n⚠️  发现以下问题:")
            if len(assets) != 84:
                print(f"  - 资源数量不正确 (期望84，实际{len(assets)})")
            if not semantic_ok:
                print("  - 语音语义匹配失败")
            if not url_ok:
                print("  - URL格式不正确")
            if not manifest_ok:
                print("  - Manifest与实际文件不一致")

        print("\n建议排查步骤:")
        print("  1. 检查浏览器控制台的Network标签，查看SVG请求状态")
        print("  2. 检查前端.env中的VITE_API_URL配置")
        print("  3. 确认后端服务运行在正确的端口")
        print("  4. 测试直接访问: http://localhost:8000/api/assets/svg/nature/tree_deciduous.svg")

    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
