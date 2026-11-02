import { API_BASE_URL } from "./api";
import type { StreamEvent } from "../types/workflow";

type EventHandler = (event: StreamEvent) => void;

function decodeBlock(block: string): StreamEvent | null {
  let eventName = "";
  let dataText = "";
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    if (line.startsWith("data:")) dataText += line.slice(5).trim();
  }
  if (!eventName || !dataText) return null;

  const payload = JSON.parse(dataText) as { event?: string; data?: unknown };
  return {
    event: payload.event || eventName,
    data: payload.data,
  } as StreamEvent;
}

async function consumeStream(
  response: Response,
  onEvent: EventHandler,
): Promise<void> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      message = body.detail || message;
    } catch {
      // Retain the status message for non-JSON responses.
    }
    throw new Error(message);
  }
  if (!response.body) throw new Error("The server did not return an event stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        const event = decodeBlock(block);
        if (event) onEvent(event);
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const event = decodeBlock(buffer);
      if (event) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function startGraphReview(
  input:
    | {
        file_content: string;
        file_name: string;
        original_file_path?: string;
      }
    | { file_path: string },
  onEvent: EventHandler,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await consumeStream(response, onEvent);
}

export async function resumeGraphReview(
  threadId: string,
  decision: { approved: boolean; feedback?: string },
  onEvent: EventHandler,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id: threadId, decision }),
  });
  await consumeStream(response, onEvent);
}
