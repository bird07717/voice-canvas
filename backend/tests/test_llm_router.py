import unittest

from app.services.llm_router import classify_llm_route


class LLMRouterTest(unittest.TestCase):
    def test_template_scene_does_not_require_llm(self):
        decision = classify_llm_route("画一个公园")

        self.assertEqual(decision.route, "template_scene")
        self.assertFalse(decision.requires_llm)
        self.assertIsNotNone(decision.template_scene_plan)
        self.assertEqual(decision.template_scene_plan.scene_type, "park")

    def test_template_scene_patch_routes_to_llm_when_available(self):
        decision = classify_llm_route("画一个生日贺卡，写妈妈生日快乐", has_llm_config=True)

        self.assertEqual(decision.route, "template_scene_patch")
        self.assertTrue(decision.requires_llm)
        self.assertIsNotNone(decision.template_scene_plan)
        self.assertEqual(decision.template_scene_plan.scene_type, "birthday_card")

    def test_template_scene_patch_falls_back_without_llm(self):
        decision = classify_llm_route("画一个生日贺卡，写妈妈生日快乐", has_llm_config=False)

        self.assertEqual(decision.route, "template_scene")
        self.assertFalse(decision.requires_llm)
        self.assertIsNotNone(decision.template_scene_plan)

    def test_open_scene_routes_to_scene_planner(self):
        decision = classify_llm_route("画一幅赛博朋克书房，有猫和电脑")

        self.assertEqual(decision.route, "open_scene")
        self.assertTrue(decision.requires_llm)
        self.assertIsNone(decision.template_scene_plan)

    def test_open_room_scene_without_scene_word_routes_to_scene_planner(self):
        decision = classify_llm_route("画一个赛博朋克书房")

        self.assertEqual(decision.route, "open_scene")
        self.assertTrue(decision.requires_llm)
        self.assertIsNone(decision.template_scene_plan)

    def test_polite_open_room_scene_routes_to_scene_planner(self):
        for text in (
            "帮我画一个赛博朋克式的书房",
            "请帮我画一个赛博朋克式的书房",
            "给我画一个赛博朋克式的书房",
        ):
            with self.subTest(text=text):
                decision = classify_llm_route(text)
                self.assertEqual(decision.route, "open_scene")
                self.assertTrue(decision.requires_llm)
                self.assertIsNone(decision.template_scene_plan)

    def test_complex_non_scene_routes_to_tool_planner(self):
        decision = classify_llm_route("加一只戴帽子的小猫")

        self.assertEqual(decision.route, "tool_plan")
        self.assertTrue(decision.requires_llm)
        self.assertIsNone(decision.template_scene_plan)

    def test_edit_with_scene_keyword_uses_tool_planner(self):
        decision = classify_llm_route("把天空变紫")

        self.assertEqual(decision.route, "tool_plan")
        self.assertTrue(decision.requires_llm)
        self.assertIsNone(decision.template_scene_plan)


if __name__ == "__main__":
    unittest.main()
