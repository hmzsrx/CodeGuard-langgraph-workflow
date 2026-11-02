import type { ReviewRecord } from "../types/review";
import type { FinalState, StreamEvent, WorkflowStageId } from "../types/workflow";

type UpdateReview = (update: (review: ReviewRecord) => ReviewRecord) => void;

const stageIds: WorkflowStageId[] = [
  "reading",
  "analysis",
  "issues",
  "fixes",
  "tests",
  "approval",
  "applying",
  "completed",
];

function failRunningStage(review: ReviewRecord): ReviewRecord {
  const workflow = { ...review.workflow };
  const active = stageIds.find((stage) => workflow[stage] === "running");
  if (active) workflow[active] = "failed";
  return { ...review, workflow };
}

function applyFinalState(review: ReviewRecord, state: FinalState): ReviewRecord {
  return {
    ...review,
    errorMessage: state.error_message || review.errorMessage,
    reviewFindings: state.review_findings || review.reviewFindings,
    fixedCode: state.fixed_code || review.fixedCode,
    fixExplanation: state.fix_explanation || review.fixExplanation,
    testResults: state.test_results || review.testResults,
    testsPassed: state.tests_passed ?? review.testsPassed,
    fileUpdated: state.file_updated ?? review.fileUpdated,
    backupPath: state.backup_path || review.backupPath,
    filePath:
      review.sourceType === "local_path" ? state.file_path || review.filePath : review.filePath,
    originalCode: state.original_code || review.originalCode,
  };
}

function completeBefore(review: ReviewRecord, index: number): void {
  stageIds.slice(0, index).forEach((stage) => {
    if (review.workflow[stage] !== "failed") review.workflow[stage] = "completed";
  });
  if (review.workflow[stageIds[index]] !== "completed") {
    review.workflow[stageIds[index]] = "running";
  }
}

