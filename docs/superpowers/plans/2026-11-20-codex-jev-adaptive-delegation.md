# Codex + Jev Adaptive Delegation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one verified, reversible, privacy-safe Jev-routed native Codex subagent pilot, then prove or explicitly reject an OMX combination using measured time, token usage, and code quality.

**Architecture:** Reuse upstream `guilhem/codex-subagent-router` for unpinned native `spawn_agent` choices and `Yeachan-Heo/oh-my-codex` for optional team coordination. Keep execution-node routing in existing `persistd/src/fleet/*` unchanged. Prefer a small project-scoped setup/profile validation harness over a new router, proxy, service, or global installer.

**Tech Stack:** Existing GitHub/Codex OS repo; Node.js 20+ ESM/`node:test` (pilot utilities only); Codex CLI plugin hooks; TypeSafe Jev (`jev-latest`); optional OMX project-scope; Superpowers + Anti-Slop Engineering.

**Spec:** `docs/superpowers/specs/2026-11-20-codex-jev-adaptive-delegation-design.md`

## Global Constraints

- **Status:** Design approved for isolated implementation on 2026-11-20; Tasks 1/2/5 partially implemented and unit-tested, live Jev/OMX and benchmark gates not complete. No deployed or installed production system may be claimed from this PR.
- **Owner:** `menezesx2k26-byte/ops-codex-os`; follow existing `global/AGENTS.md`, architecture constitution, reuse-first, scoped context and existing review gates.
- **Never modify:** `persistd/src/fleet/typesafe-router.js`, `persistd/src/fleet/router.js`, production PersistFlow, `scripts/install.ps1`, global `~/.codex` or existing user-owned profiles as part of the pilot.
- **Source snapshot:** repo main at `5842965dbc2251df46c8cadd651ea89f4dd82073`; refresh current branch/head and installed Codex/OMX/plugin versions when executing.
- **Licenses and provenance:** audit upstream license, plugin hook source and executable bundle; pin upstream revision/version after confirming latest stable and compatibility. Do not invent availability of models, reasoning values or unlimited API entitlement.
- **Isolation:** throwaway/public fixture only, isolated project scope and temporary `CODEX_HOME`, no private repo content or secrets to external decision APIs; no new paid services.
- **Safety:** explicit model/effort/agent-type pins always win; root sandbox/permissions and promotion gates always win; redact log data; unsupported or unavailable routing falls back to native defaults for safe tasks only.
- **Resource budget:** initially at most two concurrent native children; no concurrent writes to same file; compare against fixed-profile baseline before increasing.
- **Quality:** write failing `node:test` first for new helper code, confirm RED then GREEN, independently review each coherent task, commit scoped changes; do not weaken tests to pass.
- **Benchmarks:** report measured values or `unknown`, never fabricated money/percentages; 20% worker-token savings or 25% elapsed-time improvement are **experimental targets**, not promises.

## File/Module Map

- Create `integrations/codex-jev/src/catalog.mjs`: validate the current host capability manifest and user-selected Jev profile declarations; **no** TypeSafe network implementation.
- Create `integrations/codex-jev/catalog.test.mjs`: unsupported model/reasoning, duplicates, malformed declarations, empty or excessive catalog and explicit precedence contract.
- Create `integrations/codex-jev/src/profile-sync.mjs`: generate a dry-run file-change plan and apply only `gabriel-*.json` to an **isolated** `CODEX_HOME/subagent-router`; do not touch foreign-owned files.
- Create `integrations/codex-jev/profile-sync.test.mjs`: temp-directory roundtrips, idempotence, untouched foreign profiles, invalid paths, rollback.
- Create `integrations/codex-jev/src/metrics.mjs`: aggregate comparable experiment records with missing metric semantics.
- Create `integrations/codex-jev/metrics.test.mjs`: honest metrics, regression detection and quality gate.
- Create `integrations/codex-jev/pilot/README.md` **during the integration task only**: verified commands, exact upstream SHAs/versions, host-specific opt-in configuration and rollback.
- Create `integrations/codex-jev/pilot/RESULTS.md` **only after real runs**: redacted evidence, comparison, defects and final GO/NO_GO.
- No shared runtime backend, config schema, duplicated `FleetRouter`, ORM, deployment manifest, new memory service, or speculative adapter.

## Review Focus

