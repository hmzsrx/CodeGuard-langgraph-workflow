import { useCallback, useMemo, useRef, useState } from "react";
import type { ReviewHistoryItem, ReviewRecord } from "../types/review";
import { emptyWorkflow, loadHistory, saveHistory, toHistoryItem } from "../lib/utils";
import { startGraphReview, resumeGraphReview } from "../services/langgraph";
import { writeApprovedCode } from "../services/api";
import { useWorkflowStream } from "./useWorkflowStream";

export function useCodeReview() {
  const [history, setHistory] = useState<ReviewHistoryItem[]>(loadHistory);
  const [current, setCurrent] = useState<ReviewRecord | null>(null);
  const currentRef = useRef<ReviewRecord | null>(null);
  const activeStreams = useRef(0);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");

  const updateReview = useCallback(
    (update: (review: ReviewRecord) => ReviewRecord) => {
      const existing = currentRef.current;
      if (!existing) return;
      const next = update(existing);
      currentRef.current = next;
      setCurrent(next);
      const item = toHistoryItem(next);
      setHistory((previous) => {
        const updated = [item, ...previous.filter((entry) => entry.id !== item.id)];
        saveHistory(updated);
        return updated;
      });
    },
    [],
  );

  const onEvent = useWorkflowStream(updateReview);

  const runStream = useCallback(
    async (
      operation: (handleEvent: typeof onEvent) => Promise<void>,
      activeReviewId: string,
    ) => {
      activeStreams.current += 1;
      setBusy(true);
      setRequestError("");
      try {
        const handleActiveEvent: typeof onEvent = (event) => {
          if (currentRef.current?.id === activeReviewId) onEvent(event);
        };
        await operation(handleActiveEvent);
        const review =
          currentRef.current?.id === activeReviewId ? currentRef.current : null;
        if (
          review?.status === "running" &&
          review.workflow.applying === "running" &&
          review.sourceType === "upload" &&
          review.filePath
        ) {
          const result = await writeApprovedCode(review.threadId);
          if (!result.success) throw new Error(result.detail || "Could not write approved changes.");
          if (currentRef.current?.id === activeReviewId) {
            updateReview((value) => ({
              ...value,
              status: "completed",
              fileUpdated: true,
              backupPath: result.backup_path || "",
              workflow: {
                ...value.workflow,
                applying: "completed",
                completed: "completed",
              },
            }));
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "The review request failed.";
        if (currentRef.current?.id !== activeReviewId) return;
        setRequestError(message);
        updateReview((review) => {
          const workflow = { ...review.workflow };
          const activeStage = (
            Object.keys(workflow) as (keyof typeof workflow)[]
          ).find((stage) => workflow[stage] === "running");
          workflow[activeStage || "reading"] = "failed";
          return {
            ...review,
            status: "failed",
            errorMessage: message,
            workflow,
          };
        });
      } finally {
        activeStreams.current -= 1;
        setBusy(activeStreams.current > 0);
      }
    },
    [updateReview],
  );

  const startReview = useCallback(
    (file: File | null, originalFilePath: string) => {
      const id = crypto.randomUUID();
      const sourceType = file ? "upload" : "local_path";
      const filename =
        file?.name || originalFilePath.trim().split(/[\\/]/).pop() || "Code review";
      const review: ReviewRecord = {
        id,
        filename,
        filePath: originalFilePath.trim(),
        sourceType,
        createdAt: new Date().toISOString(),
        status: "running",
        threadId: "",
        originalCode: "",
        reviewFindings: "",
        fixedCode: "",
        fixExplanation: "",
        streamedReview: "",
        streamedFix: "",
        testResults: "",
        testsPassed: null,
        fileUpdated: false,
        backupPath: "",
        errorMessage: "",
        workflow: emptyWorkflow(),
      };
      currentRef.current = review;
      setCurrent(review);
      setRequestError("");
      const submit = (input: Parameters<typeof startGraphReview>[0]) => {
        void runStream(
          (handleEvent) => startGraphReview(input, handleEvent),
          id,
        );
      };
      if (!file) {
        submit({ file_path: originalFilePath.trim() });
        return;
      }
      void file.text().then((fileContent) => {
        if (currentRef.current?.id !== id) return;
        const next = { ...currentRef.current, originalCode: fileContent };
        currentRef.current = next;
        setCurrent(next);
        submit({
          file_content: fileContent,
          file_name: file.name,
          ...(originalFilePath.trim()
            ? { original_file_path: originalFilePath.trim() }
            : {}),
        });
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not read the selected file.";
        if (currentRef.current?.id !== id) return;
        setRequestError(message);
        updateReview((active) => ({
          ...active,
          status: "failed",
          errorMessage: message,
          workflow: { ...active.workflow, reading: "failed" },
        }));
      });
    },
    [runStream, updateReview],
  );

  const decide = useCallback(
    (approved: boolean, feedback = "") => {
      const activeReview = currentRef.current;
      if (!activeReview?.threadId) {
        setRequestError("The LangGraph thread ID is not available. Start a new review.");
        return;
      }
      const activeId = activeReview.id;
      void runStream(
        (handleEvent) =>
          resumeGraphReview(
            activeReview.threadId,
            { approved, ...(approved ? {} : { feedback }) },
            handleEvent,
          ),
        activeId,
      );
    },
    [runStream],
  );

  const selectHistory = useCallback(
    (id: string) => history.find((item) => item.id === id) || null,
    [history],
  );
  const clearCurrent = useCallback(() => {
    currentRef.current = null;
    setCurrent(null);
    setRequestError("");
  }, []);

  return useMemo(
    () => ({
      current,
      history,
      busy,
      requestError,
      startReview,
      decide,
      selectHistory,
      clearCurrent,
      clearRequestError: () => setRequestError(""),
    }),
    [current, history, busy, requestError, startReview, decide, selectHistory, clearCurrent],
  );
}
