import { mockResponses } from "../fixtures/mockResponses.js";
import type { ModelProvider, ParseInput, ParseResult } from "../types.js";

export class MockProvider implements ModelProvider {
  async parseInstruction(input: ParseInput): Promise<ParseResult> {
    const normalized = input.transcript.replace(/\s/g, "");

    if (matchesAny(normalized, ["撤销", "退回上一步"])) {
      return mockResponses.undo;
    }

    if (matchesAny(normalized, ["清空", "清除画布", "全部删掉", "删除全部", "删掉全部"])) {
      return mockResponses.clearCanvas;
    }

    if (matchesAny(normalized, ["第十个", "第10个"])) {
      return mockResponses.deleteMissingObject;
    }

    if (
      matchesAny(normalized, ["那个东西", "这个东西", "那东西", "它"]) &&
      matchesAny(normalized, ["弄红", "变红", "改红", "红色"]) &&
      countSceneObjects(input) > 1
    ) {
      return createAmbiguousClarify(input);
    }

    if (matchesAny(normalized, ["变成蓝色", "改成蓝色", "弄成蓝色"])) {
      return mockResponses.paintBlue;
    }

    if (matchesAny(normalized, ["刚才", "上一个"]) && matchesAny(normalized, ["绿色", "绿"])) {
      return mockResponses.paintLastGreen;
    }

    if (matchesAny(normalized, ["最大的", "最大"]) && matchesAny(normalized, ["删除", "删掉"])) {
      return mockResponses.deleteLargest;
    }

    if (matchesAny(normalized, ["变大", "放大", "大一点"])) {
      return mockResponses.scaleCurrentUp;
    }

    if (matchesAny(normalized, ["房子左边", "房子的左边", "房子旁边"])) {
      return mockResponses.circleLeftOfHouse;
    }

    if (matchesAny(normalized, ["3x3", "三乘三", "网格"])) {
      return mockResponses.drawGridCircles;
    }

    if (matchesAny(normalized, ["五个", "5个", "五只", "一排"])) {
      return mockResponses.drawFiveCircles;
    }

    if (matchesAny(normalized, ["三个", "3个", "三只"])) {
      return mockResponses.drawThreeCircles;
    }

    if (matchesAny(normalized, ["往左", "向左", "左移"])) {
      return mockResponses.moveLeft;
    }

    if (matchesAny(normalized, ["房子", "小房子"])) {
      return mockResponses.drawHouse;
    }

    if (matchesAny(normalized, ["红色的圆", "红圆", "画圆", "一个圆", "画个圆", "画一个元", "画个元"])) {
      return mockResponses.drawRedCircle;
    }

    return mockResponses.fallback;
  }
}

function matchesAny(input: string, patterns: string[]) {
  return patterns.some((pattern) => input.includes(pattern));
}

function countSceneObjects(input: ParseInput) {
  return Array.isArray(input.scene?.objects) ? input.scene.objects.length : 0;
}

function createAmbiguousClarify(input: ParseInput): ParseResult {
  const objects = Array.isArray(input.scene?.objects) ? input.scene.objects : [];
  const options = objects.slice(0, 4).map((object, index) => {
    if (typeof object === "object" && object && "label" in object) {
      const label = (object as { label?: unknown }).label;
      if (typeof label === "string" && label.trim()) {
        return label;
      }
    }

    return `对象${index + 1}`;
  });

  return {
    ...mockResponses.clarifyAmbiguousObject,
    clarify: {
      question: `画布上有多个对象，你是指${options.join("，还是")}？`,
      options,
    },
  };
}
