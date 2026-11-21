# Codex + Jev Adaptive Delegation — Design

**Date:** 2026-11-20  
**GOAL:** `CODEX-JEV-INTELLIGENT-ORCHESTRATION-20261120`  
**Status:** APPROVED for isolated pilot on 2026-11-20; implementation PARTIAL_VERIFIED; live Jev/OMX remains gated  
**Owner:** Gabriel Codex OS (`menezesx2k26-byte/ops-codex-os`)  
**Scope:** isolated Codex/OMX pilot, not PersistFlow production

## Intent and success criteria

Make Codex choose **whether** to delegate, **which eligible model/reasoning profile** should run each independent subtask, and **when** to escalate to a stronger model or reviewer. Measure task completion quality, total model tokens, wall-clock time, and retried work against an equivalent native-Codex baseline. Jev/TypeSafe is a semantic **choice** service, not a coding model or source of truth. User-reported unlimited Jev access is a hypothesis to validate without publishing credentials or saturating the service.

Desired outcome: one independently repeatable and reversible, verified real Codex native-subagent delegation with Jev route evidence; OMX integration only after that gate. No performance improvement, cost saving, production readiness, live API entitlement, or installed configuration is claimed by this design.

## Existing context, authority and reuse

- `persistd/src/fleet/typesafe-router.js` and `persistd/src/fleet/router.js` already route **eligible execution nodes** with Jev and deterministic fallback. **Do not modify or reuse their node-selection contract for model routing.**
- `global/AGENTS.md` already enforces context-first, `reuse-first-router`, `context-budget-manager`, narrow verification, Superpowers, evidence, and secure/no-cost controls.
- `scripts/install.ps1` copies global Codex instructions to `~/.codex/AGENTS.md`, so running it (or global OMX setup) during the pilot could overwrite unrelated configuration.
- Approved consolidation spec `docs/superpowers/specs/2026-10-02-platform-consolidation-design.md` requires one authoritative owner per domain, platform-owned interfaces, no extra durable state authority, and temporary/removable compatibility shims.
- `menezesx2k26-byte/ops-gabriel-ops` already enforces a TypeSafe guardrail for dispatch/prepare/promotion. This pilot **does not bypass or replace** that guardrail, its existing write restrictions, or approval gates.

Upstream verified sources (check installed versions at execution):
- Codex native agents: https://learn.chatgpt.com/docs/agent-configuration/subagents
- OMX official: https://github.com/Yeachan-Heo/oh-my-codex
- OMX model/effort precedence: https://github.com/Yeachan-Heo/oh-my-codex/blob/main/docs/reference/omx-config-schema-routing.md
- Jev native-hook router: https://github.com/guilhem/codex-subagent-router
- TypeSafe docs: https://docs.typesafe.ai

## Alternatives considered

1. **Codex native agents + fixed profiles**: lowest operational complexity; no dynamic Jev routing. This is the benchmark and mandatory fallback.
2. **Codex native agents + upstream Jev `PreToolUse` plugin**: smallest adaptive vertical slice; selects profiles only for eligible **unpinned** `spawn_agent` calls; failures defer to native defaults. **Recommended for phase 1.**
3. **OMX Team/Swarm + native Jev plugin**: comprehensive orchestration but some OMX roles set `agent_type` or model/effort explicitly, which **bypasses** the plugin. **Conditional phase 2** only with routing proof, not an assumed seamless composition.
4. **Custom proxy/full model gateway**: could control every turn but adds account/auth interception, vendor contracts, privacy risk, duplicated authority and regression surface. **Rejected for pilot.**

The user's preference for the OMX + Jev combination is preserved as the **target**. The rollout is staged so upstream components are reused rather than duplicated.

## Authority and integration architecture