1. **Untrusted mission contains credential/PII/private source:** routing to third-party Jev must be denied; test with a synthetic canary and assert no external fetch/hook forwarding.
2. **Explicitly pinned child model/effort/agent_type:** must bypass Jev and preserve user/Codex choice; prove at the hook/runtime boundary, not just unit tests.
3. **OMX role pre-pins model/effort/agent_type:** classify as `static_omx`, not `jev`; detect and reject an inaccurate adaptive-routing claim.
4. **Missing key, provider outage, malformed catalog or unsupported model:** no crash or unsafe promotion; safe fallback is explicitly reported, security block still fails closed.
5. **Missing token/served-model metrics:** preserve `unknown` rather than counting as zero/saving, and do not report quality improvement when reviewer disagrees.

---

### Task 1: Establish verified runtime capability boundary

**Files:**
- Create: `integrations/codex-jev/src/catalog.mjs`
- Test: `integrations/codex-jev/catalog.test.mjs`
- Observe (no edits): local Codex CLI/host, `spawn_agent`, plugin hook support, available models/efforts, Node, Jev credential presence, OMX version, actual `CODEX_HOME`

**Interfaces:**
- Consumes: `host = { models: [{id: string, reasoningEfforts: string[]}], supportsSpawnAgent: boolean, supportsPreToolUse: boolean }`; `declarations = [{name, description, model, reasoning_effort}]`.
- Produces: `validateProfiles(host, declarations) -> {ok: boolean, profiles: Array<{filename,description,model,reasoning_effort}>, errors: string[]}` (pure); valid filenames are `gabriel-<name>.json`, reserved `defer` prohibited, maximum **254** active profile candidates.

- [ ] **Step 1: Write failing catalog tests** for supported vs absent model, supported vs absent effort, empty description, collision after name normalization, reserved `defer`, 255 profiles, and absent required native host capabilities; assert `ok === false` and stable non-secret error identifiers on each invalid case.
- [ ] **Step 2: Confirm RED:** `node --test integrations/codex-jev/catalog.test.mjs`; expect module/export missing or failing assertions.
- [ ] **Step 3: Implement** `validateProfiles(host, declarations)` in `integrations/codex-jev/src/catalog.mjs` with no guessed model capability map and no network calls.
- [ ] **Step 4: Confirm GREEN:** same `node --test` command; expect all defined cases passing.
- [ ] **Step 5: Perform real read-only capability probe:** verify Codex version/features/hooks, `omx --version` if installed, Node runtime, available model/effort pairs and `TYPESAFE_API_KEY` **presence only**. Record non-secret verified values in a local untracked fixture, without assuming names from upstream README. If feature or catalog introspection is not possible, mark `BLOCKED` and do not guess.
- [ ] **Step 6: Commit** only `src/catalog.mjs` and `catalog.test.mjs`: `git commit -m "test/feat(codex-jev): validate host-supported routing profiles"`.

### Task 2: Isolated profile provisioning with rollback

**Files:**
- Create: `integrations/codex-jev/src/profile-sync.mjs`
- Test: `integrations/codex-jev/profile-sync.test.mjs`

**Interfaces:**
- Consumes: Task 1 `validateProfiles(...).profiles`.
- Produces: `planProfileSync({pilotHome, profiles, existingFiles}) -> {writes: Array<{path,content}>, skipped: string[], conflicts: string[]}` (pure); `applyProfileSync({plan, fs}) -> {written: string[], originalContents: Record<string,string|null>}`; `rollbackProfileSync({pilotHome, receipt, fs}) -> void`.
- `pilotHome` must be an explicitly isolated temp/project-scoped `CODEX_HOME`, not the user's default home.

- [ ] **Step 1: Write failing tests** using `node:fs/promises` + `node:os.tmpdir` for only prefixed `gabriel-*.json` written under `subagent-router`, deterministic JSON, no writes outside pilot home, no follow-symlink escape, foreign profile preservation, idempotence, rollback of created/overwritten owned files, and rejection of untrusted/corrupt receipt.
- [ ] **Step 2: Confirm RED:** `node --test integrations/codex-jev/profile-sync.test.mjs`.
- [ ] **Step 3: Implement** the three named interfaces with atomic same-directory temporary write/rename and bounded file sizes; refuse non-isolated or symlink-escaping paths. Do not modify the upstream plugin.
- [ ] **Step 4: Confirm GREEN:** same test command.
- [ ] **Step 5: Dry-run against a disposable `CODEX_HOME`** and inspect the exact proposed writes; never run global `scripts/install.ps1` or project-overwriting `omx setup` as a hidden side effect.
- [ ] **Step 6: Commit** implementation and tests: `git commit -m "feat(codex-jev): provision reversible isolated profiles"`.

