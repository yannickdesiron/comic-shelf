<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Comic Shelf — working agreement

Self-hosted app for cataloguing a personal comic collection. Solo project.
Read `README.md` for stack, domain model and project layout. Do not restate it.

## Where work is tracked

**ClickUp is the board. GitHub is the engine. This repo is the truth for code and docs.**

- Tasks live in ClickUp (Space: Comic Shelf)
- Code, branches, PRs live on GitHub (`yannickdesiron/comic-shelf`)
- Documentation lives in `docs/` and `README.md` — never in ClickUp Docs

## Reaching the board

Two routes, described in `docs/workflow.md`.

**REST API** with `CLICKUP_API_TOKEN` from the shell. No quota. This is the
default when the token is present: check with `env | grep CLICKUP`. The
Development list is `901222154775`.

**MCP connector**, when it is enabled in the chat. 100 calls per rolling
24 hours on the Free plan, so the rules below apply.

## ClickUp MCP — quota discipline

Treat every MCP call as expensive.

**Do:**
- Fetch tasks with ONE list-level call, scoped to the Comic Shelf list.
- Reuse what is already in the conversation. A task ID mentioned earlier is
  not fetched again.
- Batch task creation into a single call when adding several tasks.
- Read documentation from the repo with normal file tools — zero ClickUp calls.

**Do not:**
- Change task status via MCP. The git flow below does it for free.
- Search workspace-wide. Always scope to the Comic Shelf list.
- Fetch tasks one by one when a list call returns them together.
- Poll the board "to check". Ask Yannick.

Budget: a normal session should cost 2–4 MCP calls.

## Git flow

Branch naming keeps the existing `feature/` prefix and adds the ClickUp task ID:

    feature/CU-<taskid>-short-description
    fix/CU-<taskid>-short-description

Commit messages carry the task ID so the commit shows up on the task:

    CU-86a4x2p9k: add language filter to shelf

PR description includes `CU-<taskid>`. A merged PR moves the task to COMPLETE
via ClickUp automation — never close the task by hand.

When Yannick gives a task ID, use it as-is. When he describes work without one,
ask whether to create the ClickUp task first. Do not create tasks unprompted.

## Definition of done

Before opening a PR, the four CI checks must pass locally, and the last two
lines must hold:

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `README.md` updated if behaviour or the domain model changed
- [ ] Task ID in branch name, commits and PR description
