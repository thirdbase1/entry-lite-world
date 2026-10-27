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

- **Runs** (`#/`) — paginated table with status dot, run id (mono), workflow name, started time, duration. Filter by status (dropdown), search by run id (debounced), 25 per page.
- **Run detail** (`#/run/:runId`) — header (status dot, id, workflow, duration, spec version), input/output decoded as JSON code blocks, error block when failed, chronological event timeline (type badge + timestamp + payload preview), steps table, hooks table.
- **Queue health** (`#/queue`) — per-queue job stats (pending, locked, oldest pending age, total) from `entrylite.workflow_jobs`, plus dead-letter list with a **Requeue** button (moves payload back into `workflow_jobs` and deletes the dead-letter row).

## Auto-refresh

Toggle in the header: re-polls the active page every 5 s.

## API

| Route | Description |
|---|---|
| `GET /api/runs?status=&q=&page=&pageSize=` | Paginated run list (total + rows) |
| `GET /api/runs/:runId` | Full run detail: steps, events, hooks, decoded input/output |
| `GET /api/queues` | Queue stats from `workflow_jobs` |
| `GET /api/dead-letter` | Dead-letter rows (schema-agnostic column detection; empty if the table doesn't exist yet) |
| `POST /api/dead-letter/requeue` `{id}` | Requeue one dead-letter job |

## Payload decoding

Serialized event/input payloads of the form
`{"data": "<base64 of 'devl' + devalue-string>", "__type": "Uint8Array"}`
are decoded server-side via the `devalue` package (base64 → utf8 → strip `devl` → `devalue.parse`) and returned as plain JSON.

Workflow names like `workflow//./workflows/features//testBasic` are prettified to `testBasic`.