1. **Task orchestrator:** Codex native dispatch decides task decomposition, real parallel independence, and whether to spawn at all. OMX may orchestrate teams, but does not become a second model-routing authority for the same native spawn.
2. **Model policy:** a versioned, minimal, host-verified list of `{description, model, reasoning_effort}` profiles. The Jev plugin chooses between these on an **unpinned** `spawn_agent` through its official `PreToolUse` hook. Do not invent unsupported model IDs or reasoning values. Explicit user/model/agent-type overrides take precedence.
3. **Execution-node policy:** existing `FleetRouter` unchanged. It chooses where to execute tasks, not which model a Codex child uses.
4. **Safety policy:** actual sandbox, permission boundary, Git evidence and independent tests always override semantic judgments. No external prompt with secrets, private source, personal data or access tokens during the pilot. No global hook enabling. Require payload observation in an isolated non-sensitive test before allowing any private project.
5. **Persistence:** specs/plans/evidence in Git with run-specific redacted measurements. Do not create another memory authority or auto-upload task text to Drive/Engram.
6. **Runtime placement:** separate local Codex home/isolated public fixture. Project-scoped OMX installation only after backup, inspect generated `AGENTS.md`, `config.toml`, `hooks.json` and verify the `CODEX_HOME` path. No Hostinger/VPS production action.

## Capability gates and conditional behavior

- First verify real local Codex/CLI version, `spawn_agent`, plugin marketplace, hook trust and execution, available model IDs and effort support, Jev credential presence **without showing its value**, and OMX version. Neither a README nor `omx doctor` alone proves the hook executed or that the selected model served the task.
- Use the upstream plugin's JSON profile catalog, preserving existing user-edited profiles. Prefix profiles with `gabriel-`; avoid custom routing code unless a measured incompatibility requires a minimal adapter.
- In OMX mode, route through Jev **only where** the hook receives unpinned native subagent calls; where OMX pins model/effort/agent_type or runs workers outside the hook, use OMX's documented `agentModels`/`agentReasoning` profiles or Codex defaults, labeled `static`, **never** falsely recorded as Jev-routed. Never force an override of an explicit pin.
- Disable routing for sensitive missions; no sending private prompt text or metadata to TypeSafe without separately verifying redaction and authorization.
- On missing Jev key, malformed catalog, invalid response, unavailable host model, incompatible hook, or timeout, use native defaults **only for safe delegation**; blocked security/authorization actions fail closed. No silent downgrade of quality-critical review.
- Maximum pilot concurrency: two child agents initially; no duplicate worker edits to one worktree/file. Scale after reproducible proof. User's existing guardrails retain priority.
- A model choice is not proof of served model. Collect runtime-confirmed model/effort if available; otherwise mark `served_model: unknown`.

## Pilot evaluation

Use three immutable, non-sensitive, reproducible tasks: read-only repository discovery, bounded unit-test fix on a throwaway fixture, and independent review of that fix. Run the same cases through native fixed-profile Codex and adaptive native-subagent Codex with a fixed output rubric. Repeat at least three times per variant if quotas/host permit. Record model-token usage, Jev routing calls, elapsed time, retries, correctness, passed tests, and explicit quality defects. Compare like-for-like settings and report missing metrics as `unknown`, not zero.

**Goals to test, not promised outcomes:** at least 20% reduction in measured worker-model tokens or 25% shorter wall-clock time on eligible tasks, with zero new blockers, safety regressions, or accepted defects. Report quality and cost tradeoffs even if the pilot fails. Do not claim monetary savings when actual cost/quota information is unavailable.

## Out of scope

No autonomous deploy, DNS/cutover, purchases, credential mutation, unrestricted sandbox, merge, production node changes, hidden background scheduler, new long-term state store, bespoke proxy, user private-repo execution, blanket model substitutions, or replacement of Superpowers/Anti-Slop gates.

## Definition of Done

1. Source and implementation plan reviewed; architecture authority stays with Codex OS.
2. A clean, opt-in, reversible isolated installation documented with exact verified versions and rollback.
3. At least one real unpinned native `spawn_agent` event demonstrably reaches the trusted Jev hook; explicit pins demonstrably bypass it, with redacted trace evidence.
4. Invalid/missing key/model/catalog and provider outage scenarios are tested; sensitive fixture cannot be sent to TypeSafe; hook conflicts are tested.
5. OMX integration states separately whether native Jev hook is applicable to each execution mode; no unverified combined-routing claim.
6. Repeatable baselines, honest measured tokens/time/quality table, and independent reviewer sign-off; no safety regressions.
7. PR remains unmerged until review and authorization. An actual installed/pilot runtime is not implied by documentation or CI alone.

**Decision/revisit triggers:** upstream hook compatibility changes; Codex/OMX version drift; any sensitive payload transmission; model mismatch; duplicate routing; negative cost/quality measurements; no meaningful adaptive benefit. Revert or prefer native-only when observed evidence warrants it.
