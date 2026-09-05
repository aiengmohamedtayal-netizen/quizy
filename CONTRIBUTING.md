# Contributing to Quizy

Thanks for contributing to Quizy.

## Development

Requirements:
- Node.js 20+
- npm

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Before opening a pull request, run:

```bash
npm test
npx tsc --noEmit --skipLibCheck
npm run lint
npm run build
```

## Pull Requests

Keep changes focused and explain the user-facing or engineering impact.
Do not commit secrets, `.env` files, build output, or `node_modules`.

For changes to Exact Source behavior, preserve the core invariants:
- do not invent missing content
- do not rewrite source questions
- preserve source traceability and media
- mark uncertain extraction as requiring review

## Commit Style

Use concise conventional-style messages, for example:

```text
feat: add question bank import
fix: preserve exact source media
chore: update deployment configuration
```