### Task 3: Install/trust upstream Jev hook in an isolated native Codex session

**Files:**
- Create after observed integration: `integrations/codex-jev/pilot/README.md`
- Update as necessary: no application source unless a separately evidenced upstream incompatibility requires a scoped adapter and regression test.

**Interfaces:**
- Consumes: Task 1 verified model/effort inventory; Task 2 isolated profiles; upstream `guilhem/codex-subagent-router` official `PreToolUse(spawn_agent)` behavior.
- Produces: real redacted event evidence `{routeMode: 'jev'|'explicit'|'fallback'|'unsupported', selectedProfile?, requestedModel?, servedModel?: string|'unknown', reasoningEffort?, hookObserved: boolean}` **as an evidence schema**, not a claim that the plugin emits this exact object.

- [ ] **Step 1: Review and pin the actual upstream repository revision/license/bundle**; validate Codex plugin marketplace commands and hook trust semantics against the installed version and inspect any outgoing TypeSafe request shape. Reject global scope.
- [ ] **Step 2: Write the integration oracle before running:** synthetic public unpinned `spawn_agent` should invoke Jev once and choose a supported profile; pinned `model`, pinned `reasoning_effort`, pinned `agent_type` each bypass; a sensitive canary must never be submitted; malformed/missing config and simulated Jev failure use native defaults for safe work.
- [ ] **Step 3: Run isolated native Codex smoke:** trust the hook only for the pilot, send non-sensitive mission text, collect redacted router log and runtime traces (confirm actual served model where observable), compare against native fixed model. If hook unavailable, stop with `BLOCKED_INCOMPATIBLE_HOST` rather than fabricating success.
- [ ] **Step 4: Exercise explicit overrides, fallback and canary cases** with a local mock endpoint/test harness so secrets and test canaries do not reach TypeSafe. Confirm requests contain no private path/data; if not technically enforceable, **do not route private tasks**.
- [ ] **Step 5: Record exact installation/rollback commands and observed compatibility** in `pilot/README.md`; include how to disable the hook, restore Codex home/config, and retain credential safety.
- [ ] **Step 6: Commit** verified pilot runbook and any narrowly justified contract tests: `git commit -m "test(docs): document verified native Jev hook and rollback"`.

### Task 4: Prove OMX coexistence without duplicated routing

**Files:**
- Modify only if actual compatible and reversible: `integrations/codex-jev/pilot/README.md`
- Test: real capability matrix, with source-version/hook evidence in `pilot/RESULTS.md` after runs.

**Interfaces:**
- Consumes: Task 3 verified native routing, OMX version/config and native vs Team worker behavior.
- Produces: mode classification `native_jev`, `static_omx`, `native_default`, or `blocked` with trace evidence.

- [ ] **Step 1: Snapshot the isolated pilot Codex config**. Check `omx doctor`, generated `AGENTS.md`, `hooks.json`, `config.toml`, `agentModels` and `agentReasoning` precedence. Do not call global `omx setup`.
- [ ] **Step 2: Run an unpinned native Codex child from OMX context:** verify whether the plugin hook was actually reached and Jev selected the candidate. Expected `native_jev` **only when observed**.
- [ ] **Step 3: Run an OMX role or Team task with explicit pin:** verify bypass and classify `static_omx`; do not override the pin or claim Jev handled it.
- [ ] **Step 4: Compare duplicate/ordering conflicts between OMX hooks and Jev plugin;** if hooks conflict or Team does not use native `spawn_agent`, retain native-only pilot as the safe outcome. Any attempted adapter requires its own user-reviewed follow-on spec and tests.
- [ ] **Step 5: Reconfirm rollback restores the original isolated configuration and makes no changes to global `~/.codex`**. Update runbook and commit `git commit -m "test(docs): verify OMX Jev integration boundaries"`.

### Task 5: Repeatable objective benchmark and quality gate

**Files:**
- Create: `integrations/codex-jev/src/metrics.mjs`
- Test: `integrations/codex-jev/metrics.test.mjs`
- Create after actual runs: `integrations/codex-jev/pilot/RESULTS.md`

**Interfaces:**
- Consumes: records `{taskId, mode: 'baseline'|'adaptive', replicate, durationMs: number|null, workerTokens: number|null, jevCalls: number|null, servedModel: string|null, testsPassed: boolean, blockingDefects: number, reviewerApproved: boolean}`.
- Produces: `compareRuns(records) -> {comparable: boolean, byTask: object, tokenSavingPercent: number|null, elapsedSavingPercent: number|null, qualityPassed: boolean, gaps: string[]}`.

