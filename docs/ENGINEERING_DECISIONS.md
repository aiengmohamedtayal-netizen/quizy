# Engineering Decisions

This document records decisions that materially shape Quizy's architecture and maintainability.

## 1. Neon PostgreSQL for relational persistence

**Decision:** Use Neon PostgreSQL for durable relational data.

**Rationale:** Quiz data, attempts, mastery state, source metadata, and other relational entities benefit from SQL constraints, transactions, and familiar PostgreSQL tooling. Object storage remains a separate concern.

## 2. Cloudflare R2 for documents and media

**Decision:** Store uploaded documents and media in R2 rather than in PostgreSQL rows.

**Rationale:** Binary objects have different lifecycle and access characteristics from relational application state. The database stores metadata and references; R2 stores the objects.

## 3. Exact Source is isolated from AI generation

**Decision:** Maintain a dedicated ingestion path for source-faithful question banks.

**Rationale:** Generated content can be improved or rewritten; source-faithful content cannot. Keeping the paths separate prevents accidental rewriting and makes provenance explicit.

## 4. Validate AI output before persistence

**Decision:** Treat model output as untrusted external input.

**Rationale:** Structured validation provides a deterministic boundary between probabilistic generation and application state. Invalid output can be rejected or marked for review rather than being stored as if it were trusted.

## 5. Server-only integration for privileged services

**Decision:** Keep AI and database credentials behind the server boundary.

**Rationale:** Secrets must not be exposed to browser bundles. TanStack Start server functions provide an explicit boundary for privileged operations.

## 6. Cloudflare Workers as the production runtime

**Decision:** Deploy the application with Nitro's Cloudflare module preset.

**Rationale:** This aligns the SSR application and server functions with a globally distributed edge runtime while keeping the deployment model close to the local Vite development workflow.

## 7. Selective OCR fallback

**Decision:** Use OCR only when normal document extraction is insufficient.

**Rationale:** OCR adds cost and potential recognition errors. Applying it selectively improves the balance between fidelity, performance, and compute usage.
