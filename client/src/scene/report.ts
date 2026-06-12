import type { ExecReport, OpResult } from "./types";

export function formatExecReport(report: ExecReport | null) {
  if (!report) {
    return "还没有执行操作";
  }

  const issues = report.results
    .filter((result) => result.status !== "ok")
    .map((result) => formatOpReason(result.reason));

  if (issues.length > 0) {
    return `${report.okCount} 个成功；${dedupe(issues).join("；")}`;
  }

  if (report.okCount === 0) {
    return "没有需要执行的操作";
  }

  return `${report.okCount} 个操作已执行`;
}

export function formatIssueReason(report: ExecReport) {
  const issue = report.results.find(
    (result): result is Extract<OpResult, { status: "skipped" | "failed" }> =>
      result.status !== "ok",
  );

  return issue ? formatOpReason(issue.reason) : "";
}

export function formatOpReason(reason: string) {
  if (reason.includes("No matching target objects")) {
    return "画布上没有找到要操作的对象";
  }

  if (reason.includes("Nothing to undo")) {
    return "现在没有可以撤销的步骤";
  }

  if (reason.includes("Nothing to redo")) {
    return "现在没有可以重做的步骤";
  }

  if (reason.includes("handled by the history store")) {
    return "这条历史操作已经由本地状态处理";
  }

  if (reason.includes("already exists")) {
    return "同名组合已经存在，已跳过重复创建";
  }

  return reason;
}

function dedupe(items: string[]) {
  return Array.from(new Set(items));
}
