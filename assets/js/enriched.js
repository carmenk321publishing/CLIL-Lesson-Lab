/* enriched.js — renders the parts of a package that only exist once it has been
   grounded: the subject brief with citations, misconceptions, the vocabulary
   table, the student worksheet, the answer key, the glossary, and the audit.

   Loaded after app.js and reuses its helpers. Everything here is optional: if a
   package was never grounded, none of it renders and the page still works. */

const STATUS_LABEL = { pass: 'Checked', flag: 'Confirm', fail: 'Needs your attention' };

/* The full role labels read badly mid-sentence, so the list uses short forms. */
const ROLE_SHORT = {
  'Language teacher': 'a language teacher',
  'Subject or content teacher': 'a subject teacher',
  'Both, I teach the subject and the language': 'a dual-role teacher',
};

function stripPartPrefix(heading) {
  return String(heading || '').replace(/^\s*part\s*\d+\s*[.:\-–]\s*/i, '');
}

function srcChip(n) {
  return n ? `<a class="srcchip" href="#sources" title="Source ${esc(n)}">${esc(n)}</a>` : '';
}

function enrichedSections(pkg) {
  const g = pkg.grounded;
  if (!g) return '';
  const parts = [];

  /* ---- what the audit found: first, because it changes how you read the rest */
  const v = pkg.verification || {};
  const checks = v.checks || [];
  const fails = checks.filter((c) => c.status === 'fail');
  const flags = checks.filter((c) => c.status === 'flag');
  const passes = checks.filter((c) => c.status === 'pass');

  parts.push(`
    <section class="pkg-section" id="audit">
      <h2>What the automatic check found</h2>
      <div class="audit-tally">
        <span class="badge badge--pass">${passes.length} checked</span>
        <span class="badge badge--flag">${flags.length} to confirm</span>
        <span class="badge badge--fail">${fails.length} needing attention</span>
      </div>
      <p class="faint" style="margin-bottom:var(--space-5)">
        A second pass audited this package against the sources below and against the structural rules.
        It reports; it does not rewrite. Anything it could not confirm is shown here rather than hidden.
      </p>
      ${[...fails, ...flags, ...passes].map((c) => `
        <div class="check check--${esc(c.status)}">
          <div class="check__head">
            <span class="badge badge--${esc(c.status)}">${esc(STATUS_LABEL[c.status] || c.status)}</span>
            <h3>${esc(c.name)}</h3>
          </div>
          <p>${esc(c.note)}</p>
        </div>`).join('')}
      ${(v.unsupported_claims || []).length ? `
        <div class="flag" style="margin-top:var(--space-6)">
          <h3>Claims the audit could not trace to a source</h3>
          <ul class="bullets">${v.unsupported_claims.map((u) =>
            `<li><b>${esc(u.claim)}</b><br>${esc(u.why)}</li>`).join('')}</ul>
        </div>` : ''}
      ${(v.teacher_must_confirm || []).length ? `
        <div class="flag" style="margin-top:var(--space-5)">
          <h3>Only you can decide these</h3>
          <ul class="checklist">${v.teacher_must_confirm.map((t) =>
            `<li><input type="checkbox"><span>${esc(t)}</span></li>`).join('')}</ul>
        </div>` : ''}
    </section>`);

  /* ---- the subject content, with a citation on every claim */
  if ((g.brief || []).length) {
    parts.push(`
      <section class="pkg-section">
        <h2>The subject content behind this lesson</h2>
        <p class="faint" style="margin-bottom:var(--space-4)">
          Every claim carries the number of the source it came from. Nothing here was written from memory.
        </p>
        <ul class="claim-list">
          ${g.brief.map((b) => `<li>${esc(b.claim)} ${srcChip(b.source)}</li>`).join('')}
        </ul>
      </section>`);
  }

  if ((g.misconceptions || []).length) {
    parts.push(`
      <section class="pkg-section">
        <h2>What learners usually get wrong</h2>
        <div class="misc-grid">
          ${g.misconceptions.map((m) => `
            <div class="misc">
              <p class="mini-head">Learners think</p>
              <p class="misc__wrong">${esc(m.learners_think)}</p>
              <p class="mini-head">Actually</p>
              <p>${esc(m.what_is_correct)} ${srcChip(m.source)}</p>
              ${m.why_it_is_wrong ? `<p class="faint">${esc(m.why_it_is_wrong)}</p>` : ''}
            </div>`).join('')}
        </div>
      </section>`);
  }

  /* ---- vocabulary as a usable table, not a list of words */
  const vocab = (pkg.language_bank || {}).vocabulary || [];
  if (vocab.length) {
    parts.push(`
      <section class="pkg-section">
        <h2>Vocabulary to pre-teach</h2>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Term</th><th>Learner-facing definition</th><th>In a sentence</th><th>Show them</th>
            </tr></thead>
            <tbody>
              ${vocab.map((t) => `<tr>
                <td><b>${esc(t.term)}</b> ${srcChip(t.source)}</td>
                <td>${esc(t.definition || '')}</td>
                <td>${esc(t.example_sentence || '')}</td>
                <td class="faint">${esc(t.visual || '')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${((pkg.language_bank || {}).pronunciation_watch || []).length ? `
          <p class="mini-head" style="margin-top:var(--space-6)">Pronunciation to watch</p>
          <ul class="bullets">${pkg.language_bank.pronunciation_watch.map((p) =>
            `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      </section>`);
  }

  if ((pkg.teacher_script || []).length) {
    parts.push(`
      <section class="pkg-section">
        <h2>What to say</h2>
        <div class="card card--quiet">
          <ol class="script">${pkg.teacher_script.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        </div>
      </section>`);
  }

  /* ---- the worksheet, laid out as the printed sheet */
  const w = pkg.worksheet;
  if (w) {
    parts.push(`
      <section class="pkg-section" id="worksheet">
        <h2>Student worksheet</h2>
        <div class="sheet">
          <h3 class="sheet__title">${esc(w.title || '')}</h3>
          <p class="sheet__instructions">${esc(w.learner_instructions || '')}</p>
          ${(w.language_help_box || []).length ? `
            <div class="helpbox">
              <p class="mini-head">Language help</p>
              <ul class="bullets">${w.language_help_box.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
            </div>` : ''}
          ${(w.parts || []).map((p) => `
            <div class="sheet__part">
              <div class="sheet__parthead">
                <h4>Part ${esc(p.number)}. ${esc(stripPartPrefix(p.heading))}</h4>
                <span class="badge">${esc(p.assesses === 'language' ? 'Language' : 'Content')}</span>
              </div>
              <p class="sheet__task">${esc(p.instructions || '')}</p>
              <ol class="sheet__items">
                ${(p.items || []).map((it) => `
                  <li>
                    <span>${esc(it.prompt)}</span>
                    <span class="ruled" style="--lines:${Number(it.lines) || 1}"></span>
                  </li>`).join('')}
              </ol>
            </div>`).join('')}
          ${w.exit_check ? `
            <div class="sheet__part sheet__exit">
              <div class="sheet__parthead"><h4>Before you go</h4></div>
              <p class="sheet__task">${esc(w.exit_check.prompt || '')}</p>
              <span class="ruled" style="--lines:2"></span>
              <p class="faint">${esc(w.exit_check.note || '')}</p>
            </div>` : ''}
        </div>
      </section>`);
  }

  if ((pkg.answer_key || []).length) {
    parts.push(`
      <section class="pkg-section">
        <h2>Answer key</h2>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Part</th><th>Item</th><th>Answer</th><th>Also accept</th><th>Marking</th></tr></thead>
            <tbody>
              ${pkg.answer_key.map((a) => `<tr>
                <td>${esc(a.part)}</td>
                <td>${esc(a.prompt || '')}</td>
                <td>${esc(a.answer || '')}</td>
                <td class="faint">${esc(a.accept_also || '')}</td>
                <td class="faint">${esc(a.marking_note || '')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>`);
  }

  if ((pkg.glossary || []).length) {
    parts.push(`
      <section class="pkg-section">
        <h2>Glossary to hand out</h2>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Term</th><th>Type</th><th>Definition</th><th>Saying it</th>
              <th>In ${esc(pkg.header.first_language || 'first language')}</th>
            </tr></thead>
            <tbody>
              ${pkg.glossary.map((t) => `<tr>
                <td><b>${esc(t.term)}</b></td>
                <td class="faint">${esc(t.part_of_speech || '')}</td>
                <td>${esc(t.definition || '')}</td>
                <td class="faint">${esc(t.pronunciation_note || '')}</td>
                <td class="fill-in"></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="faint" style="margin-top:var(--space-3)">
          The last column is deliberately blank. Learners writing the term in their own language is part of
          the learning, not an admission of failure.
        </p>
      </section>`);
  }

  if ((g.gaps || []).length) {
    parts.push(`
      <section class="pkg-section">
        <h2>What the sources could not give you</h2>
        <div class="card card--quiet">
          <ul class="bullets">${g.gaps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
      </section>`);
  }

  if ((g.sources || []).length) {
    parts.push(`
      <section class="pkg-section" id="sources">
        <h2>Sources</h2>
        <p class="faint" style="margin-bottom:var(--space-4)">
          ${esc(g.usable)} of ${esc(g.searched)} retrieved sources were usable. Government, university,
          open-textbook and peer-reviewed material is preferred; commercial content sites are excluded.
        </p>
        <ol class="src-list">
          ${g.sources.map((s) => `
            <li id="src-${esc(s.index)}">
              <a href="${esc(s.url)}">${esc(s.title)}</a>
              <span class="faint">${esc(s.publisher)}${s.published ? ` · ${esc(s.published)}` : ''}</span>
            </li>`).join('')}
        </ol>
      </section>`);
  }

  return parts.join('');
}

/* ---------------------------------------------------------------- exemplars */

async function initExemplars() {
  const root = $('#exemplar-root');
  if (!root) return;
  const slug = params.get('slug');

  if (!slug) {
    const list = await api('/api/exemplars').catch(() => []);
    root.innerHTML = `
      <h1 class="page-title">Worked examples</h1>
      <p class="lede">Complete packages with materials, citations and the audit left visible, including
        what it found wrong. Nothing is generated when you open these.</p>
      ${list.length ? `<ul class="row-list" style="margin-top:var(--space-10)">${list.map((e) => `
        <li class="row">
          <div>
            <h3>${esc(e.title)}</h3>
            <p class="row__meta">${esc(e.subject)} · ${esc(e.learner_group)} · planned by
              ${esc(ROLE_SHORT[e.teacher_role] || e.teacher_role)} · ${esc(e.sources)} sources</p>
          </div>
          <div class="row__actions">
            <a class="btn btn--primary" href="exemplars.html?slug=${esc(e.slug)}">Open</a>
          </div>
        </li>`).join('')}</ul>`
        : `<div class="empty" style="margin-top:var(--space-10)">No worked examples published yet.</div>`}`;
    return;
  }

  try {
    const pkg = await api(`/api/exemplars/${encodeURIComponent(slug)}`);
    renderPackage(pkg, root, { exemplarSlug: slug });
  } catch {
    root.innerHTML = `<div class="empty">That example could not be opened.</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initExemplars().catch((err) => console.error(err));
});
