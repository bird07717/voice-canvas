import unittest

from app.services.llm_router import classify_llm_route


class LLMRouterTest(unittest.TestCase):
    def assertNoHeavyRouteFields(self, decision):
        self.assertFalse(hasattr(decision, "template_scene_plan"))
        self.assertFalse(hasattr(decision, "simple_object_request"))

    def test_template_scene_does_not_require_llm(self):
        decision = classify_llm_route("画一个公园")

        self.assertEqual(decision.route, "template_scene")
        self.assertFalse(decision.requires_llm)
        self.assertEqual(decision.matched_scene_type, "park")
        self.assertEqual(decision.matched_scene_title, "公园")
        self.assertNoHeavyRouteFields(decision)

    def test_template_scene_patch_routes_to_llm_when_available(self):
        decision = classify_llm_route("画一个生日贺卡，写妈妈生日快乐", has_llm_config=True)

        self.assertEqual(decision.route, "template_scene_patch")
        self.assertTrue(decision.requires_llm)
        self.assertEqual(decision.matched_scene_type, "birthday_card")
        self.assertEqual(decision.matched_scene_title, "生日贺卡")
        self.assertNoHeavyRouteFields(decision)

    def test_template_scene_patch_falls_back_without_llm(self):
        decision = classify_llm_route("画一个生日贺卡，写妈妈生日快乐", has_llm_config=False)

        self.assertEqual(decision.route, "template_scene")
        self.assertFalse(decision.requires_llm)
        self.assertEqual(decision.matched_scene_type, "birthday_card")
        self.assertNoHeavyRouteFields(decision)

    def test_open_scene_routes_to_svg_scene_generator(self):
        decision = classify_llm_route("画一幅赛博朋克书房，有猫和电脑")

        self.assertEqual(decision.route, "open_scene")
        self.assertTrue(decision.requires_llm)
        self.assertIsNone(decision.matched_scene_type)
        self.assertNoHeavyRouteFields(decision)

    def test_open_room_scene_without_scene_word_routes_to_svg_scene_generator(self):
        decision = classify_llm_route("画一个赛博朋克书房")

        self.assertEqual(decision.route, "open_scene")
        self.assertTrue(decision.requires_llm)
        self.assertIsNone(decision.matched_scene_type)
        self.assertNoHeavyRouteFields(decision)

    def test_simple_asset_object_uses_local_route(self):
        for text in ("画一只小猫", "画一台电脑", "画一张桌子"):
            with self.subTest(text=text):
                decision = classify_llm_route(text, has_llm_config=False)
                self.assertEqual(decision.route, "local_object")
                self.assertFalse(decision.requires_llm)
                self.assertEqual(decision.matched_object_source, "svg_asset")
                self.assertIsNotNone(decision.matched_asset_id)
                self.assertNoHeavyRouteFields(decision)

    def test_simple_template_object_uses_local_route(self):
        decision = classify_llm_route("画一艘帆船", has_llm_config=False)

        self.assertEqual(decision.route, "local_object")
        self.assertFalse(decision.requires_llm)
        self.assertEqual(decision.matched_object_source, "template_object")
        self.assertEqual(decision.matched_object_kind, "sailboat")
        self.assertNoHeavyRouteFields(decision)

    def test_unknown_object_does_not_match_single_character_asset_alias(self):
        decision = classify_llm_route("画一个机器人", has_llm_config=True)

        self.assertEqual(decision.route, "open_scene")
        self.assertTrue(decision.requires_llm)
        self.assertIsNone(decision.matched_object_kind)
        self.assertNoHeavyRouteFields(decision)

    def test_polite_open_room_scene_routes_to_svg_scene_generator(self):
        for text in (
            "帮我画一个赛博朋克式的书房",
            "请帮我画一个赛博朋克式的书房",
            "给我画一个赛博朋克式的书房",
        ):
            with self.subTest(text=text):
                decision = classify_llm_route(text)
                self.assertEqual(decision.route, "open_scene")
                self.assertTrue(decision.requires_llm)
                self.assertIsNone(decision.matched_scene_type)
                self.assertNoHeavyRouteFields(decision)

    def test_complex_object_creation_routes_to_svg_scene_generator(self):
        decision = classify_llm_route("加一只戴帽子的小猫")

        self.assertEqual(decision.route, "open_scene")
        self.assertTrue(decision.requires_llm)
        self.assertIsNone(decision.matched_scene_type)
        self.assertNoHeavyRouteFields(decision)

    def test_general_draw_prompt_routes_to_open_scene(self):
        for text in (
            "帮我画一个赛博朋克式的书房",
            "请设计一个未来感很强的图书馆",
            "生成一个温馨的咖啡馆场景",
            "做一个有窗户和书架的房间",
            "画一个保存按钮的海报",
            "画一只龙",
            "画一个机器人",
            "添加一辆未来感很强的飞船",
        ):
            with self.subTest(text=text):
                decision = classify_llm_route(text)
                self.assertEqual(decision.route, "open_scene")
                self.assertTrue(decision.requires_llm)
                self.assertIsNone(decision.matched_scene_type)
                self.assertNoHeavyRouteFields(decision)

    def test_edit_with_scene_keyword_uses_tool_planner(self):
        decision = classify_llm_route("把天空变紫")

        self.assertEqual(decision.route, "tool_plan")
        self.assertTrue(decision.requires_llm)
        self.assertIsNone(decision.matched_scene_type)
        self.assertNoHeavyRouteFields(decision)


if __name__ == "__main__":
    unittest.main()
