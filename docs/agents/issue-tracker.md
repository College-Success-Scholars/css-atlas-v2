# Issue tracker: GitHub

Issues and PRDs for this repo live as **GitHub Issues** — the only backlog. Use the `gh` CLI for all operations (`gh` must be installed and authenticated: `gh auth login`).

## Create (preferred: templates)

Use GitHub’s issue forms under **New issue**:

| Template | When |
|----------|------|
| Bug | Incorrect behavior for a role/flow |
| Feature | New or changed product behavior |
| Chore | Tooling, cleanup, docs, CI |
| Architecture alert | Structural/runtime finding |

Forms apply type labels (`bug` / `feature` / `chore` / `architecture-alert`). The [issue-triage](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/.github/workflows/issue-triage.yml) Action adds `needs-triage` when no triage label is present.

Bootstrap labels once per repo (or after fork):

```bash
./scripts/ensure-issue-labels.sh
```

## Conventions (`gh`)

- **Create**: `gh issue create --title "..." --body "..."` (heredoc for multi-line bodies), or the UI templates / `./scripts/alert.sh` for architectural alerts.
- **Read**: `gh issue view <number> --comments`
- **List**: `gh issue list --state open --json number,title,body,labels,comments --jq '...'` with `--label` filters.
- **Comment**: `gh issue comment <number> --body "..."`
- **Labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this when run inside a clone.

## Workflow

```text
File issue (template or alert.sh)
  → needs-triage (Action or script)
  → maintainer: needs-info | ready-for-human | ready-for-agent | wontfix
  → implement → PR with Fixes #<N>
  → merge closes issue
```

Only **Ready** labels mean pull-to-work. Do not self-apply Ready on intake.

Optional Kanban board (columns ↔ triage labels): [github-project-board.md](github-project-board.md).

## Architectural alerts (GitHub only)

Former `docs/agents/alerts/*.md` backlog is retired. **Open architectural work is Issues labeled `architecture-alert`.**

Agents and humans **must** list them with:

```bash
gh issue list --label architecture-alert --state open
```

Do not invent work from stale markdown under `docs/agents/alerts/` (see [README](alerts/README.md) there).

**Create (CLI)** — requires `gh` auth; no offline file fallback:

```bash
./scripts/alert.sh \
  --title "short-kebab-title" \
  --severity warning \
  --category integrity \
  --description "..." \
  --recommendation "..."
```

**Resolve** — logs a session, then closes the issue if still open; if already closed by `Fixes #N`, comments only (does not fail):

```bash
./scripts/resolve-alert.sh --issue <N> --summary-text "What you fixed"
```

**One-time migration** (if legacy alert `.md` files still exist):

```bash
./scripts/ensure-issue-labels.sh
./scripts/migrate-alerts-to-issues.sh
```

## When a skill says "publish to the issue tracker"

Create a GitHub issue (template or `gh issue create` / `alert.sh`).

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
