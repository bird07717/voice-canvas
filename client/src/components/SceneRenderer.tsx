import { Circle, Ellipse, Layer, Line, Rect, Stage, Text } from "react-konva";
import { getBBox } from "../scene/geometry";
import type { SceneObject, SceneState } from "../scene/types";

type SceneRendererProps = {
  scene: SceneState;
};

export function SceneRenderer({ scene }: SceneRendererProps) {
  return (
    <Stage width={scene.canvas.width} height={scene.canvas.height}>
      <Layer>
        {[...scene.objects]
          .sort((a, b) => a.z - b.z)
          .map((object) => (
            <ShapeNode key={object.id} object={object} />
          ))}
      </Layer>
    </Stage>
  );
}

function ShapeNode({ object }: { object: SceneObject }) {
  const sharedProps = {
    fill: object.style.fill ?? undefined,
    stroke: object.style.stroke ?? undefined,
    strokeWidth: object.style.strokeWidth,
    opacity: object.style.opacity,
  };

  switch (object.geometry.shape) {
    case "circle":
      return (
        <Circle
          x={object.geometry.x}
          y={object.geometry.y}
          radius={object.geometry.radius}
          {...sharedProps}
        />
      );
    case "rect":
      return (
        <Rect
          x={object.geometry.x - object.geometry.width / 2}
          y={object.geometry.y - object.geometry.height / 2}
          width={object.geometry.width}
          height={object.geometry.height}
          {...sharedProps}
        />
      );
    case "triangle":
      return (
        <Line
          x={object.geometry.x}
          y={object.geometry.y}
          points={[
            0,
            -object.geometry.height / 2,
            object.geometry.width / 2,
            object.geometry.height / 2,
            -object.geometry.width / 2,
            object.geometry.height / 2,
          ]}
          closed
          {...sharedProps}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          x={object.geometry.x}
          y={object.geometry.y}
          radiusX={object.geometry.radiusX}
          radiusY={object.geometry.radiusY}
          {...sharedProps}
        />
      );
    case "line":
      return (
        <Line
          x={object.geometry.x}
          y={object.geometry.y}
          points={object.geometry.points}
          stroke={object.style.stroke ?? object.style.fill ?? "#172033"}
          strokeWidth={object.style.strokeWidth || 4}
          opacity={object.style.opacity}
          lineCap="round"
        />
      );
    case "text": {
      const bbox = getBBox(object.geometry);

      return (
        <Text
          x={bbox.x}
          y={bbox.y}
          width={bbox.w}
          text={object.geometry.content}
          fontSize={object.geometry.fontSize}
          fill={object.style.fill ?? "#172033"}
          opacity={object.style.opacity}
          align="center"
        />
      );
    }
  }
}
