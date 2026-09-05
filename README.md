# Quizy

> **AI-powered learning and assessment platform.**

Quizy turns study documents into interactive learning workflows: AI-generated quizzes, source-faithful question banks, performance tracking, spaced review, and an AI tutor.

**Live Demo:** https://quizy.aiengmohamedtayal.workers.dev

## Why Quizy?

Most study material is static. Quizy turns it into an active-recall workflow:

```text
Document → Extraction → Assessment → Feedback → Mastery → Review
```

The product deliberately separates two different trust models:

| Mode | Purpose |
| --- | --- |
| **AI Quiz Generation** | Create new practice questions from study material. |
| **Exact Source** | Import existing questions while preserving source wording, choices, provenance, and available media. |

## Product Capabilities

- PDF, DOCX, and TXT ingestion with page-aware extraction and selective OCR fallback.
- Exact Source mode with source and canonical question hashes for provenance and integrity checks.
- Question Bank with search, filtering, saving, review, and bulk selection.
- Attempt tracking, incorrect-answer review, and mastery-oriented progress.
- Spaced Review workflows for targeted practice.
- AI Tutor for post-answer explanations and assistance.
- RTL-first Arabic UI with accessibility-conscious interaction and motion.
- Responsive, production-deployed web application.

## Engineering Highlights

### Probabilistic AI behind deterministic application boundaries

Model output is treated as untrusted input. Responses are validated against application schemas before persistence or rendering, and uncertain extraction is surfaced for review rather than silently invented.

### Source fidelity as a first-class invariant

Exact Source is isolated from generated-question logic. Raw source data remains distinct from normalized/rendered representations so the application can preserve provenance instead of rewriting authoritative material.

### Server-first trust boundary

AI and database credentials remain server-side. Browser code does not import server-only services, and privileged operations are exposed through server functions.

### Split persistence model

```text
Neon PostgreSQL  → relational application state
Cloudflare R2    → uploaded documents + media
```

This keeps structured state and binary objects independently managed while preserving references and metadata between them.

## Architecture

```text
┌──────────────────────────────┐
│           Browser            │
│ React 19 + TanStack Router  │
│ local parsing / local state  │
└──────────────┬───────────────┘
               │ SSR / HTTP
               ▼
┌──────────────────────────────┐
│       Cloudflare Worker      │
│ TanStack Start + Nitro       │
│ Server Functions             │
│ AI provider abstraction      │
│ Learning services            │
└──────────┬───────────┬───────┘
           │           │
           ▼           ▼
┌────────────────┐  ┌────────────────┐
│ Neon PostgreSQL│  │ Cloudflare R2  │
│ relational     │  │ objects/media  │
└────────────────┘  └────────────────┘
```

More detailed decisions are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ENGINEERING_DECISIONS.md`](docs/ENGINEERING_DECISIONS.md).

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS |
| Routing / SSR | TanStack Router, TanStack Start |
| Build / Runtime | Vite, Nitro, Cloudflare Workers |
| Data | Neon PostgreSQL |
| Object Storage | Cloudflare R2 |
| AI | OpenAI-compatible provider abstraction |
| Validation | Zod |
| Documents | pdfjs-dist, Mammoth, OCR fallback |
| Testing | Node test runner + TypeScript |

## Repository Structure

```text
src/
├── routes/        # application routes
├── components/    # reusable UI
├── lib/           # shared domain utilities and clients
└── server/        # server-side functions and integrations

tests/             # automated tests
evals/             # model evaluation tooling
docs/              # architecture and engineering decisions
.github/workflows/ # CI quality gates
```

## Development

### Requirements

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Environment

```bash
cp .env.example .env
```

Configure the required server-side environment variables locally. Never commit real credentials.

### Run

```bash
npm run dev
```

The development server is available at `http://localhost:5173`.

## Quality Gates

The repository includes CI checks for the main branch and pull requests:

```text
Install → Typecheck → Lint → Tests → Production Build
```

Run the same checks locally:

```bash
npx tsc --noEmit --skipLibCheck
npm run lint
npm test
npm run build
```

## Security

- AI and database credentials are server-side only.
- `.env` and deployment secrets are excluded from Git.
- Imported content is not rendered through `dangerouslySetInnerHTML`.
- AI responses are schema-validated before they cross into trusted application state.
- Exact Source preserves provenance instead of silently rewriting authoritative content.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the trust boundary and storage model.

## Exact Source Guarantees

1. **No silent invention** — missing or uncertain information is marked for review.
2. **No silent rewriting** — authoritative source content remains separate from generated content.
3. **No silent loss** — large documents are processed with progress tracking.
4. **No regeneration** — imported exact questions do not enter the AI generation path.

## Engineering Decisions

Key architectural choices are recorded as documentation rather than hidden in implementation details. See [`docs/ENGINEERING_DECISIONS.md`](docs/ENGINEERING_DECISIONS.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development and pull-request conventions.

## License

MIT — see [`LICENSE`](LICENSE).

## Project Status

Quizy is deployed on Cloudflare Workers. Production architecture, repository documentation, and local quality checks are kept aligned with the implementation; documentation intentionally avoids claiming features that are not implemented.