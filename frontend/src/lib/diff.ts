import { diffLines } from "diff";

export function codeChangeSummary(original: string, modified: string): {
  added: number;
  removed: number;
} {
  let added = 0;
  let removed = 0;
  for (const change of diffLines(original, modified)) {
    const lineCount = change.count ?? change.value.split("\n").filter(Boolean).length;
    if (change.added) added += lineCount;
    if (change.removed) removed += lineCount;
  }
  return { added, removed };
}
