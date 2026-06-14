#!/usr/bin/env python3
"""快速验证SVG资源修复效果"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_kind_aliases():
    """测试KIND_ALIASES是否扩充成功"""
    from app.drawing.target_resolver import KIND_ALIASES

    print("=" * 60)
    print("测试1: KIND_ALIASES 扩充验证")
    print("=" * 60)
    print(f"\n别名总数: {len(KIND_ALIASES)}")

    # 测试一些关键别名
    test_cases = [
        ("小猫", "cat"),
        ("小狗", "dog"),
        ("小鸟", "bird"),
        ("蝴蝶", "butterfly"),
        ("笔记本电脑", "laptop"),
        ("台式电脑", "computer_desktop"),
        ("手机", "phone"),
        ("灯笼", "lantern_chinese"),
        ("雪人", "snowman"),
        ("烟花", "firework"),
        ("书桌", "table_desk"),
        ("沙发", "sofa"),
        ("气球", "balloon"),
        ("礼物", "gift"),
    ]

    success = 0
    for chinese, expected_kind in test_cases:
        actual_kind = KIND_ALIASES.get(chinese)
        if actual_kind == expected_kind:
            print(f"✓ '{chinese}' -> '{actual_kind}'")
            success += 1
        else:
            print(f"✗ '{chinese}' -> '{actual_kind}' (期望: '{expected_kind}')")

    print(f"\n测试通过: {success}/{len(test_cases)}")
    return success == len(test_cases)

def test_normalize_integration():
    """测试_normalize_template_kind是否正确引用KIND_ALIASES"""
    from app.drawing.executor import DrawingExecutor

    print("\n" + "=" * 60)
    print("测试2: normalize方法集成验证")
    print("=" * 60)

    executor = DrawingExecutor()

    test_cases = [
        ("树", "tree"),
        ("小猫", "cat"),
        ("汽车", "car"),
        ("房子", "house"),
        ("太阳", "sun"),
        ("笔记本电脑", "laptop"),
        ("灯笼", "lantern_chinese"),
    ]

    success = 0
    for chinese, expected in test_cases:
        result = executor._normalize_template_kind(chinese)
        if result == expected:
            print(f"✓ normalize('{chinese}') -> '{result}'")
            success += 1
        else:
            print(f"✗ normalize('{chinese}') -> '{result}' (期望: '{expected}')")

    print(f"\n测试通过: {success}/{len(test_cases)}")
    return success == len(test_cases)

def test_asset_resolution():
    """测试SVG资源是否能被正确解析"""
    from app.assets.resolver import AssetResolver

    print("\n" + "=" * 60)
    print("测试3: SVG资源解析验证")
    print("=" * 60)

    resolver = AssetResolver()

    test_cases = [
        ("tree", "应该找到树的SVG"),
        ("cat", "应该找到猫的SVG"),
        ("dog", "应该找到狗的SVG"),
        ("laptop", "应该找到笔记本电脑的SVG"),
        ("lantern_chinese", "应该找到灯笼的SVG"),
        ("snowman", "应该找到雪人的SVG"),
    ]

    success = 0
    for kind, description in test_cases:
        asset = resolver.resolve(kind)
        if asset:
            print(f"✓ '{kind}' -> {asset.asset_id} ({asset.label})")
            success += 1
        else:
            print(f"✗ '{kind}' -> 未找到资源")

    print(f"\n测试通过: {success}/{len(test_cases)}")
    return success == len(test_cases)

def test_create_object_priority():
    """测试对象创建优先级"""
    from app.drawing.executor import DrawingExecutor
    from app.drawing.schemas import CreateObjectArgs, PositionSpec, SizeSpec

    print("\n" + "=" * 60)
    print("测试4: 对象创建优先级验证")
    print("=" * 60)

    executor = DrawingExecutor()

    # 测试: tree有SVG资源，应该优先使用SVG而不是template
    args = CreateObjectArgs(
        kind="tree",
        description="一棵树",
        position=PositionSpec(x=400, y=300),
        size=SizeSpec(width=100, height=150),
        style=None,
        render_strategy=None
    )

    commands = executor._create_object(args)

    if commands and len(commands) > 0:
        command = commands[0]
        if command.get("type") == "image":
            print(f"✓ 'tree' 创建为 image 类型 (使用SVG)")
            print(f"  URL: {command.get('params', {}).get('imageUrl')}")
            return True
        elif command.get("type") == "group":
            print(f"✗ 'tree' 创建为 group 类型 (使用template)")
            print(f"  应该优先使用SVG资源")
            return False
        else:
            print(f"? 'tree' 创建为 {command.get('type')} 类型")
            return False
    else:
        print("✗ 未能创建对象")
        return False

if __name__ == '__main__':
    print("\n🔍 SVG资源修复验证测试\n")

    results = []

    try:
        results.append(("KIND_ALIASES扩充", test_kind_aliases()))
        results.append(("normalize方法集成", test_normalize_integration()))
        results.append(("SVG资源解析", test_asset_resolution()))
        results.append(("对象创建优先级", test_create_object_priority()))

        print("\n" + "=" * 60)
        print("测试总结")
        print("=" * 60)

        passed = sum(1 for _, result in results if result)
        total = len(results)

        for name, result in results:
            status = "✓ 通过" if result else "✗ 失败"
            print(f"{status} - {name}")

        print(f"\n总计: {passed}/{total} 测试通过")

        if passed == total:
            print("\n🎉 所有测试通过！修复成功！")
            print("\n下一步:")
            print("1. 重启后端服务以应用更改")
            print("2. 在前端测试语音命令")
            print("3. 检查浏览器控制台确认SVG加载成功")
        else:
            print("\n⚠️ 部分测试失败，请检查代码修改")

        sys.exit(0 if passed == total else 1)

    except Exception as e:
        print(f"\n❌ 测试过程中出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
