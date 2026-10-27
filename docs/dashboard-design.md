# Dashboard Design Spec — Workflow Observability (Geist Style)

A build-ready spec for a workflow-run observability dashboard in the Vercel Geist design language. Follow it literally; do not invent alternative palettes or typefaces.

## 1. Design principles

- Black/white, high contrast. Color is reserved exclusively for status semantics — it never decorates.
- Structure comes from 1px borders and typography, not shadows or elevation.
- Data is set in monospace (Geist Mono); prose and labels in Geist Sans.
- Whitespace is generous and consistent (8px grid).

## 2. Color tokens

Define both a light and dark theme. Default theme: **dark** (#000 background) like the Vercel dashboard, with a light theme toggle.

### Neutral scale (CSS vars, per theme)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--ds-background-100` | `#ffffff` | `#000000` | Page background (Background 1) |
| `--ds-background-200` | `#fafafa` | `#0a0a0a` | Secondary surface (Background 2) — used sparingly |
| `--ds-gray-100` | `#ebebeb` | `#1f1f1f` | Component default background |
| `--ds-gray-200` | `#e5e5e5` | `#262626` | Hover background |
| `--ds-gray-300` | `#d4d4d4` | `#333333` | Active background; badge fills |
| `--ds-gray-400` | `#a8a8a8` | `#4d4d4d` | Default border (1px) |
| `--ds-gray-500` | `#8f8f8f` | `#666666` | Hover border |
| `--ds-gray-600` | `#666666` | `#8f8f8f` | Active border |
| `--ds-gray-700` | `#464646` | `#a8a8a8` | High-contrast background (primary buttons) |
| `--ds-gray-800` | `#2e2e2e` | `#d4d4d4` | Hover high-contrast background |
| `--ds-gray-900` | `#1a1a1a` | `#8f8f8f` | Secondary text, muted icons |
| `--ds-gray-1000` | `#000000` | `#ededed` | Primary text, primary icons |

(These are the standard Geist gray hex values; use them verbatim. Use `gray-alpha` equivalents only for shadows/overlays.)

### Status colors (semantic aliases over the Geist scales)

| Token | Maps to | Hex (light) | Meaning |
|---|---|---|---|
| `--status-completed` | `green-700` | `#007452` | Run/step completed, succeeded |
| `--status-completed-fg` | `green-100` | `#e0f2e9` | Badge text/fill on light; dark equivalents use the green scale's dark steps (`green-400`-ish `#50e3c2` family — use Geist green scale) |
| `--status-failed` | `red-700` / `red-100` | `#c11a1a` / `#f6d5d5` | Failed, error, dead-letter |
| `--status-waiting` | `amber-700` / `amber-100` | `#a1440b` / `#fde8cd` | Waiting, scheduled, retrying, queued |
| `--status-running` | `blue-700` / `blue-100` | `#0068d6` / `#d3e5ff` | Actively running |
| `--status-skipped` | gray-700/300 | — | Skipped, cancelled (gray badge) |

Rule: status color appears only as (a) a 6–8px status dot, (b) a subtle badge (10% tinted fill + full-saturation text, e.g. `#e0f2e9` fill / `#007452` text on light), or (c) a 1px timeline accent. Never large filled areas, never red/green backgrounds on rows.

## 3. Typography

- **Geist Sans** for all UI text. **Geist Mono** for: run IDs, step names, durations, timestamps, queue depths, code/log output, and all tabular numeric data (use `font-variant-numeric: tabular-nums` in Sans tables when mono is too heavy).
- Load via `next/font` or the `geist` npm package (`import { GeistSans } from 'geist/font/sans'`).

Scale (size / line-height / weight / tracking):

| Style | Size/LH | Weight | Use |
|---|---|---|---|
| heading-32 | 32/40 | 600, tracking −0.02em | Page title ("Runs") |
| heading-24 | 24/32 | 600 | Section headers in detail view |
| heading-16 | 16/24 | 600 | Card titles, panel headers |
| label-14 | 14/20 | 500 | Default UI text, table body, nav |
| label-14-strong | 14/20 | 600 | Table headers, emphasized labels |
| label-13 | 13/20 | 500 | Secondary/muted text, timestamps |
| label-13-mono | 13/20, Geist Mono | 500 | IDs, durations inline with labels |
| copy-14 | 14/24 | 400 | Paragraphs, empty-state descriptions |
| code-13 | 13/20, Geist Mono | 400 | Code blocks, logs |
| label-12 | 12/16 | 500 | Table footnotes, overline captions (often uppercase, `letter-spacing: 0.06em`) |

## 4. Spacing, radius, borders

- **Spacing:** 8px base grid. Common gaps: 4, 8, 12, 16, 24, 32, 48. Page gutter: 24px (desktop) / 16px (<768px). Max content width: 1200px, left-aligned with a fixed 240px sidebar.
- **Radius:** 6px default (cards, inputs, buttons, badges, code blocks); 12px for modals/popovers; 9999px for status dots and pill tabs only.
- **Borders:** 1px solid `--ds-gray-400` everywhere structure is needed (cards, table rows via `border-bottom`, dividers). Hover borders step to `--ds-gray-500`. Active/selected step to `--ds-gray-600` or 1px `--ds-gray-1000`.
- **Shadows:** avoid. Overlays only: `0 0 0 1px var(--ds-gray-400), 0 4px 12px rgba(0,0,0,0.16)` (light) with alpha grays.
- **Focus:** 2px outline `--ds-blue-700` offset 2px — never remove.

## 5. Page layout

### 5.1 App shell

```
┌──────────┬──────────────────────────────────────────┐
│ Sidebar  │ Top bar (sticky, Background-100,         │
│ 240px    │ 1px bottom border): breadcrumb,          │
│ fixed    │ global search (⌘K), theme toggle         │
│ nav      ├──────────────────────────────────────────┤
│          │ Main content: max-w 1200, px-24 py-32    │
└──────────┴──────────────────────────────────────────┘
```

Sidebar: plain Background-100, nav items are label-14, active item gets `--ds-gray-100` fill + 6px radius. Sections: Runs, Schedules, Hooks, Dead Letter, Queues, Settings. Icons 16px, 1.5px stroke, gray-900.

### 5.2 Runs list (`/runs`)

1. **Header row**: heading-32 "Runs" left; right side a primary button ("Run workflow now") and a secondary "Filters" button.
2. **Summary strip** (optional): 4 inline stats, separated by 1px vertical dividers — "Running 3" (blue dot), "Waiting 12" (amber), "Failed 2" (red), "Completed 1,204" (green). Numbers in mono label-14; labels label-13 gray-900.
3. **Filter bar**: pill-style tabs or segmented control for status (All / Running / Waiting / Failed / Completed), plus a search input for run ID (mono placeholder). Pills: 6px radius (not fully round), gray-100 fill, active = gray-1000 fill with inverted text.
4. **Runs table** — see component spec §6.1. Columns: Status (dot+badge) · Run ID (mono, link) · Workflow name · Trigger (icon + text) · Duration (mono, right-aligned) · Started (relative time, gray-900) · chevron. Row height 48px, hover = `--ds-gray-100` background, entire row clickable → `/runs/[id]`.
5. **Pagination footer**: label-13, "Prev / Next" + page indicator, top 1px border.

### 5.3 Run detail (`/runs/[id]`)

Two-column on desktop (min 1024px): left 60% timeline, right 40% side panel. Below 1024px stack.

**Header block:**
- Breadcrumb: `Runs / run_8f3a…c21` (run ID mono).
- Title row: status badge (large, with dot) + workflow name (heading-24) + run ID copyable (mono label-13, copy icon on hover).
- Meta row (label-13, gray-900, dot-separated): started at · duration (mono) · trigger · attempt n/3 · version. Each value mono where numeric.
- Actions right-aligned: Retry (primary button), Cancel (secondary, only when running/waiting), "View logs" (ghost link).

**Tabs** (Geist-style underline tabs, not pills): `Timeline` · `Steps` · `Hooks` · `Events JSON`. Below 1px border; active tab text gray-1000 with 1px 2px-wide gray-1000 underline sitting on the border; inactive gray-900.

**Tab: Timeline (default)** — vertical event timeline:
- Left rail: 24px column with a 1px vertical line `--ds-gray-400` and 8px status dots centered on it. Dot color = event status; running dot = blue with a slow CSS pulse animation (opacity 1→0.4, 1.2s loop).
- Each event row: label-14 event name (e.g. `step.completed`), gray-900; right side mono label-13 timestamp offset (`+00:03.412`) and relative time; expandable rows (chevron) reveal a code-13 block with the event payload JSON.
- Gap between rows: 16px; padding 8px vertical per row.
- Failed events: row gets a 1px left accent border in red and a red text snippet of the error message; full stack traces in a code block.

**Tab: Steps** — table of steps (§6.1) with columns: Status · Step name (mono) · Attempt · Duration (mono, right) · Started. Clicking a step opens a detail panel (right slide-over, 12px radius, 1px border) with: step inputs JSON, outputs JSON, error, logs (code block, mono 13, gray-100 background even on dark theme — always treat log blocks as code surfaces with Background-200).

**Tab: Hooks** — list of hooks as bordered cards (6px radius, padding 16px): hook type badge, target (mono), status dot, last fired timestamp, delivery attempts count (mono). Failed deliveries show red badge + "Redeliver" secondary button.

**Tab: Events JSON** — full event log as one scrollable code block (max-height 600px, overflow auto) with a copy button top-right inside the block header.

**Side panel (all tabs):** "Run context" card — workflow definition version, queued-at/started-at/finished-at table (label rows gray-900, values mono label-13), idempotency key, parent run link if any.

### 5.4 Dead letter (`/dead-letter`)

Same table pattern as Runs, but always show an extra mono column `reason` truncated to one line, and row actions: "Replay" (primary small button) and "Discard" (secondary). Each failed message's error is one line of red code-13 under the row name. Empty state: centered gray-900 copy-14 "No dead-lettered messages", 1px dashed border container.

### 5.5 Queue health (`/queues`)

- One card per queue (6px radius, 1px border, padding 24px): queue name (mono label-14), depth (heading-32 mono, tabular), and three mini-stats (oldest message age, inflight, dead-lettered) in label-13 with mono values.
- Depth > threshold → the depth number renders in `--status-waiting` color; dead-lettered > 0 → red.
- Optional sparkline: 1px gray-900 line on Background-200, 64px tall, no axes, mono min/max labels at 12px.

## 6. Component inventory

### 6.1 Table
- Container: no outer border; header row 1px bottom border `--ds-gray-400`, header text label-14-strong gray-900.
- Cells: padding 12px 16px; body label-14; numeric/mono columns right-aligned. Row separators 1px `--ds-gray-200` (lighter than header).
- Sortable headers: 12px chevron icon appears on hover; active sort column chevron persistent.
- Selection/expanded row: `--ds-gray-100` background.
- Empty state: 48px vertical padding, centered gray-900 copy-14.
- Loading: skeleton rows — gray-100 rounded-6 blocks, 16px tall, shimmer not required.

### 6.2 Badge
- Pill (9999px radius), height 20px (small) / 24px (large), padding 0 8px, label-12 / label-14 resp.
- Status badges: tinted fill = status color at ~12% opacity (use the scale's `-100` step), text = `-700` step, optional 6px leading dot in `-700`.
- Neutral badges (e.g. `v3`, trigger type): gray-100 fill, gray-900 text, 1px border gray-400.

### 6.3 Status dot
- 6px (inline/table) or 8px (timeline/badges) circle. Colors strictly from §2. `running` pulses; `waiting` static; no other animations.

### 6.4 Code block
- Background `--ds-background-200` (dark: `#0a0a0a` on `#000`), 6px radius, 1px border gray-400, padding 12px 16px, code-13 mono, gray-1000 text, syntax highlighting allowed but monochrome-first (strings gray-900, keywords gray-1000).
- Header strip inside: 1px bottom border, label-12 gray-900 filename/language left, copy icon right (16px, hover gray-1000).
- Max-width 100%, horizontal scroll for long lines, no wrap by default (toggle optional).

### 6.5 Tabs
- Underline style. Row height 40px, gap 24px, label-14. Active: gray-1000 text + 1px×2px underline. Inactive: gray-900, hover → gray-1000. Container 1px bottom border gray-400. Keyboard: arrow keys move, role="tablist".

### 6.6 Buttons
- Primary: gray-1000 bg, Background-100 text, radius 6, height 32px (md) / 28px (sm), padding 0 12px, label-14; hover gray-800.
- Secondary: Background-100 bg, 1px gray-400 border, gray-1000 text; hover bg gray-100.
- Ghost/tertiary: no border, gray-900 text, hover bg gray-100.
- Danger variants take red-700 text but never red fill.

### 6.7 Inputs
- Height 32px, radius 6, 1px gray-400 border, Background-100 fill, label-14; focus ring blue per §4; mono font for ID search.

### 6.8 Slide-over / Modal
- Slide-over: right panel 480px, Background-100, 1px left border, overlay rgba(0,0,0,0.5). Modal: 12px radius, 1px gray-400 border, 24px padding.

### 6.9 Copy-to-clipboard affordance
- Any mono ID/value gets a 16px copy icon appearing on row/parent hover; click shows "Copied" label-12 for 2s.

## 7. Motion

Durations 150ms (hover/press) and 250ms (panels), easing `cubic-bezier(0.2,0,0,1)`. Only other animation is the running-dot pulse. Respect `prefers-reduced-motion` (disable pulse and transitions).

## 8. Accessibility

- All status conveyed by text or `aria-label`, never color alone (badges carry words: "Completed", "Failed", "Waiting", "Running").
- Tables: real `<table>` with `<th scope="col">`; timeline uses an ordered list with `aria-label="Run timeline"`.
- Contrast: text must meet WCAG AA against its background — gray-900 text on gray-100 fills, gray-1000 on Background-100 always pass.

## 9. Implementation notes

- Build as React + Tailwind if possible; Geist tokens map to CSS variables so any stack works. Package: `geist` for fonts, `@vercel/geistcn` optionally for primitives — otherwise implement §6 components from scratch following this spec exactly.
- Dark theme by default via `class="dark"` on `<html>`; every token in §2 has both theme values.
