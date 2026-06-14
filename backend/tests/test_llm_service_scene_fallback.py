import unittest
from unittest.mock import AsyncMock, patch

from app.services.llm_service import LLMService


class LLMServiceSceneFallbackTest(unittest.IsolatedAsyncioTestCase):
    async def test_open_scene_api_failure_returns_fallback_commands(self):
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

        with patch(
            "app.services.llm_service.ScenePlanner.plan",
            AsyncMock(side_effect=RuntimeError("provider unavailable")),
        ):
            result = await service.process_command(
                user_id=1,
                text="请设计一个未来感很强的图书馆",
                canvas_context={},
            )

        self.assertEqual(result["intent"], "draw")
        self.assertEqual(result["llm_route"], "open_scene")
        self.assertTrue(result["llm_used"])
        self.assertGreater(len(result["commands"]), 0)
        self.assertEqual(result["scene"]["source"], "llm_open_scene_fallback")
        self.assertEqual(result["scene"]["scene_type"], "library")


if __name__ == "__main__":
    unittest.main()
