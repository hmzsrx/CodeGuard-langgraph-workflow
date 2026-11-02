import { motion } from "framer-motion";
import {
  Check,
  Circle,
  CircleAlert,
  Code2,
  FileCheck2,
  FileInput,
  FlaskConical,
  GitPullRequest,
  ListChecks,
  LoaderCircle,
  WandSparkles,
} from "lucide-react";
import type { WorkflowState, WorkflowStageId } from "../../types/workflow";
import { workflowStages } from "../../types/workflow";

const icons: Record<WorkflowStageId, typeof Circle> = {
  reading: FileInput,
  analysis: Code2,
  issues: ListChecks,
  fixes: WandSparkles,
  tests: FlaskConical,
  approval: GitPullRequest,
  applying: FileCheck2,
  completed: Check,
};

export function WorkflowTimeline({
  workflow,
  compact = false,
}: {
  workflow: WorkflowState;
  compact?: boolean;
}) {
  return (
    <div className={`workflow-list ${compact ? "workflow-compact" : ""}`}>
      {workflowStages.map((stage, index) => {
        const status = workflow[stage.id];
        const Icon = icons[stage.id];
        return (
          <motion.div
            key={stage.id}
            className={`workflow-step step-${status}`}
            title={`${stage.label}: ${status}`}
            initial={false}
            animate={{ opacity: status === "pending" ? 0.48 : 1 }}
            transition={{ duration: 0.25 }}
          >
            <div className="workflow-rail">
              <span className={`workflow-icon icon-${status}`}>
                {status === "completed" ? <Check size={14} /> :
                  status === "running" ? <LoaderCircle size={15} className="spin" /> :
                    status === "failed" ? <CircleAlert size={14} /> : <Icon size={14} />}
              </span>
              {index < workflowStages.length - 1 && <span className={`workflow-connector ${status === "completed" ? "connector-done" : ""}`} />}
            </div>
            <div className="workflow-label">
              <span>{stage.label}</span>
              {!compact && status === "running" && <small>In progress</small>}
              {!compact && status === "failed" && <small>Failed</small>}
            </div>
            {status === "running" && <span className="workflow-live">LIVE</span>}
            {status === "pending" && compact && <Circle size={12} className="pending-circle" />}
          </motion.div>
        );
      })}
    </div>
  );
}
