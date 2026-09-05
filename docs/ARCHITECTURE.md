# Architecture Overview

Quizy is an AI-assisted learning platform built as a TypeScript application with a server-first boundary for AI, persistence, and object storage.

## Runtime Architecture

```text
┌──────────────────────────────┐
│          Browser             │
│ React 19 + TanStack Router   │
│ File parsing / local state   │
└──────────────┬───────────────┘
               │ HTTP / SSR
               ▼
┌──────────────────────────────┐
│      Cloudflare Worker       │
│ TanStack Start + Nitro       │
│ Server Functions             │
│ AI provider abstraction      │
│ Learning / quiz services     │
└──────────┬───────────┬───────┘
           │           │
           ▼           ▼
┌────────────────┐  ┌────────────────┐
│ Neon PostgreSQL│  │ Cloudflare R2  │
│ durable data   │  │ files + media  │
└────────────────┘  └────────────────┘
```

## Core Design Principles

### Server-side trust boundary
AI credentials and database credentials remain server-side. Client code communicates with server functions rather than importing server-only modules.

### Separate exact-source and generated-content pipelines
Exact Source mode treats the uploaded document as authoritative. It preserves source text and traceability and does not silently rewrite extracted questions. AI-generated quizzes use a separate generation path.

### Structured AI output
AI responses are validated against application schemas before they are persisted or rendered. Invalid or uncertain extraction is surfaced as review-required rather than silently guessed.

### Storage separation
PostgreSQL stores relational application state; R2 stores documents and media. This keeps binary objects outside the relational model while preserving references and metadata in the database.

### Progressive processing
Document ingestion is designed around page/file-level progress and selective OCR fallback for low-quality or scanned content instead of applying expensive OCR indiscriminately.

## Deployment

The production target is Cloudflare Workers using Nitro's Cloudflare module preset. The same application can be run locally with Vite for development and validation.

## Non-goals

- Treating AI output as authoritative without validation.
- Mixing raw source content with normalized display content.
- Embedding secrets in browser bundles or repository files.
- Coupling document binaries directly to relational tables.
