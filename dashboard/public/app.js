/* entrylite world dashboard — vanilla JS SPA, Geist design system */
(() => {
  const app = document.getElementById('app');
  const state = { theme: localStorage.getItem('ds-theme') || 'dark', auto: false, timer: null,
                  runs: { status: 'all', q: '', page: 1 }, runTab: 'timeline', queueAuto: false };

  const fmtFull = (t) => t ? new Date(t).toISOString().replace('T', ' ').replace('Z', '') : '—';
  function dur(start, end) {
    if (!start || !end) return '—';
    let ms = new Date(end) - new Date(start); if (ms < 0) ms = 0;
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(2) + 's';
    return Math.floor(ms / 60000) + 'm ' + ((ms % 60000) / 1000).toFixed(1) + 's';
  }
  function ago(t) {
    if (!t) return '—';
    const s = (Date.now() - new Date(t)) / 1000;
    if (s < 60) return Math.floor(s) + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    return Math.floor(s / 3600) + 'h ago';
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const json = (v) => v == null ? 'null' : JSON.stringify(v, null, 2);
  const dot = (st, lg) => `<span class="dot ${lg ? 'dot-lg ' : ''}${esc(st)}" aria-hidden="true"></span>`;
  const badge = (st) => `<span class="badge ${esc(st)}">${dot(st)}${esc(st)}</span>`;
  const ic = (d) => `<svg viewBox="0 0 16 16"><path d="${d}"/></svg>`;
  const NAV = [
    { id: 'runs', href: '#/', label: 'Runs', icon: ic('M8 1l6 3v8l-6 3-6-3V4z') },
    { id: 'queue', href: '#/queue', label: 'Queues', icon: ic('M2 4h12M2 8h12M2 12h8') },
  ];
  const STATUS_TABS = ['all', 'running', 'waiting', 'failed', 'completed', 'cancelled'];

  async function api(path, opts) {
    const r = await fetch(path, opts);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    return r.json();
  }

  function shell(active, crumb, contentHTML) {
    app.innerHTML = `
      <div class="shell">
        <aside class="sidebar">
          <div class="logo">entrylite / world</div>
          <nav aria-label="Main">
            ${NAV.map((n) => `<a href="${n.href}" class="${active === n.id ? 'active' : ''}">${n.icon}${n.label}</a>`).join('')}
          </nav>
        </aside>
        <div class="main">
          <div class="topbar">
            <div class="crumb">${crumb}</div>
            <div class="controls" style="margin:0">
              <label class="toggle"><input type="checkbox" id="auto" ${state.auto ? 'checked' : ''}/> auto-refresh 5s</label>
              <button class="btn" id="themeBtn" aria-label="toggle theme">${state.theme === 'dark' ? '☾' : '☀'}</button>
            </div>
          </div>
          <div class="content">${contentHTML}</div>
        </div>
      </div>`;
    document.documentElement.className = state.theme;
    document.getElementById('themeBtn').onclick = () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ds-theme', state.theme);
      document.documentElement.className = state.theme;
    };
    document.getElementById('auto').addEventListener('change', (e) => {
      state.auto = e.target.checked;
      clearInterval(state.timer);
      if (state.auto) state.timer = setInterval(() => route(true), 5000);
    });
  }

  // ---------- Runs list ----------
  async function runsList(silent) {
    const { status, q, page } = state.runs;
    const d = await api(`/api/runs?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}&page=${page}&pageSize=25`);
    const bySt = {};
    for (const r of d.runs) bySt[r.status] = (bySt[r.status] || 0) + 1;
    const rows = d.runs.map((r) => `
      <tr class="rowlink" data-href="#/run/${esc(r.runId)}">
        <td>${badge(r.status)}</td>
        <td class="mono trunc"><a href="#/run/${esc(r.runId)}" title="${esc(r.runId)}">${esc(r.runId)}</a></td>
        <td>${esc(r.workflow)}</td>
        <td class="num">${esc(dur(r.startedAt || r.createdAt, r.completedAt))}</td>
        <td class="mono dim">${ago(r.startedAt || r.createdAt)}</td>
        <td class="dim" aria-hidden="true">›</td>
      </tr>`).join('');
    const pages = Math.max(1, Math.ceil(d.total / d.pageSize));
    shell('runs', 'Runs', `
      <h1 class="page">Runs</h1>
      <div class="controls">
        <div class="pills" role="tablist" aria-label="status filter">
          ${STATUS_TABS.map((s) => `<button role="tab" class="${status === s ? 'active' : ''}" data-st="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
        </div>
        <input type="text" class="mono" id="f-q" placeholder="search run id…" value="${esc(q)}" aria-label="search run id"/>
      </div>
      <table>
        <thead><tr><th scope="col">Status</th><th scope="col">Run ID</th><th scope="col">Workflow</th><th scope="col" class="num">Duration</th><th scope="col">Started</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="empty">No runs${q || status !== 'all' ? ' matching filters' : ''}</td></tr>`}</tbody>
      </table>
      <div class="pager">
        <button class="btn" id="prev" ${page <= 1 ? 'disabled' : ''}>Prev</button>
        <span>Page ${page} of ${pages} · ${d.total} runs</span>
        <button class="btn" id="next" ${page >= pages ? 'disabled' : ''}>Next</button>
      </div>`);
    document.querySelectorAll('.pills button').forEach((b) => b.onclick = () => { state.runs.status = b.dataset.st; state.runs.page = 1; runsList(); });
    let deb; document.getElementById('f-q').addEventListener('input', (e) => {
      clearTimeout(deb); deb = setTimeout(() => { state.runs.q = e.target.value.trim(); state.runs.page = 1; runsList(true); }, 300);
    });
    document.querySelectorAll('tr.rowlink').forEach((tr) => tr.onclick = (e) => {
      if (e.target.closest('a')) return; location.hash = tr.dataset.href;
    });
    document.getElementById('prev').onclick = () => { state.runs.page--; runsList(); };
    document.getElementById('next').onclick = () => { state.runs.page++; runsList(); };
  }

  // ---------- Run detail ----------
  async function runDetail(runId) {
    const r = await api(`/api/runs/${encodeURIComponent(runId)}`);
    const d = dur(r.startedAt || r.createdAt, r.completedAt);
    const tab = state.runTab;
    const tabs = ['timeline', 'steps', 'hooks', 'events'];
    const evRow = (e) => `
      <li>
        <span class="node">${dot(e.eventType.includes('fail') || e.eventType.includes('error') ? 'failed' : e.eventType.includes('complete') ? 'completed' : e.eventType.includes('start') || e.eventType.includes('run') ? 'running' : 'waiting', true)}</span>
        <time>${esc(fmtFull(e.createdAt))}</time>
        <div class="row-main">
          <span class="badge">${esc(e.eventType)}</span>
          <details><summary class="mono dim" style="cursor:pointer">payload</summary>
            <pre class="code">${esc(json(e.data))}</pre></details>
        </div>
      </li>`;
    let tabHTML = '';
    if (tab === 'timeline') {
      tabHTML = `<ol class="timeline" aria-label="Run timeline">${r.events.map(evRow).join('') || '<li class="empty">No events</li>'}</ol>`;
    } else if (tab === 'steps') {
      tabHTML = `<table>
        <thead><tr><th scope="col">Status</th><th scope="col">Step name</th><th scope="col">Step ID</th><th scope="col" class="num">Attempt</th><th scope="col" class="num">Duration</th><th scope="col">Error</th></tr></thead>
        <tbody>${r.steps.map((s) => `
          <tr><td>${badge(s.status)}</td><td class="mono">${esc(s.stepName)}</td>
          <td class="mono dim trunc" title="${esc(s.stepId)}">${esc(s.stepId)}</td>
          <td class="num">${s.attempt}</td><td class="num">${esc(dur(s.startedAt, s.completedAt))}</td>
          <td>${s.error ? `<span class="error-text trunc" style="display:inline-block;max-width:280px" title="${esc(s.error)}">${esc(s.error)}</span>` : '<span class="dim">—</span>'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No steps</td></tr>'}</tbody></table>`;
    } else if (tab === 'hooks') {
      tabHTML = r.hooks.length ? r.hooks.map((h) => `
        <div class="card"><div class="body">
          <div class="run-title">${badge(h.isWebhook ? 'waiting' : 'skipped')}<span class="mono trunc">${esc(h.hookId)}</span></div>
          <div class="meta"><span>token <b class="mono">${esc(h.token)}</b></span><span>created <b>${esc(fmtFull(h.createdAt))}</b></span></div>
        </div></div>`).join('') : '<div class="empty">No hooks</div>';
    } else {
      tabHTML = `<pre class="code">${esc(json(r.events.map((e) => ({ ...e, data: e.data }))))}</pre>`;
    }
    shell('runs', `<a href="#/">Runs</a> / <b class="mono">${esc(r.runId)}</b>`, `
      <div class="breadcrumb"><a href="#/">Runs</a> / <span class="mono">${esc(r.runId)}</span></div>
      <div class="run-title">${badge(r.status)}<h1>${esc(r.workflow)}</h1></div>
      <div class="meta">
        <span>run <b class="mono">${esc(r.runId)}</b></span>·
        <span>started <b>${esc(fmtFull(r.startedAt || r.createdAt))}</b></span>·
        <span>duration <b>${esc(d)}</b></span>·
        <span>spec <b>v${r.specVersion ?? '—'}</b></span>
      </div>
      ${r.error ? `<div class="card" style="margin-top:16px"><div class="card-head">error ${r.errorCode ? '· ' + esc(r.errorCode) : ''}</div><div class="body"><pre class="code error-text" style="border:none;background:transparent;padding:0">${esc(r.error)}</pre></div></div>` : ''}
      <div class="tabs" role="tablist">
        ${tabs.map((t) => `<button role="tab" class="${tab === t ? 'active' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
      </div>
      <div class="card"><div class="body" style="padding:0">
        <div class="card-head">input</div><pre class="code" style="border:none;border-radius:0">${esc(json(r.input))}</pre>
        <div class="card-head">output</div>${r.output == null ? '<div class="empty">null</div>' : `<pre class="code" style="border:none;border-radius:0">${esc(json(r.output))}</pre>`}
      </div></div>
      ${tabHTML}`);
    document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { state.runTab = b.dataset.t; runDetail(runId); });
  }

  // ---------- Queue health ----------
  async function queueHealth() {
    const [q, dl] = await Promise.all([api('/api/queues'), api('/api/dead-letter')]);
    const cards = q.queues.map((x) => `
      <div class="card"><div class="body">
        <div class="run-title"><span class="mono">${esc(x.queue)}</span></div>
        <div style="font:600 32px/40px var(--mono);margin:8px 0">${x.total}</div>
        <div class="meta">
          <span>pending <b>${x.pending}</b></span>
          <span>locked <b>${x.locked}</b></span>
          <span>oldest pending <b>${x.oldestPending ? ago(x.oldestPending) : '—'}</b></span>
        </div>
      </div></div>`).join('');
    const dlRows = (dl.items || []).map((x) => `
      <tr>
        <td class="mono trunc" title="${esc(x.id)}">${esc(x.id)}</td>
        <td class="mono trunc">${esc(x.run_id || x.queue_name || '')}</td>
        <td class="num">${x.attempts ?? '—'}</td>
        <td class="error-text trunc" style="max-width:320px" title="${esc(x.error || '')}">${esc(x.error || '')}</td>
        <td><button class="btn requeue" data-id="${esc(x.id)}">Replay</button></td>
      </tr>`).join('');
    shell('queue', 'Queues', `
      <h1 class="page">Queue health</h1>
      ${cards || '<div class="empty">No queued jobs</div>'}
      <div class="card"><div class="card-head">dead letter ${dl.available ? '' : '· table not yet created'}</div>
        <table><thead><tr><th scope="col">ID</th><th scope="col">Run</th><th scope="col" class="num">Attempts</th><th scope="col">Reason</th><th></th></tr></thead>
        <tbody>${dlRows || '<tr><td colspan="5" class="empty">No dead-lettered messages</td></tr>'}</tbody></table>
      </div>`);
    document.querySelectorAll('button.requeue').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true; b.textContent = '…';
        try {
          await api('/api/dead-letter/requeue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.dataset.id }) });
          b.textContent = 'Replayed'; queueHealth();
        } catch (e) { b.textContent = 'Failed'; b.title = e.message; }
      };
    });
  }

  // ---------- router ----------
  function route(silent) {
    const h = location.hash || '#/';
    const m = h.match(/^#\/run\/(.+)$/);
    if (m) runDetail(decodeURIComponent(m[1])).catch(showErr);
    else if (h === '#/queue') queueHealth().catch(showErr);
    else runsList(silent).catch(showErr);
  }
  function showErr(e) {
    app.innerHTML = `<div class="shell"><div class="main"><div class="content"><div class="card"><div class="card-head">error</div><div class="body"><pre class="code error-text">${esc(e.message)}</pre></div></div></div></div></div>`;
  }
  window.addEventListener('hashchange', () => route(false));
  route(false);
})();
