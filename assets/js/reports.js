/* reports.js — course updates: family newsletter and staff one-pager.
   Loads after app.js and reuses its helpers ($, $$, esc, api, toast, params, API). */

const CADENCE_NOTE = {
  bimonthly: 'Every two months',
  monthly: 'Monthly',
  termly: 'Once a term',
  manual: 'Only when you ask',
};

function autosize(el) {
  const fit = () => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  };
  el.addEventListener('input', fit);
  fit();
}

function sectionEditor(s) {
  const head = `
    <div class="doc-section__head">
      <h2 ${s.locked ? '' : 'contenteditable="true"'} data-heading spellcheck="false">${esc(s.heading)}</h2>
      ${s.locked
        ? '<span class="badge">Fixed wording</span>'
        : '<button class="icon-btn no-print" data-remove aria-label="Remove this section">&times;</button>'}
    </div>`;

  const body = s.locked
    ? `<div class="locked-body">${s.body.map((b) => `<p>${esc(b)}</p>`).join('')}</div>`
    : `<textarea rows="1">${esc(s.body.join('\n'))}</textarea>`;

  const hint = s.hint ? `<p class="hint no-print">${esc(s.hint)}</p>` : '';

  return `<section class="doc-section${s.locked ? ' doc-section--locked' : ''}"
            data-section="${s.id}">${head}${body}${hint}</section>`;
}

async function renderDocument(docId, root) {
  const token = params.get('t');
  let doc;
  try {
    doc = await api(`/api/documents/${docId}${token ? `?token=${token}` : ''}`);
  } catch {
    root.innerHTML = '<div class="empty">This update could not be opened.</div>';
    return;
  }

  root.innerHTML = `
    <header>
      <p class="eyebrow">${esc(doc.kind_label)} &middot; for ${esc(doc.audience)}</p>
      <h1 class="page-title" contenteditable="true" data-title spellcheck="false">${esc(doc.title)}</h1>
      <p class="faint" style="margin-top:var(--space-3)">${esc(doc.from_line)} &middot; ${esc(doc.period)}</p>
      <dl class="pkg-meta">
        ${doc.meta.filter((m) => m[1]).map((m) =>
          `<div><dt>${esc(m[0])}</dt><dd>${esc(m[1])}</dd></div>`).join('')}
      </dl>
    </header>

    <p class="faint no-print" style="margin-top:var(--space-8)">
      Every heading and line is editable. Remove a section with the cross. Nothing leaves this page until
      you export or copy the link.
    </p>

    <div id="doc-sections">${doc.sections.map(sectionEditor).join('')}</div>

    <div class="disclaimer" style="margin-top:var(--space-12)">
      <h2>${esc(doc.notice.heading)}</h2>
      ${doc.notice.body.map((p) => `<p>${esc(p)}</p>`).join('')}
    </div>

    <div class="export-bar no-print">
      <button class="btn btn--primary" data-save>Save edits</button>
      <button class="btn btn--quiet" data-copy>Copy link</button>
      <button class="btn btn--quiet" data-print>PDF</button>
      <a class="btn btn--quiet" data-docx>Word</a>
      <span class="spacer"></span>
      <a class="btn btn--text" href="reports.html">All updates</a>
    </div>`;

  $$('[data-remove]').forEach((btn) =>
    btn.addEventListener('click', () => btn.closest('.doc-section').remove())
  );
  $$('.doc-section textarea').forEach(autosize);

  const collect = () => ({
    title: $('[data-title]').textContent.trim(),
    sections: $$('.doc-section').map((el) => ({
      id: el.dataset.section,
      heading: ($('[data-heading]', el) || {}).textContent?.trim() || '',
      body: (($('textarea', el) || {}).value || '').split('\n'),
    })),
  });

  $('[data-save]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await api(`/api/documents/${docId}`, { method: 'PUT', body: JSON.stringify(collect()) });
      toast('Edits saved.');
    } catch {
      toast('Could not save.');
    }
    btn.disabled = false;
  });

  const share = `${location.origin}${location.pathname}?doc=${doc.id}&t=${doc.share_token}`;
  $('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(share);
      toast('Share link copied.');
    } catch {
      toast(share);
    }
  });
  $('[data-print]').addEventListener('click', () => window.print());
  $('[data-docx]').href = `${API}/api/documents/${docId}/export.docx?token=${doc.share_token}`;
}

