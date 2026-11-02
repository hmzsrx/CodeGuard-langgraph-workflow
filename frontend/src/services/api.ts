export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

async function responseError(response: Response): Promise<Error> {
  let detail = `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) detail = body.detail;
  } catch {
    // Keep the HTTP status message when the server does not return JSON.
  }
  return new Error(detail);
}

export async function checkApiHealth(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) throw await responseError(response);
  const body = (await response.json()) as { status?: string };
  return body.status === "ok";
}

export async function writeApprovedCode(
  threadId: string,
): Promise<{ success: boolean; detail?: string; backup_path?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/write-original`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id: threadId }),
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as {
    success: boolean;
    detail?: string;
    backup_path?: string;
  };
}