- [ ] **Step 1: Write failing tests** for complete paired cases, non-paired tasks, missing tokens/unknown model (not zero), division by zero, rejected review/failed tests, uneven replicates, negative/invalid metrics, and the case where latency improves but defects increase.
- [ ] **Step 2: Confirm RED:** `node --test integrations/codex-jev/metrics.test.mjs`.
- [ ] **Step 3: Implement** `compareRuns(records)` as a pure reproducible comparison, with no invented currency rates and explicit `null` where unmeasurable.
- [ ] **Step 4: Confirm GREEN:** same command.
- [ ] **Step 5: Execute 3 non-sensitive canonical tasks** (read-only repo lookup; bounded fix in throwaway fixture; independent reviewer) with 3 replicates per variant where available, native vs adaptive, matching model availability and test oracle. Record real wall time, worker tokens, routing calls, failures and reviewer findings. Avoid running concurrent write jobs against one shared worktree.
- [ ] **Step 6: Publish only redacted observed results** in `pilot/RESULTS.md`: baseline/adaptive model and reasoning, evidence references, accepted defects, measured percentage or `unknown`, and explicit `GO`, `PARTIAL`, or `NO_GO`. Mark target 20% fewer worker tokens / 25% shorter duration as unmet unless measurements prove it.
- [ ] **Step 7: Commit** metric code/tests and measured report: `git commit -m "test(codex-jev): benchmark adaptive routing versus native baseline"`.

### Task 6: Independent audit, rollback proof and final DoD

**Files:** Previous tasks only; no miscellaneous documentation or sweeping refactor.

**Interfaces:** Takes spec + task receipts + real hooks/metrics; produces review verdict with file/line findings and `GO`, `PARTIAL_VERIFIED`, or `NO_GO`.

- [ ] **Step 1: Run focused suite:** `node --test integrations/codex-jev/*.test.mjs`. If scope touched existing fleet (should not), run `cd persistd && node --test typesafe-fleet-router.test.js` and explain why.
- [ ] **Step 2: Request independent Anti-Slop review** of changed files, real host compatibility, exposed task text, bypass semantics, token accounting and test integrity; address actual findings, not imagined issues.
- [ ] **Step 3: Verify rollback** in the isolated test environment; assert foreign profiles/global user config unchanged and no scheduled background workers or runtime cloud deployment added.
- [ ] **Step 4: Reconcile spec checklist and record** actual Codex/OMX/TypeSafe route evidence, costs (if available), failures, reviewer verdict, commit SHAs, tests and no-merge/no-deploy authorization boundary.
- [ ] **Step 5: Commit** only necessary corrections and evidence. Open/update a reviewable draft PR with the GOAL, spec and plan, exact test commands and remaining blockers. Never merge/deploy without explicit authorization.

## Execution checkpoints

- **Checkpoint A (after Task 1):** verified native capabilities and safe host-dependent profiles; otherwise stop rather than guess.
- **Checkpoint B (after Task 3):** one real native Jev-routed unpinned child and explicit-pin bypass proven; if not, `PARTIAL_VERIFIED` at most.
- **Checkpoint C (after Task 4):** OMX coexistence proven per mode; failure does **not** negate a working native pilot, but removes the OMX claim.
- **Checkpoint D (after Task 6):** independently reviewed measurements, quality and rollback evidence; no promotion without authority.

## Plan self-review checklist

- [ ] Task 1 covers host and model/effort truth; Task 2 covers isolated provisioning; Task 3 covers real hook/privacy/pins/fallback; Task 4 covers OMX precedence; Task 5 covers measured benefit; Task 6 covers independent quality and rollback.
- [ ] No new code called for until spec review; no speculation is presented as a verified production state.
- [ ] Every internal function in later tasks matches its defining Interfaces block; no custom router or proxy was accidentally introduced.
- [ ] All five Review Focus hazards have a named test or real integration gate.
- [ ] Any blocked integration is reported honestly; no manufactured live key, token savings or served-model evidence.

**Execution recommendation after review:** Start with a native Codex worker implementing Tasks 1–3 sequentially with independent review per task; run Task 4 only after the native hook is proven; finish with benchmark, external reviewer and explicit promotion gate. The plan's independent review expense is justified because hooks can leak task text and rewrite model selection.
