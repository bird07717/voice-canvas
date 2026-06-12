import { mockResponses } from "../fixtures/mockResponses.js";
import type { ModelProvider, ParseInput, ParseResult } from "../types.js";

export class MockProvider implements ModelProvider {
  async parseInstruction(input: ParseInput): Promise<ParseResult> {
    const normalized = input.transcript.replace(/\s/g, "");

    if (matchesAny(normalized, ["撤销", "退回上一步"])) {
      return mockResponses.undo;
    }

    if (matchesAny(normalized, ["变成蓝色", "改成蓝色", "弄成蓝色"])) {
      return mockResponses.paintBlue;
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

    if (matchesAny(normalized, ["往左", "向左", "左移"])) {
      return mockResponses.moveLeft;
    }

    if (matchesAny(normalized, ["房子", "小房子"])) {
      return mockResponses.drawHouse;
    }

    if (matchesAny(normalized, ["红色的圆", "红圆", "画圆", "一个圆"])) {
      return mockResponses.drawRedCircle;
    }

    return mockResponses.fallback;
  }
}

function matchesAny(input: string, patterns: string[]) {
  return patterns.some((pattern) => input.includes(pattern));
}
