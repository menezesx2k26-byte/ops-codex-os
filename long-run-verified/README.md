# Long Run Verified MCP (candidate)

GOAL LONG-RUN-VERIFIED-MCP-001. Independent from legacy PersistFlow. Nine Streamable HTTP MCP tools implement start, next, checkpoint, verify, finish, status, continue, handoff and compact. Canonical state is a dedicated owner-private Google Doc containing a bounded multi-mission ledger; writes use requiredRevisionId and readback. GitHub remains authoritative for evidence. Every PASS is caller-reported; independently inspect real artifacts before treating a mission as verified. No automatic worker, timeout extension, deletion or reset tool.

Prefer the Composio authenticated proxy adapter with a narrowly scoped project key; the existing Google drive.file OAuth provider remains an explicit alternative. Do not store secrets in the ledger or code. See [DEPLOYMENT.md](DEPLOYMENT.md) for exact configuration, smoke checks, safe private toolkit registration and rollback. Do not create new legacy PersistFlow runs.

The skill protocol is to recover the current run, reconcile real evidence, choose an authorized action, execute, verify, checkpoint and continue while useful safe work remains. Preserve failed gates and blockers. A terminal status is COMPLETE_REPORTED, not independently certified. The user or agent must invoke the next run or an explicitly configured worker; no platform time limit is modified.
