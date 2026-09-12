# Enterprise HR Policy & Employee Support Agentic RAG Copilot

An enterprise-ready **Agentic RAG (Retrieval-Augmented Generation)** system designed for internal HR support. Built using **LangGraph**, **FastAPI**, **Pinecone**, **Groq LLMs** (or OpenAI), **HuggingFace Local Embeddings**, **Tavily Web Search**, and modern **HTML5/CSS3/Vanilla JS** UI.

---

## 1. Problem & Business Context

### Customer
**NovaRetail**, a 3,000-employee enterprise retail company.

### Problem Statement
Internal HR teams manage a sprawling set of policies: leave entitlement, remote work agreements, payroll guidelines, benefits packages, onboarding handbooks, and conduct codes.

Employees face common issues:
- **Scattered Information:** Difficulty finding the right official policy document.
- **Hallucinations & Risk:** Generic chatbots invent HR policies without citing grounded company documents.
- **External Regulation Gaps:** Internal documents may not cover public labor laws or recent statutory changes (e.g., statutory public holidays).

### Business Objective
Deliver an intelligent, grounded **Employee Knowledge Copilot** that:
1. **Prioritizes Private Knowledge:** Searches internal company HR documentation first.
2. **Grades Evidence Quality:** Evaluates whether retrieved document chunks actually answer the question.
3. **Smart Fallback to Web:** Invokes Tavily web search only when private documentation is absent or weak.
4. **Iterative Query Rewriting:** Reformulates ambiguous queries and retries retrieval up to a threshold.
5. **Traceable Decision Path:** Exposes the complete LangGraph execution trace for full auditability and transparency.
6. **Self-Service Knowledge Ingestion:** Enables HR administrators to securely upload and index new policy documents (PDF, DOCX, TXT, MD).

---

