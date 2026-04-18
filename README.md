# Claude LaTeX Editor

AI-powered LaTeX editor for researchers and academics. Write, edit, and compile LaTeX papers using natural language instructions.

## Features

- **AI Chat** — Type natural language instructions like "add a convergence proof" or "change the title" and the AI modifies your LaTeX
- **Live PDF Preview** — Compile and preview your paper in real-time
- **Multi-Model Support** — Choose from 6 AI models (Claude Opus, Sonnet, Haiku, Gemini Pro, Minimax, GPT OSS) based on your budget
- **Review Mode** — AI changes shown as inline diffs. Accept or reject before applying
- **File Manager** — Upload, create, and organize project files (tex, bib, images, cls)
- **Multi-Project** — Create and manage multiple LaTeX projects
- **Multi-User** — Email/password auth with per-user isolation
- **Light/Dark Mode** — Toggle between themes
- **Chat History** — Persistent conversation memory across sessions

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Editor | Monaco Editor (VS Code engine) |
| State | Zustand |
| Backend | FastAPI, Python 3.11+ |
| AI Agent | LangGraph + OpenRouter (multi-model) |
| Database | PostgreSQL (AWS RDS) |
| File Storage | AWS S3 |
| Compilation | pdflatex (local) |
| Auth | JWT + bcrypt |

## Architecture

```
Browser (Next.js)
    │
    ├── REST API ──► FastAPI Backend
    ├── WebSocket ──► LangGraph Agent ──► OpenRouter (LLM)
    │                    │
    │                    ├── Parse Instruction (Gemini Flash)
    │                    ├── Analyze LaTeX (regex, no LLM)
    │                    ├── Modify LaTeX (user-selected model)
    │                    ├── Validate (balanced braces check)
    │                    └── Compile PDF (pdflatex)
    │
    ├── S3 ──► Project files
    └── PostgreSQL ──► Users, projects, chat history
```

## Quick Start (Local Development)

### Prerequisites

- Python 3.11+
- Node.js 20+
- pdflatex (`brew install --cask mactex-no-gui` on macOS)
- PostgreSQL (local or RDS)
- AWS S3 bucket

### Backend

```bash
cd backend
cp .env.example .env    # Edit with your credentials
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage_users.py create your@email.com
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Project Structure

```
claude-latex/
├── frontend/               # Next.js app
│   ├── src/app/            # Pages (login, dashboard, editor)
│   ├── src/components/     # UI components
│   ├── src/hooks/          # React hooks (WebSocket, chat, compilation)
│   ├── src/store/          # Zustand state
│   └── src/lib/            # API client, types, auth helpers
│
├── backend/                # FastAPI app
│   ├── app/routers/        # API endpoints
│   ├── app/services/       # S3, compiler, auth, file store
│   ├── app/agent/          # LangGraph agent (nodes, graph, state)
│   ├── app/models/         # SQLAlchemy models
│   └── app/utils/          # LaTeX parser, reference map
│
└── docs/                   # Internal documentation
```

## License

Proprietary. All rights reserved.
