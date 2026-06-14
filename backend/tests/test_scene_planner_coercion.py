import unittest

from app.scene.planner import ScenePlanner
from app.scene.schemas import ScenePlan


class ScenePlannerCoercionTest(unittest.TestCase):
    def test_coerces_wrapped_scene_payload(self):
        planner = ScenePlanner()
        payload = {
            "scene": {
                "title": "赛博朋克书房",
                "items": [
                    {
                        "type": "laptop",
                        "renderStrategy": "svg",
                        "position": {"x": 380, "y": 330},
                        "style": {},
                    }
                ],
            }
        }

        result = planner._coerce_scene_plan_payload(payload, "画一个赛博朋克书房")
        plan = ScenePlan.model_validate(result)

        self.assertEqual(plan.title, "赛博朋克书房")
        self.assertEqual(plan.scene_type, "cyberpunk_room")
        self.assertEqual(plan.objects[0].kind, "laptop")
        self.assertEqual(plan.objects[0].render_strategy, "svg")
        self.assertEqual(plan.objects[0].position.anchor, "custom")

    def test_coerces_raw_object_list(self):
        planner = ScenePlanner()
        payload = planner._extract_json('[{"name":"desk","position":{"anchor":"bottom"}},{"object":"cat"}]')

        result = planner._coerce_scene_plan_payload(payload, "画一个书房")
        plan = ScenePlan.model_validate(result)

        self.assertEqual(plan.scene_type, "study_room")
        self.assertEqual(len(plan.objects), 2)
        self.assertEqual(plan.objects[0].kind, "desk")
        self.assertEqual(plan.objects[1].kind, "cat")

    def test_extracts_markdown_wrapped_array(self):
        planner = ScenePlanner()
        payload = planner._extract_json('```json\n[{"name":"laptop"}]\n```')
        result = planner._coerce_scene_plan_payload(payload, "画一个赛博朋克书房")
        plan = ScenePlan.model_validate(result)

        self.assertEqual(plan.scene_type, "cyberpunk_room")
        self.assertEqual(plan.objects[0].kind, "laptop")


if __name__ == "__main__":
    unittest.main()
