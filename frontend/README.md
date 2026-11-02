# CodeGuard AI frontend

This React/Vite app lives separately from the existing LangGraph backend.

## Run locally

```powershell
cd frontend
npm install
npm run dev
```

The Vite app runs at `http://localhost:5173`. Start the existing FastAPI backend separately with `python server.py` (port 8000), or set `VITE_API_URL` to its base URL before starting Vite.

## Backend contract

The UI uses the existing endpoints only:

- `GET /api/health`
- `POST /api/run` with either `file_path` (backend-readable local path) or `file_content` and `file_name`; `original_file_path` is optional when uploading
- `POST /api/resume` with the LangGraph `thread_id` and interrupt decision
- `POST /api/write-original` after the user approves and the graph resumes

The browser file picker provides file contents but does not reveal the computer's absolute path. A user can start with a selected file, a local path readable by the backend, or both. A path-only run passes the path directly to LangGraph. If content is uploaded without a target path, approval completes the workflow and the fixed code can be downloaded; the original file is not modified. When an upload includes a target path, the backend writes there only after approval. The backend currently gates approval on a Python syntax check; it does not execute runtime tests.

Review events are consumed from the backend's Server-Sent Events stream. History stores review metadata in this browser only; the backend does not expose an endpoint to retrieve prior review details, and its thread state is in memory.

During an active review, LangGraph stage progress appears below Settings in the sidebar. Reviewer and fixer text is streamed from the model into the live response panel, which follows the incoming output.

Run `npm run build` to type-check and create the production bundle in `dist/`.
