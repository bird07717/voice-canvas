#!/usr/bin/env python3
"""
LLM第三层诊断脚本
用于检查为什么SVG场景生成总是失败
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from app.models.llm_config import LLMConfig
from app.scene.svg_generator import SvgSceneGenerator
from openai import AsyncOpenAI


async def main():
    print("=" * 60)
    print("第三层LLM诊断工具")
    print("=" * 60)
    print()

    # 1. 检查数据库配置
    print("步骤 1: 检查数据库中的LLM配置")
    print("-" * 60)

    db_url = 'postgresql+asyncpg://admin:postgres123@postgres:5432/voice_canvas'

    try:
        engine = create_async_engine(db_url, echo=False)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            # 检查表是否存在
            result = await session.execute(
                text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'llm_configs')")
            )
            table_exists = result.scalar()

            if not table_exists:
                print("❌ LLM配置表不存在！")
                print("   原因：数据库迁移可能没有运行")
                print("   解决：运行 alembic upgrade head")
                return

            # 查询所有配置
            result = await session.execute(select(LLMConfig))
            configs = result.scalars().all()

            if not configs:
                print("❌ 数据库中没有任何LLM配置！")
                print("   原因：用户没有配置LLM")
                print("   解决：在前端添加LLM配置（设置 -> LLM配置）")
                return

            print(f"✅ 找到 {len(configs)} 个LLM配置\n")

            active_config = None
            for i, config in enumerate(configs, 1):
                status = "✅ 激活" if config.is_active else "⚪ 未激活"
                print(f"配置 {i}: {status}")
                print(f"  - ID: {config.id}")
                print(f"  - 名称: {config.name}")
                print(f"  - 用户ID: {config.user_id}")
                print(f"  - 模型: {config.model_name}")
                print(f"  - Base URL: {config.base_url}")
                print(f"  - API Key: {'*' * 8 if config.api_key else '(空)'}")
                print()

                if config.is_active:
                    active_config = config

            if not active_config:
                print("❌ 没有激活的LLM配置！")
                print("   原因：所有配置的 is_active 都是 False")
                print("   解决：在前端激活一个配置")
                return

            print(f"✅ 当前激活配置: ID={active_config.id}, 模型={active_config.model_name}\n")

            # 2. 测试API连接
            print("步骤 2: 测试LLM API连接")
            print("-" * 60)

            try:
                client = AsyncOpenAI(
                    api_key=active_config.api_key,
                    base_url=active_config.base_url,
                    timeout=30.0
                )

                print(f"正在调用: {active_config.base_url}")
                print(f"模型: {active_config.model_name}")

                response = await client.chat.completions.create(
                    model=active_config.model_name,
                    messages=[
                        {"role": "user", "content": "请只回复: OK"}
                    ],
                    temperature=0,
                    max_tokens=50,
                    timeout=30.0
                )

                content = response.choices[0].message.content or ""
                finish_reason = response.choices[0].finish_reason

                print(f"✅ API连接成功")
                print(f"  - 返回内容: {content.strip()}")
                print(f"  - finish_reason: {finish_reason}\n")

            except Exception as e:
                print(f"❌ API连接失败: {type(e).__name__}")
                print(f"   错误详情: {str(e)}")
                print(f"   原因可能是：")
                print(f"   1. API密钥无效")
                print(f"   2. Base URL错误")
                print(f"   3. 网络无法连接")
                print(f"   4. 模型名称错误")
                return

            # 3. 测试SVG生成
            print("步骤 3: 测试SVG场景生成")
            print("-" * 60)

            try:
                generator = SvgSceneGenerator()
                print("正在生成测试SVG场景...")

                result = await generator.generate(
                    text="画一个简单的红色圆形",
                    canvas_context=None,
                    llm_config=active_config,
                )

                print(f"✅ SVG生成成功")
                print(f"  - 来源: {result.source}")
                print(f"  - 场景类型: {result.scene_type}")
                print(f"  - 标题: {result.title}")
                print(f"  - 是否修复: {result.repaired}")

                if result.fallback_reason:
                    print(f"  - ⚠️  Fallback原因: {result.fallback_reason}")

                if result.source == "llm_svg_scene_fallback":
                    print(f"\n❌ 使用了fallback，这是问题所在！")
                    print(f"   Fallback原因: {result.fallback_reason or '未知'}")
                elif result.repaired:
                    print(f"\n⚠️  首轮生成失败但修复成功")
                else:
                    print(f"\n✅ 第三层LLM正常工作！")

            except Exception as e:
                print(f"❌ SVG生成测试失败: {type(e).__name__}")
                print(f"   错误详情: {str(e)}")
                return

        await engine.dispose()

    except Exception as e:
        print(f"❌ 数据库连接失败: {type(e).__name__}")
        print(f"   错误详情: {str(e)}")
        print(f"   检查：")
        print(f"   1. PostgreSQL是否在运行")
        print(f"   2. 数据库连接字符串是否正确")
        return

    print("\n" + "=" * 60)
    print("诊断完成")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
