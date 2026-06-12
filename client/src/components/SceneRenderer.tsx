import { useEffect, useRef, useState } from "react";
import { Circle, Ellipse, Layer, Line, Rect, Stage, Text } from "react-konva";
import { getBBox } from "../scene/geometry";
import type { SceneObject, SceneState } from "../scene/types";

type SceneRendererProps = {
  scene: SceneState;
};

export function SceneRenderer({ scene }: SceneRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({
    width: scene.canvas.width,
    height: scene.canvas.height,
    scale: 1,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateViewport = () => {
      const rect = container.getBoundingClientRect();
      const scale = Math.max(
        Math.min(rect.width / scene.canvas.width, rect.height / scene.canvas.height),
        0.1,
      );
      const next = {
        width: scene.canvas.width * scale,
        height: scene.canvas.height * scale,
        scale,
      };

      setViewport((current) =>
        Math.abs(current.width - next.width) < 0.5 &&
        Math.abs(current.height - next.height) < 0.5
          ? current
          : next,
      );
    };

    updateViewport();

    const observer = new ResizeObserver(updateViewport);
    observer.observe(container);
    window.addEventListener("resize", updateViewport);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateViewport);
    };
  }, [scene.canvas.height, scene.canvas.width]);

  return (
    <div className="scene-renderer" ref={containerRef}>
      <Stage
        width={viewport.width}
        height={viewport.height}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
      >
        <Layer>
          {[...scene.objects]
            .sort((a, b) => a.z - b.z)
            .map((object) => (
              <ShapeNode key={object.id} object={object} />
            ))}
        </Layer>
      </Stage>
    </div>
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
