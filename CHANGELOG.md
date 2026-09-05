# Changelog

All notable changes to Quizy are documented here.

## Unreleased

- Repository presentation improvements for portfolio review.
- Dedicated security model documentation.
- Continued alignment between production architecture and repository documentation.

## 2026-09-05

### Added

- Professional repository README.
- Architecture overview.
- Engineering decision records.
- Continuous integration quality gate.
- MIT license.
- Contribution guidelines.

### Engineering

- Neon PostgreSQL adopted for relational persistence.
- Cloudflare R2 adopted for uploaded documents and media.
- Exact Source pipeline kept separate from AI-generated quiz creation.
- AI responses validated before entering trusted application state.
- Production runtime deployed on Cloudflare Workers.
