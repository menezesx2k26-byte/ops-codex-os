# Ditto.site on Hostinger VPS: lightweight integration candidate

Status: **RUNTIME_VERIFIED / DEMO_CLONE_GENERATED / NO_ALWAYS_ON_MCP**

Date: 2026-11-22. This document describes a candidate and explicit gates, not a running service or security certification.

## Goal

Keep the Windows workstation unchanged. Integrate the open-source `ion-design/ditto.site` capture-to-code compiler into the existing agent workflow using **Hostinger VPS 2135319** only when justified by a real cloning request.

## Verified sources

- Ditto upstream: https://github.com/ion-design/ditto.site
- Pin inspected: `3860a1a3a340069eabbfc550fd49807dd10f4f2c`
- Upstream source metadata: `compiler/package.json` declares `playwright: 1.56.1`.
- Usage: upstream README documents hosted REST/MCP and a local CLI with Node >=20, npm dependencies and Chromium. Upstream warns that arbitrary app logic, auth/payments/personalization and third-party JS are not fully reproduced.
- Upstream security policy: protect arbitrary URL fetch against SSRF; running Chromium is estimated at ~0.5-1 GiB per clone.

## VPS read-only reconnaissance (2026-11-22)

From the Hostinger VPS MCP:
- Instance running; plan KVM 2, 2 vCPU, 8192 MiB RAM, 102400 MiB disk, Ubuntu 24.04 with Docker.
- In the 2026-11-21 ~23:47 UTC metrics sample: RAM used ~5.27 GiB; disk used ~43.87 GiB; CPU ~5.83%. Time-series RAM sample peaked ~5.84 GiB. These are **historical**, not admission guarantees.
- `vps_docker_list` returned 22 Docker Compose projects including active Punctum production + QA, MCP hub, proxy/Caddy, Playwright and browser containers.
- A separate active browser backend image uses `mcr.microsoft.com/playwright:v1.65.0-noble`, which **does not match** Ditto's pinned Playwright 1.56.1.
- At reconnaissance, no Ditto runtime was present; subsequently a pinned on-demand executor was installed on the VPS and verified against `https://example.com/`. No Windows dependencies were installed.

## Decision

**Implemented:** no permanent Ditto service, second long-running browser, PostgreSQL, MinIO or open port. The upstream repo is checked out sparsely at the pinned SHA (5 MB initial source). A separate Playwright image pinned to the exact 1.56.1 version is cached on the VPS and launched only for a clone job. Each job runs in a disposable, non-root container bounded to 1 vCPU and 1.5 GiB memory, writing exclusively to `/opt/ditto-vps/work/`; the user workstation requires only its already-present SSH client/key. This image does occupy VPS disk, not Windows disk.

The VPS Hostinger MCP offers the Docker Compose project API, but not a general-purpose shell. Compose creation alone does not prove the service runs or works. Avoid publishing unverified compose with a wide-open port or running dynamic installs on each startup.

## Deployment gates

1. Check resource usage **again immediately before** deployment. Require conservative headroom after reserving production services; reject if memory pressure or OOM/restart evidence is observed.
2. Security-review and pin the upstream SHA, lockfile and any base image by digest. Verify compatible browser binary, dependencies, egress restrictions and SSRF protections.
3. Prepare a minimal isolated container with resource limits and no access to host paths, Docker socket or production networks/secrets. Prefer disposable volumes/output and automatic teardown.
4. Prove a local-only authenticated API/MCP transport using a separate staging route before any cross-network accessibility. Reuse the established HTTPS gateway only via a reviewed change.
5. Test against an authorized, public demo page. Record job status, manifest, files, screenshots, resource usage and teardown. Use visual-parity and frontend-quality-reviewer gates.
6. A demonstration clone of `https://example.com/` and generated Next.js project build is recorded in `docs/evidence/ditto-vps-20261122.md`. Real targets still require explicit approval and separate testing.

## Operator notes

- Do not use `npx ditto`: upstream says the CLI workspace is repository-local and not yet published for global npm use.
- Do not run `scripts/install.ps1` from Codex OS to install this skill. That installer also synchronizes vendor repositories.
- For Codex, the skill must be made available by the existing targeted skill-loading mechanism; a GitHub merge alone does not prove a local installation.
- Keep credential material outside Git and avoid displaying environment or compose secrets during diagnostics.
- This candidate does not change existing web services, DNS, firewall, Docker projects or global agent policy.

## Operator setup and invocation

- Host runner: `/opt/ditto-vps/runner.sh`; version-controlled copy: `skills/ditto-vps-reconstruction/scripts/vps-runner.sh`.
- Invoke from Codex on the authorized Windows workstation via `skills/ditto-vps-reconstruction/scripts/invoke.ps1 -Url https://example.com/` after targeted skill installation.
- The client uses existing `~/.ssh/hostinger_vps_2135319_agent_ed25519` and a temporary pinned host-key record, without modifying persistent SSH settings. Access from cloud Codex without that SSH identity is **not established**.
- No deployment occurred on Punctum, Caddy, the MCP hub or existing production websites. No credential, domain or firewall setting was changed.
- URL validation checks initial DNS resolution, but it does **not** inspect every redirect/subresource request; never expose the runner to untrusted tenants or unrestricted external job submission.
