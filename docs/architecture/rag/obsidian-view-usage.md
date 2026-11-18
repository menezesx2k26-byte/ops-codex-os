# Obsidian as a derived view of Context Gateway sources

This is a **visualization**, not an additional RAG, search provider or source of truth.

## Controlled-agent recall path

For context-dependent requests, a controlled host invokes `createContextGateway().answerWithContext()`, supplies a trusted resolver for its active scope and waits for its receipt before producing an answer. Project answers accept verified Git evidence; separate project-derived corpus answers are non-authoritative candidates. Personal recall uses a separately authenticated owner lane. An absent/stale/denied retrieval never becomes a fabricated memory. This repository's global Context HEAD rule applies only where the agent harness actually implements it.

No Obsidian file is ever used to derive an authorization scope, bearer token, index generation or routing decision. Obsidian can be closed, uninstalled or offline without changing gateway behavior. The consumer ChatGPT application cannot be technically forced to invoke connected tools by this repo alone.

## Create a private view (Node.js 22+)

Keep the manifest and output **outside public Git repositories** and in a protected user directory.

Example `manifest.json` (synthetic sources only):

```json
{
  "sources": [
    {
      "id": "example-project",
      "title": "Example Project",
      "scope": "project/example/project",
      "authority": "git",
      "url": "https://github.com/example/project/blob/main/README.md"
    }
  ]
}
```

Run:

```powershell
node scripts/obsidian-view.js C:\private\manifest.json C:\private\obsidian-vault-new
```

The output directory **must not exist**. It contains `00-Home.md` and individual source notes with Obsidian wikilinks. Open that existing folder as a vault in the Obsidian app. It can also be browsed as plain Markdown. Regenerate into a fresh output directory if the manifest changes; the script does not overwrite user notes.

Only HTTPS links on `github.com`, `docs.google.com`, and `drive.google.com` without query strings, credentials or fragments are accepted. URL paths with characters capable of breaking Markdown links are rejected. It neither fetches documents nor ingests their content, and the files are not indexed for agent recall.

## Authority and privacy

- Git owns code, project decisions and verified implementation evidence.
- Private Memory owns durable account context, not project architecture.
- Drive owns its documents/Sheets and may store derived corpus projections as explicitly approved.
- PersistFlow owns run/generation/checkpoint authority.
- Engram gives episodic candidate evidence subject to source reconciliation.
- The Context Gateway resolves allowed scopes from authenticated host identity. A visual scope label in a note is never access permission.
- Do not commit private manifest files or generated vaults to this public Agent OS repository, or publish private Drive/GitHub links in issues or CI logs.
- Do not treat Graph View, Obsidian plugins, cloud sync or the generated Markdown as a completed live multi-RAG integration.

## Further work / release gates

The private cloud Context Gateway still requires authenticated-positive retrieval, denial across namespaces, freshness/revision proof, Windows-off exercise and rollback/owner-key custody verification before a production cutover. PR #65 and other stacked RAG drafts must be reconciled. No cost-incurring service or automatic sync is part of this slice.
