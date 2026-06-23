import unittest
from unittest.mock import AsyncMock, patch

from app.services.llm_service import LLMService


class LLMServiceSvgSceneTest(unittest.IsolatedAsyncioTestCase):
    async def test_local_asset_object_does_not_require_llm_config(self):
        service = LLMService()
        service.get_active_config = AsyncMock(return_value=None)

        result = await service.process_command(
            user_id=1,
            text="画一只小猫",
            canvas_context={},
        )

        self.assertEqual(result["intent"], "draw")
        self.assertEqual(result["llm_route"], "local_object")
        self.assertFalse(result["llm_used"])
        self.assertEqual(result["commands"][0]["type"], "image")
        self.assertEqual(result["commands"][0]["params"]["assetSource"], "svg")
        self.assertIn("/svg-assets/animals/cat.svg", result["commands"][0]["params"]["imageUrl"])

    async def test_open_scene_returns_svg_image_command(self):
        service = LLMService()
        service.get_active_config = AsyncMock(
            return_value=type(
                "Config",
                (),
                {
                    "api_key": "test",
                    "base_url": "http://example.invalid",
                    "model_name": "test-model",
                },
            )()
        )

        fake_svg_scene = type(
            "SvgScene",
            (),
            {
                "scene_type": "library",
                "title": "未来图书馆",
                "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'><rect width='800' height='600' fill='#fff'/></svg>",
                "response": "好的，我生成了未来图书馆。",
                "style": "svg",
                "source": "llm_svg_scene",
                "layout_notes": "直接 SVG 场景生成",
            },
        )()

        with patch(
            "app.services.llm_service.SvgSceneGenerator.generate",
            AsyncMock(return_value=fake_svg_scene),
        ):
            result = await service.process_command(
                user_id=1,
                text="请设计一个未来感很强的图书馆",
                canvas_context={},
            )

        self.assertEqual(result["intent"], "draw")
        self.assertEqual(result["llm_route"], "open_scene")
        self.assertEqual(result["scene"]["source"], "llm_svg_scene")
        self.assertEqual(result["scene"]["object_count"], 1)
        self.assertEqual(result["commands"][0]["type"], "image")
        self.assertTrue(result["commands"][0]["params"]["imageUrl"].startswith("data:image/svg+xml;base64,"))
        self.assertIn("rawSvg", result["commands"][0]["params"])


if __name__ == "__main__":
    unittest.main()
