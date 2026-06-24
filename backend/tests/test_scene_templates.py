import unittest

from app.scene.executor import SceneCommandCompiler
from app.scene.templates import build_template_scene_plan, get_scene_manifest


def execute_template(text: str):
    plan = build_template_scene_plan(text)
    assert plan is not None
    return SceneCommandCompiler({"objects": [], "recentCommands": []}).execute(plan)


class SceneTemplateTest(unittest.TestCase):
    def test_scene_manifest_exports_template_aliases(self):
        manifest = get_scene_manifest()
        park = next(item for item in manifest if item["scene_type"] == "park")

        self.assertEqual(park["title"], "公园")
        self.assertEqual(park["render_mode"], "object_scene")
        self.assertIn("公园", park["aliases"])

    def test_birthday_card_excludes_broken_gift_asset(self):
        commands = execute_template("画一个生日贺卡")
        kinds = [(command.get("params") or {}).get("kind") for command in commands]

        self.assertNotIn("gift", kinds)
        self.assertIn("gift_box", kinds)

    def test_classroom_text_is_centered_on_blackboard(self):
        commands = execute_template("画一个教室")
        blackboard = next(
            command for command in commands
            if (command.get("params") or {}).get("kindLabel") == "黑板"
        )
        welcome_text = next(
            command for command in commands
            if (command.get("params") or {}).get("text") == "欢迎上课"
        )

        board_params = blackboard["params"]
        text_params = welcome_text["params"]
        board_center_x = board_params["x"] + board_params["width"] / 2
        board_center_y = board_params["y"] + board_params["height"] / 2
        text_center_x = text_params["x"] + text_params["width"] / 2
        text_center_y = text_params["y"] + text_params["height"] / 2

        self.assertEqual(text_params["align"], "center")
        self.assertEqual(text_params["verticalAlign"], "middle")
        self.assertAlmostEqual(text_center_x, board_center_x)
        self.assertAlmostEqual(text_center_y, board_center_y, delta=3)


if __name__ == "__main__":
    unittest.main()
