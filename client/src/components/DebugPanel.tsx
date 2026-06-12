import type { Operation } from "../scene/types";

type DebugPanelProps = {
  objectCount: number;
  canUndo: boolean;
  canRedo: boolean;
  lastReport: string;
  onApply: (operations: Operation[]) => void;
};

export function DebugPanel({
  objectCount,
  canUndo,
  canRedo,
  lastReport,
  onApply,
}: DebugPanelProps) {
  return (
    <section className="debug-panel" aria-labelledby="debug-title">
      <div>
        <p className="eyebrow">开发入口</p>
        <h2 id="debug-title">执行层调试</h2>
        <p className="panel-copy">
          这些按钮只用于本地验证，正式演示路径仍以语音为主。
        </p>
      </div>

      <div className="button-grid">
        <button type="button" onClick={() => onApply([createCircle()])}>
          画圆
        </button>
        <button type="button" onClick={() => onApply([createRect()])}>
          画方块
        </button>
        <button type="button" onClick={() => onApply([createTriangle()])}>
          画三角形
        </button>
        <button type="button" onClick={() => onApply([createLine()])}>
          画线
        </button>
        <button type="button" onClick={() => onApply([paintFocusedBlue()])}>
          改蓝
        </button>
        <button type="button" onClick={() => onApply([moveFocusedLeft()])}>
          左移
        </button>
        <button type="button" onClick={() => onApply([scaleFocusedUp()])}>
          放大
        </button>
        <button type="button" onClick={() => onApply([deleteFocused()])}>
          删除
        </button>
        <button type="button" disabled={!canUndo} onClick={() => onApply([{ op: "undo" }])}>
          撤销
        </button>
        <button type="button" disabled={!canRedo} onClick={() => onApply([{ op: "redo" }])}>
          重做
        </button>
        <button type="button" disabled={objectCount === 0} onClick={() => onApply([{ op: "clear" }])}>
          清空
        </button>
      </div>

      <div className="report-box" aria-live="polite">
        {lastReport}
      </div>
    </section>
  );
}

function createCircle(): Operation {
  return {
    op: "create",
    geometry: { shape: "circle", radius: 58 },
    style: { fill: "红", stroke: "黑", strokeWidth: 2 },
    position: { mode: "anchor", region: "center" },
    label: "红色的圆",
  };
}

function createRect(): Operation {
  return {
    op: "create",
    geometry: { shape: "rect", width: 112, height: 112 },
    style: { fill: "黄", stroke: "黑", strokeWidth: 2 },
    position: { mode: "anchor", region: "middle-right", dx: -160 },
    label: "黄色方块",
  };
}

function createTriangle(): Operation {
  return {
    op: "create",
    geometry: { shape: "triangle", width: 132, height: 112 },
    style: { fill: "绿", stroke: "黑", strokeWidth: 2 },
    position: { mode: "anchor", region: "middle-left", dx: 160 },
    label: "绿色三角形",
  };
}

function createLine(): Operation {
  return {
    op: "create",
    geometry: { shape: "line", points: [-80, 0, 80, 0] },
    style: { stroke: "蓝", strokeWidth: 6 },
    position: { mode: "anchor", region: "bottom-center", dy: -80 },
    label: "蓝色直线",
  };
}

function paintFocusedBlue(): Operation {
  return {
    op: "setStyle",
    targetIds: ["__focus__"],
    style: { fill: "蓝", stroke: "黑", strokeWidth: 2 },
  };
}

function moveFocusedLeft(): Operation {
  return {
    op: "transform",
    targetIds: ["__focus__"],
    action: { kind: "move", dx: -60, dy: 0 },
  };
}

function scaleFocusedUp(): Operation {
  return {
    op: "transform",
    targetIds: ["__focus__"],
    action: { kind: "scale", factor: 1.25 },
  };
}

function deleteFocused(): Operation {
  return {
    op: "delete",
    targetIds: ["__focus__"],
  };
}
