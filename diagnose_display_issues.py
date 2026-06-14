#!/usr/bin/env python3
"""诊断哪些图形无法显示的问题"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.drawing.executor import DrawingExecutor, TEMPLATE_KINDS
from app.drawing.schemas import CreateObjectArgs, PositionSpec, SizeSpec
from app.assets.resolver import AssetResolver

def check_kind_resolution():
    """检查每个TEMPLATE_KIND是否能正确解析"""
    print("=" * 70)
    print("诊断: TEMPLATE_KINDS 的SVG资源匹配情况")
    print("=" * 70)

    executor = DrawingExecutor()
    resolver = AssetResolver()

    print(f"\nTEMPLATE_KINDS 中共有 {len(TEMPLATE_KINDS)} 个kind")
    print("\n检查每个kind的处理结果:\n")

    issues = []

    for kind in sorted(TEMPLATE_KINDS):
        # 测试创建对象
        args = CreateObjectArgs(
            kind=kind,
            description=f"一个{kind}",
            position=PositionSpec(x=400, y=300),
            size=SizeSpec(width=100, height=100),
            style=None,
            render_strategy=None
        )

        # 检查SVG资源是否存在
        asset = resolver.resolve(kind, args.description)

        # 检查实际会创建什么
        commands = executor._create_object(args)

        if commands and len(commands) > 0:
            cmd = commands[0]
            cmd_type = cmd.get('type')

            if asset:
                if cmd_type == 'image':
                    status = "✓ SVG优先"
                    url = cmd.get('params', {}).get('imageUrl', 'N/A')
                    print(f"  {kind:15} → {status:15} URL: {url}")
                elif cmd_type == 'group':
                    status = "⚠️ 使用template"
                    print(f"  {kind:15} → {status:15} (有SVG但用了template)")
                    issues.append((kind, "有SVG资源但使用了template"))
                else:
                    status = f"? {cmd_type}"
                    print(f"  {kind:15} → {status}")
                    issues.append((kind, f"未知类型: {cmd_type}"))
            else:
                if cmd_type == 'group':
                    status = "✓ template回退"
                    print(f"  {kind:15} → {status:15} (无SVG，使用template)")
                elif cmd_type == 'text':
                    status = "⚠️ 占位符"
                    print(f"  {kind:15} → {status:15} (无SVG，无template)")
                    issues.append((kind, "既无SVG也无template实现"))
                else:
                    status = f"? {cmd_type}"
                    print(f"  {kind:15} → {status}")
                    issues.append((kind, f"未知类型: {cmd_type}"))
        else:
            print(f"  {kind:15} → ✗ 创建失败")
            issues.append((kind, "创建命令失败"))

    if issues:
        print(f"\n⚠️ 发现 {len(issues)} 个潜在问题:")
        for kind, issue in issues:
            print(f"  - {kind}: {issue}")
    else:
        print("\n✓ 所有TEMPLATE_KINDS都能正确处理")

    return len(issues) == 0

def check_svg_vs_template_conflict():
    """检查SVG和template的冲突情况"""
    print("\n" + "=" * 70)
    print("诊断: SVG资源与TEMPLATE的冲突")
    print("=" * 70)

    resolver = AssetResolver()
    assets = resolver.list_assets()

    # 找出kind在TEMPLATE_KINDS中，但也有SVG资源的情况
    conflicts = []
    for asset in assets:
        if asset.kind in TEMPLATE_KINDS:
            conflicts.append(asset)

    print(f"\n找到 {len(conflicts)} 个同时存在SVG和template的kind:\n")
    for asset in conflicts:
        print(f"  - {asset.kind:15} SVG: {asset.asset_id}")

    if conflicts:
        print("\n这些kind会优先使用SVG资源（新的优先级逻辑）")

    return conflicts

def check_missing_templates():
    """检查缺少template实现的kind"""
    print("\n" + "=" * 70)
    print("诊断: 缺少template实现的kind")
    print("=" * 70)

    executor = DrawingExecutor()
    resolver = AssetResolver()

    missing = []
    for kind in sorted(TEMPLATE_KINDS):
        method_name = f"_template_{kind}"
        has_template = hasattr(executor, method_name)
        has_svg = resolver.resolve(kind) is not None

        if not has_template and not has_svg:
            missing.append(kind)
            print(f"  ✗ {kind:15} - 既无template方法也无SVG资源")
        elif not has_template:
            print(f"  ⚠️ {kind:15} - 无template方法，依赖SVG资源")
        elif not has_svg:
            print(f"  ℹ️ {kind:15} - 有template方法，无SVG资源")
        else:
            print(f"  ✓ {kind:15} - 既有template又有SVG（SVG优先）")

    if missing:
        print(f"\n⚠️ 发现 {len(missing)} 个kind既无template也无SVG")
        print("这些kind会显示为占位符文字")

    return missing

def check_url_format():
    """检查SVG URL格式"""
    print("\n" + "=" * 70)
    print("诊断: SVG URL格式检查")
    print("=" * 70)

    resolver = AssetResolver()
    assets = resolver.list_assets()

    url_issues = []
    for asset in assets[:10]:  # 只检查前10个
        if not asset.public_url.startswith('/api/assets/svg/'):
            url_issues.append((asset.asset_id, asset.public_url))

    if url_issues:
        print(f"\n⚠️ 发现URL格式问题:")
        for asset_id, url in url_issues:
            print(f"  - {asset_id}: {url}")
    else:
        print("\n✓ URL格式正确")
        print(f"\n示例URL (前5个):")
        for asset in assets[:5]:
            print(f"  {asset.asset_id:30} → {asset.public_url}")

    return len(url_issues) == 0

if __name__ == '__main__':
    print("\n🔍 诊断图形无法显示的问题\n")

    try:
        # 运行所有诊断
        result1 = check_kind_resolution()
        conflicts = check_svg_vs_template_conflict()
        missing = check_missing_templates()
        result2 = check_url_format()

        print("\n" + "=" * 70)
        print("诊断总结")
        print("=" * 70)

        if result1 and not missing and result2:
            print("\n✓ 未发现明显问题")
            print("\n如果仍有图形无法显示，请检查:")
            print("  1. 浏览器控制台的Network标签 - 查看SVG请求状态")
            print("  2. 浏览器控制台的Console标签 - 查看JavaScript错误")
            print("  3. 后端是否已重启")
            print("  4. 前端VITE_API_URL配置是否正确")
        else:
            print("\n发现以下问题:")
            if not result1:
                print("  ✗ 某些kind的处理逻辑有问题")
            if missing:
                print(f"  ✗ {len(missing)} 个kind既无template也无SVG")
            if not result2:
                print("  ✗ SVG URL格式有问题")

            print("\n建议:")
            if missing:
                print(f"  - 为这些kind添加SVG资源或template实现: {', '.join(missing)}")

        if conflicts:
            print(f"\nℹ️ {len(conflicts)} 个kind同时有SVG和template")
            print("  当前逻辑: SVG优先，template作为回退")
            print("  如果SVG加载失败，前端会显示灰色占位符")

    except Exception as e:
        print(f"\n❌ 诊断过程出错: {e}")
        import traceback
        traceback.print_exc()
