# Obsidian Context Gateway View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task by task. Steps use checkbox syntax.

**Goal:** Expose existing authoritative sources in an Obsidian-compatible view while keeping contextual recall mandatory through the existing trusted Context Gateway.

**Architecture:** A standalone offline metadata-to-Markdown projector, disconnected from all retrieval APIs. Existing gateway enforces recall in controlled hosts; new regression tests assert this contract.

**Tech Stack:** Node.js 24 standard library; Node test runner; Markdown.

**Spec:** `docs/superpowers/specs/2026-11-17-obsidian-context-gateway-view-design.md`

## Global Constraints

- R$ 0 incremental cost; no new cloud resource, provider, index or authority.
- No content from private Git, Drive, Engram, PersistFlow or RAG in public Git. Source metadata and manifests are supplied at runtime.
- No production writes, deployments, secrets, OAuth changes or modification to stacked draft branches.

## Review Focus

- URL with token/query or credential: must reject before output.
- Unsafe ID/path traversal or duplicate ID: must reject without writing.
- Unknown scope, project/person collision or unauthorized scope: must reject or fail closed.
- Already existing output folder: must refuse overwrite.
- Gateway down or wrong project: answer producer must not run.

---

### Task 1: Project a metadata manifest into an Obsidian vault

**Files:** Create `scripts/obsidian-view.js`; create `tests/obsidian-view.test.js`.

**Interfaces:** `buildObsidianView({sources, outputDir}): Promise<{notes:number,outputDir:string}>`; CLI `node scripts/obsidian-view.js manifest.json outputDir`.

- [ ] Write and execute failing tests covering safe wikilinks, no source content, bad URL, bad scope, duplicate ID and existing output.
- [ ] Implement minimal validation and file generation with Node standard library.
- [ ] Run focused test and inspect created vault with readback.

### Task 2: Prove controlled host enforcement contract

**Files:** Create `tests/obsidian-gateway-contract.test.js`. Existing `modules/context-gateway/src/*` should remain unchanged unless a RED test exposes a bug.

- [ ] Write tests that require recall before answering and block wrong project/unavailable gateway.
- [ ] Run the tests and assess behavior; repair only reproduced defects.
- [ ] Run existing relevant Gateway tests.

### Task 3: Document and verify safely

**Files:** Create `docs/architecture/rag/obsidian-view-usage.md`; create `docs/architecture/execution-checkpoints/2026-11-17-obsidian-gateway-view.md`.

- [ ] Document the trusted-host gateway entrypoint, local view command, permission boundary and lack of automatic consumer ChatGPT enforcement.
- [ ] Run all repository tests and `npm run validate:spec-kit` where feasible.
- [ ] Inspect full diff for private identifiers or leaked content. Commit only explicit files to isolated branch.
- [ ] Report no-go production gates and whether any remote push/PR was performed.
