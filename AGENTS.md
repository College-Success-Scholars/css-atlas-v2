## Agent skills

### Issue tracker

Issues are tracked in this repository's GitHub Issues and managed via `gh` (`gh auth login` required). See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the canonical default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Architectural alerts

Architectural alerts are **GitHub Issues** labeled `architecture-alert` — not files under `docs/agents/alerts/`. Discover open work with:

```bash
gh issue list --label architecture-alert --state open
```

Open via the **Architecture alert** issue template or `./scripts/alert.sh`. Resolve with `./scripts/resolve-alert.sh --issue <N>`.

To check whether open alerts still match the tree, use the project skill `.cursor/skills/scan-architecture-alerts/` (“scan alerts”).

### Domain docs

Domain docs use a single-context layout (root `CONTEXT.md` + `docs/adr/` when present). See `docs/agents/domain.md`.

## Knowledge base

The codebase has a specfic structure to follow and to generally maintain. See `docs/agents/codebase-notes.md`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