export function useWorkflowStream(updateReview: UpdateReview) {
  return (event: StreamEvent): void => {
    updateReview((current) => {
      if (event.event === "config") {
        const data = event.data as { thread_id?: string };
        const workflow = { ...current.workflow };
        if (current.status === "running" && workflow.reading === "pending") {
          workflow.reading = "running";
        }
        return { ...current, threadId: data.thread_id || current.threadId, workflow };
      }

      if (event.event === "token") {
        const data = event.data as { node?: string; content?: string };
        const node = data.node || "";
        const workflow = { ...current.workflow };
        if (node.includes("code_reviewer")) {
          completeBefore({ ...current, workflow }, 2);
          return {
            ...current,
            workflow,
            streamedReview: current.streamedReview + (data.content || ""),
          };
        }
        if (node.includes("code_fixer")) {
          completeBefore({ ...current, workflow }, 3);
          return {
            ...current,
            workflow,
            streamedFix: current.streamedFix + (data.content || ""),
          };
        }
        return { ...current, workflow };
      }

      if (event.event === "node_start") {
        const data = event.data as { node?: string };
        const node = data.node || "";
        const workflow = { ...current.workflow };
        if (node.includes("analyze_code")) {
          completeBefore({ ...current, workflow }, 2);
        } else if (node.includes("fix_code")) {
          completeBefore({ ...current, workflow }, 3);
        }
        return { ...current, workflow };
      }

      if (event.event === "update") {
        const data = event.data as {
          node?: string;
          update?: Record<string, unknown>;
        };
        const node = data.node || "";
        const update = data.update || {};
        let next: ReviewRecord = {
          ...current,
          reviewFindings:
            typeof update.review_findings === "string"
              ? update.review_findings
              : current.reviewFindings,
          fixedCode:
            typeof update.fixed_code === "string" ? update.fixed_code : current.fixedCode,
          fixExplanation:
            typeof update.fix_explanation === "string"
              ? update.fix_explanation
              : current.fixExplanation,
          testResults:
            typeof update.test_results === "string" ? update.test_results : current.testResults,
          testsPassed:
            typeof update.tests_passed === "boolean"
              ? update.tests_passed
              : current.testsPassed,
          fileUpdated:
            typeof update.file_updated === "boolean"
              ? update.file_updated
              : current.fileUpdated,
          backupPath:
            typeof update.backup_path === "string" && update.backup_path
              ? update.backup_path
              : current.backupPath,
          filePath:
            current.sourceType === "local_path" &&
            typeof update.file_path === "string" &&
            update.file_path
              ? update.file_path
              : current.filePath,
          originalCode:
            typeof update.original_code === "string"
              ? update.original_code
              : current.originalCode,
          errorMessage:
            typeof update.error_message === "string" && update.error_message
              ? update.error_message
              : current.errorMessage,
        };
        const workflow = { ...next.workflow };
        next.workflow = workflow;
        if (node === "file_reader") {
          workflow.reading = update.error_message ? "failed" : "completed";
          if (!update.error_message) workflow.analysis = "running";
        } else if (node === "code_reviewer" || node === "analyze_code") {
          workflow.analysis = update.error_message ? "failed" : "completed";
          workflow.issues = update.error_message ? "failed" : "completed";
          if (!update.error_message) workflow.fixes = "running";
        } else if (node === "code_fixer" || node === "fix_code") {
          workflow.fixes = update.error_message ? "failed" : "completed";
          if (!update.error_message) workflow.tests = "running";
        } else if (node === "test_agent" || node === "test_code") {
          workflow.tests =
            update.error_message || update.tests_passed === false ? "failed" : "completed";
          if (update.tests_passed === true) workflow.approval = "running";
        } else if (node === "final_approval") {
          if (update.approval_status === "approved") {
            workflow.approval = "completed";
            workflow.applying = "running";
          } else if (update.approval_status === "rejected") {
            workflow.approval = "completed";
            workflow.analysis = "running";
          }
        }
        if (typeof update.error_message === "string" && update.error_message) {
          next = failRunningStage(next);
          next.status = "failed";
        } else if (update.approval_status === "rejected") {
          next.status = "revision_requested";
        }
        return next;
      }

      if (event.event === "interrupt") {
        const state = event.data as FinalState;
        const next = applyFinalState(current, state);
        const workflow = { ...next.workflow };
        stageIds.slice(0, 5).forEach((stage) => {
          if (workflow[stage] !== "failed") workflow[stage] = "completed";
        });
        workflow.approval = "running";
        workflow.applying = "pending";
        workflow.completed = "pending";
        return {
          ...next,
          status: "awaiting_approval",
          workflow,
        };
      }

      if (event.event === "end") {
        const state = event.data as FinalState;
        let next = applyFinalState(current, state);
        if (state.error_message) {
          next = failRunningStage(next);
          return { ...next, status: "failed" };
        }
        if (state.approval_status === "approved") {
          if (state.file_updated && (current.sourceType === "local_path" || !current.filePath)) {
            next.workflow = {
              ...next.workflow,
              approval: "completed",
              applying: "completed",
              completed: "completed",
            };
            return { ...next, status: "completed" };
          }
          return { ...next, status: "running" };
        }
        if (current.status === "running" && state.tests_passed === true) {
          next.workflow = {
            ...next.workflow,
            reading: "completed",
            analysis: "completed",
            issues: "completed",
            fixes: "completed",
            tests: "completed",
            approval: "running",
          };
          return { ...next, status: "awaiting_approval" };
        }
        if (current.status === "awaiting_approval") {
          return { ...next, status: "awaiting_approval" };
        }
        if (state.tests_passed === false) {
          next.workflow = { ...next.workflow, tests: "failed" };
          return { ...next, status: "failed" };
        }
        if (state.approval_status === "rejected") {
          return { ...next, status: "revision_requested" };
        }
        return next;
      }
      return current;
    });
  };
}
