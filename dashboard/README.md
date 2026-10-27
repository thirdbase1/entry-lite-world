# @entrylite/world — Observability Dashboard

Dark (Vercel Geist–style) observability dashboard for the entrylite workflow engine, backed directly by Postgres (`postgres://world:world@127.0.0.1:5432/workflow`, schema `entrylite`).

## Run

```sh
npm install
npm start        # serves on http://localhost:3300
```

Environment overrides: `PORT` (default `3300`), `DATABASE_URL`.

No build step — Express API + static vanilla-JS frontend, single process.

## Pages

- **Runs** (`#/`) — paginated table with status badge + dot, run id (mono), workflow name, duration (right-aligned mono), relative started time. Status pill filter, search by run id (debounced), 25 per page, click any row for detail.
- **Run detail** (`#/run/:runId`) — breadcrumb, status badge + workflow title, meta row (run id, started, duration, spec version), error card when failed, decoded input/output JSON code blocks, underline tabs: Timeline (event rail with status dots + expandable payloads), Steps table, Hooks cards, Events JSON.
- **Queue health** (`#/queue`) — per-queue cards (total depth heading-32, pending, locked, oldest pending age) from `entrylite.workflow_jobs`, plus dead-letter table with a **Replay** button per row (inserts payload back into `workflow_jobs`, deletes the dead-letter row; dead letter PK is `job_id`).

## Auto-refresh

Toggle in the header: re-polls the active page every 5 s.

## API

| Route | Description |
|---|---|
| `GET /api/runs?status=&q=&page=&pageSize=` | Paginated run list (total + rows) |
| `GET /api/runs/:runId` | Full run detail: steps, events, hooks, decoded input/output |
| `GET /api/queues` | Queue stats from `workflow_jobs` |
| `GET /api/dead-letter` | Dead-letter rows (schema-agnostic column detection; empty if the table doesn't exist yet) |
| `POST /api/dead-letter/requeue` `{id}` | Requeue one dead-letter job (`id` = `job_id`) |

Design follows `docs/dashboard-design.md` (Geist tokens verbatim, dark theme default, light toggle, sidebar shell, underline tabs, status dots/badges per §6).

Requires the `devalue` package for payload decoding — resolved from the sibling `entry-agents` install; point `DEVALUE_PATH`-style override by editing the `require` in `server.js` if needed, or `npm i devalue` and switch to `require('devalue')`.

## Payload decoding

Serialized event/input payloads of the form
`{"data": "<base64 of 'devl' + devalue-string>", "__type": "Uint8Array"}`
are decoded server-side via the `devalue` package (base64 → utf8 → strip `devl` → `devalue.parse`) and returned as plain JSON.

Workflow names like `workflow//./workflows/features//testBasic` are prettified to `testBasic`.
