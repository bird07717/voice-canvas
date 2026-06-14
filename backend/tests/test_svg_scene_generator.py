import unittest
from unittest.mock import AsyncMock, patch

from app.scene.svg_generator import SvgSceneGenerator


class SvgSceneGeneratorTest(unittest.IsolatedAsyncioTestCase):
    async def test_fallback_returns_sanitized_svg(self):
        generator = SvgSceneGenerator()
        result = generator.fallback("请设计一个未来感很强的图书馆")

        self.assertEqual(result.source, "llm_svg_scene_fallback")
        self.assertIn("<svg", result.svg)
        self.assertIn("viewBox='0 0 800 600'", result.svg)
        self.assertNotIn("<script", result.svg.lower())

    async def test_generate_falls_back_on_provider_failure(self):
        generator = SvgSceneGenerator()
        fake_config = type(
            "Config",
            (),
            {
                "api_key": "test",
                "base_url": "http://example.invalid",
                "model_name": "test-model",
            },
        )()

        with patch.object(generator, "_generate_svg", AsyncMock(side_effect=RuntimeError("boom"))):
            result = await generator.generate("请设计一个未来感很强的图书馆", None, fake_config)

        self.assertEqual(result.source, "llm_svg_scene_fallback")
        self.assertIn("<svg", result.svg)


if __name__ == "__main__":
    unittest.main()
