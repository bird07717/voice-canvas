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

    def test_extracts_svg_from_markdown_response(self):
        generator = SvgSceneGenerator()
        content = "好的：\n```svg\n<svg viewBox='0 0 800 600'><rect width='800' height='600' fill='red'/></svg>\n```"

        svg = generator._sanitize_svg(generator._extract_svg(content))

        self.assertIn("<svg", svg)
        self.assertIn("<rect", svg)
        self.assertIn('viewBox="0 0 800 600"', svg)

    def test_extracts_svg_from_json_response(self):
        generator = SvgSceneGenerator()
        content = '{"svg":"<svg viewBox=\\\"0 0 800 600\\\"><circle cx=\\\"400\\\" cy=\\\"300\\\" r=\\\"80\\\" fill=\\\"blue\\\"/></svg>"}'

        svg = generator._sanitize_svg(generator._extract_svg(content))

        self.assertIn("<circle", svg)
        self.assertIn('cx="400"', svg)

    def test_extracts_html_escaped_svg(self):
        generator = SvgSceneGenerator()
        content = "&lt;svg viewBox='0 0 800 600'&gt;&lt;text x='400' y='300' text-anchor='middle'&gt;Hi&lt;/text&gt;&lt;/svg&gt;"

        svg = generator._sanitize_svg(generator._extract_svg(content))

        self.assertIn("<text", svg)
        self.assertIn(">Hi</text>", svg)

    def test_normalizes_uppercase_svg_tags(self):
        generator = SvgSceneGenerator()
        content = "<SVG viewBox='0 0 800 600'><RECT width='800' height='600' fill='green'/></SVG>"

        svg = generator._sanitize_svg(generator._extract_svg(content))

        self.assertIn("<svg", svg)
        self.assertIn("<rect", svg)

    def test_uses_reasoning_content_when_message_content_is_empty(self):
        generator = SvgSceneGenerator()
        message = type(
            "Message",
            (),
            {
                "content": "",
                "model_dump": lambda self: {
                    "reasoning_content": "<svg viewBox='0 0 800 600'><rect width='800' height='600'/></svg>"
                },
            },
        )()

        content = generator._extract_response_text(message)
        svg = generator._sanitize_svg(generator._extract_svg(content))

        self.assertIn("<rect", svg)

    def test_ignores_inline_svg_mentions_before_real_tag(self):
        generator = SvgSceneGenerator()
        content = "输出必须从 `<svg` 开始，以 `</svg>` 结束。<svg viewBox='0 0 800 600'><rect width='800' height='600'/></svg>"

        svg = generator._sanitize_svg(generator._extract_svg(content))

        self.assertIn("<rect", svg)


if __name__ == "__main__":
    unittest.main()
