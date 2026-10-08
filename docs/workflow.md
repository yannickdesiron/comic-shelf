# Workflow — ClickUp + GitHub

How work moves from idea to shipped.

## The split

| Concern | Lives in |
|---|---|
| What needs doing, priority, status | ClickUp |
| Code, branches, pull requests | GitHub |
| Documentation | `README.md` and `docs/` |

Documentation deliberately does not live in ClickUp Docs. It stays next to the
code it describes, versioned with it, and readable without spending API quota.

## ClickUp setup

Space **Comic Shelf**, one List: **Development**.

Statuses:

```
Not started   BACKLOG        ideas, ungroomed
              TO DO          ready to pick up
Active        IN PROGRESS    branch exists
              IN REVIEW      PR open
Closed        COMPLETE       merged
```

ClickApps on: Priority, Tags, Custom Fields, Due dates, Milestones,
Show status progress. Everything else off.

One custom field, **Milestone** (dropdown), with `v0.2` as its only value for
now. Tags in use: `feature`, `ux`, `docs`, `v0.2`.

GitHub integration: connect as a **workspace connection**, select
`yannickdesiron/comic-shelf`. Then two automations on the Development list:

- When PR is opened → `IN REVIEW`
- When PR is merged → `COMPLETE`

Automations run inside ClickUp and cost no MCP quota.

## Reaching the board from Claude

Two routes. They do the same thing; pick whichever is set up.

**REST API with a personal token.** No quota, works in any session that has a
shell. Create a token in ClickUp under Settings → Apps, then export it:

```bash
export CLICKUP_API_TOKEN=pk_...   # in ~/.zshrc
```

The Development list is `901222154775`, the Comic Shelf space `901210226644`.
Fetching the board is one call:

```bash
curl -s -H "Authorization: $CLICKUP_API_TOKEN" \
  "https://api.clickup.com/api/v2/list/901222154775/task?include_closed=true"
```

**MCP connector.** Friendlier, but capped at 100 calls per rolling 24 hours on
the Free plan. Add it as a connector:

- Name: `ClickUp`
- Remote MCP Server URL: `https://mcp.clickup.com/mcp`
- Auth: OAuth

Enable it only in chats working on this project, and follow the quota rules in
`AGENTS.md`.

## The loop

1. **Create the task** in ClickUp. Copy its task ID (`CU-...`).
2. **Branch** — `git checkout -b feature/CU-<taskid>-short-description`
3. **Work.** Claude reads the repo directly. No ClickUp calls needed.
4. **Commit** — `CU-<taskid>: what changed`
5. **PR** — `CU-<taskid>` in the description → task moves to `IN REVIEW`
6. **Merge** — task moves to `COMPLETE`

Steps 2–6 cost zero MCP calls.

## Quota (MCP route only)

100 MCP calls per rolling 24 hours on ClickUp Free. Rolling, not calendar.
The REST token route is not subject to this.

| Action | Calls |
|---|---|
| Fetch open tasks for the Development list | 1 |
| Fetch detail of the task being worked on | 1 |
| Optional closing comment | 1 |

About 20–30 sessions a day before the limit bites. If you start hitting it, the
cause is almost always workspace-wide searches or per-task fetches — see the
rules in `AGENTS.md`.

## GitHub Issues

This project used GitHub Issues and the v0.2 milestone as its roadmap before
ClickUp. That roadmap has moved: `README.md` now points at the ClickUp board,
and every task carries a `GitHub: issue #n` line so the old issue can still be
found. The remaining step is closing issues #1–#10 with a pointer to their task,
tracked as its own task on the board.

Work that predates ClickUp (the scaffold and the seed script) was entered
retroactively with status COMPLETE, so the milestone progress bar is honest.

Issues that arrive from outside (someone filing a bug on the public repo) get
converted into a ClickUp task that references the issue number.