async function initReports() {
  const root = $('#reports-root');
  if (!root) return;

  const docId = params.get('doc');
  if (docId) return renderDocument(docId, root);

  const courses = await api('/api/courses').catch(() => []);
  const ready = courses.filter((c) => c.lessons.length);

  root.innerHTML = `
    <h1 class="page-title">Course updates</h1>
    <p class="lede">Drafted from the lessons and reflections already in your course. Edit before sending.</p>

    <div class="door-grid" style="margin-top:var(--space-10)">
      <div class="door door--static">
        <span class="door__step">For families</span>
        <h2>Family newsletter</h2>
        <p>What learners covered, what they can now do, and language they may bring home. Includes the
           reassurance families ask for about progress in a second language.</p>
      </div>
      <div class="door door--static">
        <span class="door__step">For colleagues</span>
        <h2>Staff one-pager</h2>
        <p>Progress against objectives, what is working, where learners are struggling, and the support you
           are asking for. Named learner detail stays off this tool.</p>
      </div>
    </div>

    <hr class="rule">

    <h2 class="section-title">Choose a course</h2>
    <div id="doc-courses">${ready.length ? '' :
      `<div class="empty">You need at least one lesson in a course first.
        <a href="courses.html">Set up a course</a>.</div>`}</div>`;

  if (!ready.length) return;

  const wrap = $('#doc-courses');
  wrap.innerHTML = `
    <ul class="row-list">${ready.map((c) => `
      <li class="row" data-course="${c.id}">
        <div>
          <h3>${esc(c.name)}</h3>
          <p class="row__meta">${c.lessons.length} lessons &middot; ${
            c.lessons.filter((l) => l.has_reflection).length} reflections${
            c.cadence ? ` &middot; ${CADENCE_NOTE[c.cadence] || ''}` : ''}</p>
        </div>
        <div class="row__actions">
          <button class="btn btn--quiet" data-make="newsletter">Newsletter</button>
          <button class="btn btn--quiet" data-make="briefing">One-pager</button>
        </div>
      </li>`).join('')}</ul>
    <div id="doc-history" style="margin-top:var(--space-10)"></div>`;

  wrap.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-make]');
    if (!btn) return;
    const courseId = btn.closest('[data-course]').dataset.course;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Drafting';
    try {
      const doc = await api(`/api/courses/${courseId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ kind: btn.dataset.make }),
      });
      location.href = `reports.html?doc=${doc.id}`;
    } catch {
      btn.disabled = false;
      btn.textContent = label;
      toast('Could not draft that update.');
    }
  });

  const history = (
    await Promise.all(
      ready.map((c) =>
        api(`/api/courses/${c.id}/documents`)
          .then((docs) => docs.map((d) => Object.assign({ course: c.name }, d)))
          .catch(() => [])
      )
    )
  ).flat();

  if (history.length) {
    $('#doc-history').innerHTML = `
      <h2 class="section-title">Earlier drafts</h2>
      <ul class="row-list">${history.map((d) => `
        <li class="row">
          <div>
            <h3>${esc(d.title)}</h3>
            <p class="row__meta">${esc(d.kind_label)} &middot; ${esc(d.course)} &middot; ${esc(d.period)}</p>
          </div>
          <div class="row__actions">
            <a class="btn btn--quiet" href="reports.html?doc=${d.id}">Open</a>
          </div>
        </li>`).join('')}</ul>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initReports().catch((err) => console.error(err));
});
