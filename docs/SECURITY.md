# Security Model

Quizy treats AI output, uploaded documents, and browser input as untrusted data.

## Trust Boundaries

```text
Browser
  │
  │ untrusted input / document data
  ▼
Server Functions
  │
  ├── validate input
  ├── call AI provider
  ├── validate model output
  └── persist trusted application state
  │
  ├── Neon PostgreSQL
  └── Cloudflare R2
```

## Security Principles

### Secrets stay server-side

AI credentials and database credentials are read by server-side integrations only. Environment files and deployment secrets are excluded from version control.

### AI output is untrusted

Model responses are schema-validated before they enter application state. Invalid or uncertain extraction is rejected or surfaced for review rather than silently accepted.

### Source content is not rewritten implicitly

Exact Source maintains a separate path from AI-generated content. Raw source and normalized representations remain distinct so authoritative material can retain provenance.

### Safe rendering

Imported document content is rendered as application data rather than injected as executable HTML.

### Least privilege

Client code does not directly access privileged database or AI integrations. Server functions form the boundary for protected operations.

## Operational Checklist

Before production changes:

- verify no secrets are present in Git history or tracked files
- run typecheck, lint, tests, and production build
- review changes touching file ingestion or AI output handling
- validate new persistence paths and authorization assumptions
- avoid logging credentials, tokens, or unnecessary document content

## Reporting

For a suspected security issue, avoid publishing sensitive details in a public issue. Contact the project maintainer privately with reproduction steps and impact information.