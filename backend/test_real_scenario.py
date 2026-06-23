#!/usr/bin/env python3
"""
测试真实场景下的第三层LLM调用
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

__test__ = False

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.services.llm_service import LLMService


async def test_scenarios():
    """测试多个真实场景"""

    db_url = 'postgresql+asyncpg://admin:postgres123@postgres:5432/voice_canvas'
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    test_cases = [
        "画一个赛博朋克风格的房间",
        "画一个图书馆",
        "画一个咖啡馆场景",
        "给我画一个生日贺卡",
        "画一个海边日落",
    ]

    async with async_session() as session:
        service = LLMService(db=session)

        print("=" * 70)
        print("真实场景测试")
        print("=" * 70)
        print()

        for i, text in enumerate(test_cases, 1):
            print(f"测试 {i}/{len(test_cases)}: {text}")
            print("-" * 70)

            try:
                result = await service.process_command(
                    user_id=1,
                    text=text,
                    canvas_context=None
                )

                route = result.get('llm_route', 'unknown')
                llm_used = result.get('llm_used', False)
                commands_count = len(result.get('commands', []))

                print(f"  路由: {route}")
                print(f"  LLM调用: {'是' if llm_used else '否'}")
                print(f"  命令数量: {commands_count}")

                if result.get('scene'):
                    scene = result['scene']
                    source = scene.get('source', 'unknown')
                    repaired = scene.get('repaired', False)
                    fallback_reason = scene.get('fallback_reason')

                    print(f"  场景来源: {source}")

                    if source == 'llm_svg_scene_fallback':
                        print(f"  ⚠️  使用了FALLBACK")
                        if fallback_reason:
                            print(f"  ⚠️  原因: {fallback_reason}")
                    elif repaired:
                        print(f"  ⚠️  首轮失败但已修复")
                    else:
                        print(f"  ✅ 正常生成")

                print()

            except Exception as e:
                print(f"  ❌ 错误: {type(e).__name__}: {str(e)}")
                print()

    await engine.dispose()

    print("=" * 70)
    print("测试完成")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(test_scenarios())
