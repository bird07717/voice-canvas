export function serializeCompactScene(input: {
  objects?: unknown[];
  groups?: unknown[];
}) {
  const objects = Array.isArray(input.objects) ? input.objects : [];
  const groups = Array.isArray(input.groups) ? input.groups : [];

  if (objects.length === 0 && groups.length === 0) {
    return "（画布为空）";
  }

  return [
    "对象：",
    ...objects.map((object, index) => `#${index + 1} ${JSON.stringify(object)}`),
    "组合体：",
    ...groups.map((group, index) => `grp_${index + 1} ${JSON.stringify(group)}`),
  ].join("\n");
}
