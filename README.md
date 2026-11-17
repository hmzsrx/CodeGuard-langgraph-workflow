# 🛡️ CodeGuard AI – Intelligent Code Reviewer & Fixer

CodeGuard AI is an AI-powered code review and fixing system built with LangGraph and FastAPI. It automatically analyzes source code, identifies bugs, generates fixes, and tests the corrected code before applying changes.

## ⚙️ Getting Started – Run Locally

Follow these steps to set up and run the project on your local machine.

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/CodeGuard-AI.git
cd CodeGuard-AI
```

### 2. Create a Virtual Environment

```bash
python -m venv .venv
```

Activate the environment:

**Windows:**
```bash
.venv\Scripts\activate
```

**Linux / macOS:**
```bash
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
```

Add any other required environment variables.

### 5. Start the Backend Server

```bash
uvicorn server:app --reload
```

The backend will run at:

```text
http://localhost:8000
```

**FastAPI Swagger Documentation:**

```text
http://localhost:8000/docs
```

### 6. Run with Docker (Optional)

Build the Docker image:

```bash
docker build -t codeguard-ai .
```

Run the container:

```bash
docker run -p 8000:8000 --env-file .env codeguard-ai
```

---

## 🚀 Key Features

- **Automated Code Review:** Identifies bugs, logical errors, and potential improvements.
- **AI-Powered Code Fixing:** Generates corrected code based on review reports.
- **Automated Testing:** Tests generated code to verify fixes.
- **Human-in-the-Loop (HITL):** Requires human approval before modifying original files.
- **File Backup:** Creates backups before applying changes.
- **Multi-Agent Workflow:** Uses specialized LangGraph agents and subgraphs.
- **State Management:** Maintains workflow state throughout the process.

## 🏗️ Architecture

The project uses LangGraph to orchestrate multiple specialized agents.

### Workflow

1. **Read Code:** Reads source code from the provided local file path.
2. **Code Review Agent:** Analyzes code and generates a structured review report.
3. **Code Fixer Agent:** Generates corrected code based on identified issues.
4. **Testing Agent:** Tests the generated code.
5. **Human Approval:** Requests approval before modifying the original file.
6. **Backup & Write:** Creates a backup and writes approved changes.
7. **Final Result:** Returns the final review and results.

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| Python | Core programming language |
| LangGraph | Agent orchestration |
| LangChain | LLM integration |
| Groq | LLM provider |
| FastAPI | Backend API |
| Pydantic | Data validation |
| Docker | Containerization |
| GitHub Actions | CI/CD automation |

## 📂 Project Structure

```text
CodeGuard-AI/
│
├── frontend/               # Frontend application
├── server.py               # FastAPI application
├── Dockerfile              # Docker configuration
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables
└── README.md
```

*Update this structure according to the actual project directories.*

## 🔄 CI/CD

The project uses GitHub Actions for:

- Automated Python compilation checks.
- Docker image build verification.
- Frontend build validation.
- Continuous Integration workflows.

## 🔐 Safety & Approval

- Original source code is reviewed before modification.
- Generated fixes are tested before approval.
- Human approval is required before applying changes.
- A backup is created before writing approved changes.

## 🎯 Project Goal

The goal of CodeGuard AI is to simplify software debugging and code maintenance through autonomous AI agents while keeping developers in control of important code modifications.

## 👨‍💻 Author

**Hamza Ali**

AI Engineer | Generative AI | Agentic AI | LangGraph | Python