## 2. System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │                     Employee / HR                      │
               └───────────────────────────┬────────────────────────────┘
                                           │ Web Interface
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │           FastAPI Backend (/api/chat, /api/ingest)     │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │             LangGraph Agentic RAG Workflow             │
               └───────┬───────────────────┬───────────────────┬────────┘
                       │                   │                   │
                       ▼                   ▼                   ▼
             ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐
             │   Pinecone KB    │ │  Tavily Search   │ │  Groq / OpenAI │
             │ (Local Embeddings│ │ (Web Fallback)   │ │     (LLM)      │
             │ bge-small-en-v1.5│ │                  │ │                │
             └──────────────────┘ └──────────────────┘ └────────────────┘
```

---

## 3. LangGraph Agentic Workflow

```text
                     ┌──────────────────┐
                     │  User Question   │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  Route Question  │
                     └────────┬─────────┘
                              │
             ┌────────────────┴────────────────┐
             │                                 │
     [Greeting / Chit-Chat]           [HR Policy Question]
             │                                 │
             ▼                                 ▼
    ┌─────────────────┐             ┌─────────────────────┐
    │  Direct Answer  │             │ Retrieve Private KB │
    └─────────────────┘             └──────────┬──────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │ Grade Evidence (KB) │
                                    └──────────┬──────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │                                               │
                   [ GOOD ]                                        [ WEAK ]
                       │                                               │
                       ▼                                               ▼
             ┌──────────────────┐                            ┌───────────────────┐
             │  Generate Answer │                            │ Tavily Web Search │
             │  from Private KB │                            └─────────┬─────────┘
             └──────────────────┘                                      │
                                                                       ▼
                                                             ┌───────────────────┐
                                                             │ Grade Web Evidence│
                                                             └─────────┬─────────┘
                                                                       │
                                                   ┌───────────────────┴───────────────────┐
                                                   │                                       │
                                               [ GOOD ]                                [ WEAK ]
                                                   │                                       │
                                                   ▼                                       ▼
                                         ┌──────────────────┐                    ┌───────────────────┐
                                         │  Generate Answer │                    │   Rewrite Query   │
                                         │  from Web Search │                    └─────────┬─────────┘
                                         └──────────────────┘                              │
                                                                                           ▼
                                                                                 ┌───────────────────┐
                                                                                 │  Retry Private KB │
                                                                                 │ (within max retry)│
                                                                                 └───────────────────┘
```

---

## 4. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Workflow Engine** | [LangGraph](https://github.com/langchain-ai/langgraph) | Stateful decision routing, grading, fallback, and cyclic retry logic |
| **LLM Provider** | [Groq](https://groq.com/) / [OpenAI](https://openai.com/) | Fast inference with `openai/gpt-oss-120b`, `llama-3.3-70b-versatile`, or `gpt-4o-mini` |
| **Embeddings** | HuggingFace `BAAI/bge-small-en-v1.5` (or `all-MiniLM-L6-v2`) | High-accuracy, CPU-friendly local embeddings (100% free, no rate limits) |
| **Vector Database** | [Pinecone](https://www.pinecone.io/) | Serverless vector database storing chunked HR policies |
| **Web Search** | [Tavily AI Search](https://tavily.com/) | Specialized AI search engine for web fallback |
| **API Backend** | [FastAPI](https://fastapi.tiangolo.com/) | High-performance asynchronous REST API |
| **Frontend UI** | HTML5, CSS3 (Modern Dark Theme), JavaScript | Responsive chat interface with live workflow step tracing |
| **Audit & Logging** | SQLite | Audit logs for queries, sources used, and agent traces |
| **Containerization** | Docker & Docker Compose | Containerized builds and deployment |
| **CI/CD** | GitHub Actions | Automated linting, test suites, and Docker Hub image publishing |

---

## 5. Repository Structure

```text
Enterprise-HR-Policy-Employee-Support-Agentic-RAG/
├── .github/
│   └── workflows/
│       └── ci-cd.yml             # GitHub Actions CI/CD pipeline
├── app/
│   ├── api/
│   │   └── routes.py             # FastAPI routes (/api/chat, /api/ingest, /api/health)
│   ├── core/
│   │   ├── config.py             # App configuration & settings validation
│   │   └── logging.py            # Centralized logging setup
│   ├── rag/
│   │   ├── state.py              # LangGraph state schema definition
│   │   ├── vectorstore.py        # Pinecone vector store & HuggingFace embedding manager
│   │   └── workflow.py           # LangGraph nodes, routing, grading & RAG graph
│   ├── services/
│   │   ├── audit.py              # SQLite audit persistence
│   │   └── ingestion.py          # Document loader (PDF/DOCX/TXT/MD) and text chunker
│   └── main.py                   # FastAPI app entry point & static file mounting
├── data/
│   ├── sample_kb/                # Pre-packaged enterprise HR documents
│   │   ├── company_hr_handbook.md
│   │   └── hr_operations_runbook.md
│   └── audit.db                  # Local audit SQLite database
├── static/
│   ├── css/style.css             # UI styling & design system
│   └── js/app.js                 # Chat UI interaction & trace renderer
├── templates/
│   └── index.html                # Main application UI
├── uploads/                      # Directory for admin document uploads
├── .dockerignore
├── .env.example                  # Environment variable template
├── .gitignore
├── docker-compose.yml            # Docker Compose service definition
├── Dockerfile                    # Production Docker container definition
├── ingest_sample_kb.py           # Ingestion CLI script for sample data
├── requirements.txt              # Python project dependencies
├── run.py                        # Local development runner
└── README.md
```

---

## 6. Quick Start & Setup

### Prerequisites
- Python 3.10+
- Free API Keys:
  - **Groq API Key:** [console.groq.com](https://console.groq.com/)
  - **Pinecone API Key:** [pinecone.io](https://www.pinecone.io/)
  - **Tavily API Key:** [tavily.com](https://tavily.com/)

---

### Step 1 — Clone and Navigate
```bash
git clone https://github.com/rashedulalbab253/Enterprise-HR-Policy-Employee-Support-Agentic-RAG.git
cd Enterprise-HR-Policy-Employee-Support-Agentic-RAG
```

### Step 2 — Create and Activate Virtual Environment
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3 — Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4 — Configure Environment Variables
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

`.env` configuration:
```env
# Groq LLM
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

# HuggingFace Local Embeddings (CPU-friendly, runs offline)
EMBEDDING_MODEL=bge-small-en-v1.5

# Pinecone Vector DB
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=fde-hr-policy-rag
PINECONE_NAMESPACE=company-hr-kb

# Web Search
TAVILY_API_KEY=your_tavily_api_key_here

# App Settings
ADMIN_API_KEY=change-me-in-production
APP_ENV=development
PORT=8000

# LangSmith Observability (Optional)
LANGSMITH_TRACING=false
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=your_langsmith_key
LANGSMITH_PROJECT=enterprise-hr-policy-rag
```

### Step 5 — Ingest Sample Knowledge Base
Populate Pinecone with sample company HR policies:
```bash
python ingest_sample_kb.py
```

### Step 6 — Run Application
```bash
python run.py
```

Access the application:
- **Chat Web UI:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 7. Running with Docker & Docker Compose

### Using Docker Compose
```bash
docker compose up --build -d
```

### Using Plain Docker
```bash
# Build Docker image
docker build -t enterprise-hr-policy-rag .

# Run container with environment file
docker run -d -p 8000:8080 --env-file .env --name hr_copilot enterprise-hr-policy-rag
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 8. CI/CD & Automated Deployment

This repository includes a GitHub Actions pipeline in [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) that:
1. **Runs Code Quality Checks:** Flake8 linting and syntax validation.
2. **Executes Tests:** Runs automated smoke and unit tests.
3. **Builds & Pushes Docker Image:** Automatically publishes versioned and `latest` images to Docker Hub on every push to `main`.

### Configuring GitHub Secrets
To enable automated Docker Hub publishing, add the following repository secrets under **Settings > Secrets and variables > Actions**:

| Secret Name | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username (e.g. `rashedulalbab1234`) |
| `DOCKERHUB_TOKEN` | Your Docker Hub Personal Access Token |

---

## 9. API Reference

### 1. Health Check
```http
GET /api/health
```
**Response:**
```json
{
  "status": "ok",
  "service": "Enterprise HR Policy Agentic RAG Copilot"
}
```

### 2. Chat & Query Processing
```http
POST /api/chat
Content-Type: application/json

{
  "question": "How many days of annual leave do employees get?"
}
```
**Response:**
```json
{
  "answer": "Full-time employees receive 20 days of paid annual leave per calendar year...",
  "source_used": "private_kb",
  "trace": [
    "route_question -> kb",
    "retrieve_kb -> 4 chunks retrieved",
    "grade_kb_evidence -> GOOD",
    "generate_kb_answer -> complete"
  ],
  "citations": ["company_hr_handbook.md"],
  "rewritten_query": "How many days of annual leave do employees get?"
}
```

### 3. Document Ingestion (Admin)
```http
POST /api/ingest
Header: x-admin-key: <ADMIN_API_KEY>
Content-Type: multipart/form-data

file: <policy_document.pdf | docx | txt | md>
```
**Response:**
```json
{
  "message": "Document indexed",
  "file": "maternity_policy_2026.pdf",
  "chunks": 12,
  "ids_created": 12
}
```

---

## 10. Verification & Demo Scenarios

| Scenario | Example Prompt | Expected Workflow Route | Source Used |
|---|---|---|---|
| **Chit-Chat / Greetings** | `"Hello, what can you do?"` | `route_question` → Direct greeting | `direct` |
| **Internal HR Policy** | `"How many annual leave days do employees receive?"` | `retrieve_kb` → `grade_kb_evidence (GOOD)` → `generate_kb_answer` | `private_kb` |
| **Remote Work Policy** | `"Can I work remotely from another country?"` | `retrieve_kb` → `grade_kb_evidence (GOOD)` → `generate_kb_answer` | `private_kb` |
| **External Statutory Search** | `"What are the statutory public holidays in Bangladesh for 2026?"` | `retrieve_kb` → `grade_kb_evidence (WEAK)` → `tavily_search` → `generate_web_answer` | `web_search` |
| **Ambiguous / Edge Query** | `"What is the rule about that thing?"` | `grade (WEAK)` → `rewrite_query` → Retry KB | `rewrite / fallback` |

---

## 11. Security & Compliance Best Practices

- **Strict Source Separation:** Private HR documents are explicitly prioritized and never leaked into public searches.
- **Admin Ingestion Guardrails:** Document ingestion requires an `x-admin-key` header to prevent unauthorized knowledge updates.
- **Audit Logging:** Every employee query and LangGraph execution route is logged to SQLite for compliance auditing.
- **Zero-Data Hallucination:** If neither private documents nor web fallback yield sufficient evidence, the agent explicitly returns an insufficient evidence disclaimer rather than hallucinating.

---

## 12. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
