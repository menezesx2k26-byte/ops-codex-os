# Obsidian view over the existing Context Gateway

**Decision:** Approved approach B on 2026-11-17. Context Gateway remains the required contextual-recall entrypoint for controlled agents; Obsidian is an optional, read-only human-facing view.

## Goals

- Reuse `createContextGateway().answerWithContext()` and trusted host scope resolution. Do not add a retrieval provider, index, authority or paid service.
- Make a portable local Obsidian vault with links to existing canonical Git/Drive documents. Never copy document bodies or retrieved evidence.
- Keep the view usable without Obsidian installed. Gateway operation must not depend on the vault, Windows or Obsidian availability.
- Respect per-project and personal scope isolation. Visual links never grant retrieval permissions.

## Non-goals

No production deployment, OAuth migration, RAG cutover, Android synchronization, GraphRAG, credentials or authority migration. Do not claim that consumer ChatGPT automatically calls a gateway.

## Design

1. One dependency-free CLI reads a user-supplied metadata manifest and writes a fresh Markdown directory. Each source has `id`, `title`, `scope`, `authority` and canonical HTTPS `url` only.
2. A home note links source notes using wikilinks. Each note cites only its canonical URL, scope and authority, and declares itself a derived view.
3. Restrict HTTPS URLs to GitHub and Google Drive, reject userinfo/query/fragments, unknown fields, bad scopes/IDs/titles and output paths that already exist. No private manifests are committed.
4. Test that the existing controlled-agent gateway recalls before answer generation, denies wrong scope and returns unavailable without answering.
5. Output is a disposable visualization, not a second index or authority.

## Acceptance

- RED/GREEN tests for the generator's content and security boundaries.
- Gateway regression tests pass. A private sample vault is generated and inspected without installing Obsidian.
- No production/main mutation; retain checkpoint and report precisely what is unverified.
