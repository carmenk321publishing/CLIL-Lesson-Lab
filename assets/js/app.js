/* app.js — shared chrome, API client, and page controllers.
   No build step. No framework. Everything is readable in one file. */

const API = '__PORT_8000__'.startsWith('__') ? 'http://localhost:8000' : '__PORT_8000__';

/* ---------------------------------------------------------------- utilities */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function toast(message) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('is-visible'), 3200);
}

const params = new URLSearchParams(location.search);

/* -------------------------------------------------------------------- logo */

const LOGO = `<svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor"
  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M16 28V11"/>
  <path d="M16 17c0-4 2.6-7 7.2-7.6C23.6 14 21 17.6 16 18"/>
  <path d="M16 13c0-3.6-2.4-6.4-6.6-7C9 9.8 11.4 13.2 16 14"/>
  <path d="M9 28h14"/>
</svg>`;

/* ------------------------------------------------------------------ chrome */

function chrome() {
  const page = document.body.dataset.page;
  const nav = [
    ['index.html', 'Home', 'home'],
    ['courses.html', 'Courses', 'courses'],
    ['build.html', 'New lesson', 'build'],
    ['exemplars.html', 'Examples', 'exemplars'],
    ['fivecs.html', '5 Cs check', 'fivecs'],
    ['reports.html', 'Updates', 'reports'],
    ['profile.html', 'Profile', 'profile'],
  ];

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="shell site-header__inner">
      <a class="brand" href="index.html">
        ${LOGO}
        <span>CLIL Lesson Lab<small>Plan calmly, teach in two languages</small></span>
      </a>
      <nav class="site-nav" aria-label="Main">
        ${nav.map(([href, label, key]) =>
          `<a href="${href}"${page === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
        <button class="icon-btn" data-theme-toggle aria-label="Switch to dark mode"></button>
      </nav>
    </div>`;
  document.body.prepend(header);

  const footer = document.createElement('footer');
  footer.className = 'site-footer no-print';
  footer.innerHTML = `
    <div class="shell cols">
      <p>A planning aid, not an approved lesson. You remain the judge of accuracy, policy and cultural fit.</p>
      <p>Structure follows public frameworks:
        <a href="https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors">CEFR, Council of Europe</a>,
        <a href="https://www.ecml.at/en/Resources/ECML-resources/ID/35">ECML CLIL teacher education</a>,
        <a href="https://education.ec.europa.eu/focus-topics/improving-quality/multilingualism/about-multilingualism-policy">European Commission multilingualism policy</a>.</p>
    </div>`;
  document.body.append(footer);

  const wash = document.createElement('div');
  wash.className = 'wash';
  document.body.prepend(wash);

  themeToggle();
}

function themeToggle() {
  const btn = $('[data-theme-toggle]');
  const root = document.documentElement;
  const sun = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`;
  const moon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`;
  let mode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const paint = () => {
    root.setAttribute('data-theme', mode);
    btn.innerHTML = mode === 'dark' ? sun : moon;
    btn.setAttribute('aria-label', `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`);
  };
  paint();
  btn.addEventListener('click', () => {
    mode = mode === 'dark' ? 'light' : 'dark';
    paint();
  });
}

/* ------------------------------------------------------- option rendering */

let OPTIONS = null;
const optionsReady = () =>
  OPTIONS ? Promise.resolve(OPTIONS) : api('/api/options').then((o) => (OPTIONS = o));

function fillSelect(select, items, selected) {
  if (!select) return;
  select.innerHTML = items
    .map((i) => `<option value="${i.id}"${i.id === selected ? ' selected' : ''}>${esc(i.label)}</option>`)
    .join('');
}

function radioRow(name, items, selected, describe) {
  return items
    .map(
      (i) => `<label class="choice">
        <input type="radio" name="${name}" value="${i.id}"${i.id === selected ? ' checked' : ''}>
        <span>${esc(i.label)}${describe && i.cefr ? ` <span class="faint">(${esc(i.cefr)})</span>` : ''}</span>
      </label>`
    )
    .join('');
}

function formValues(form) {
  const data = {};
  new FormData(form).forEach((v, k) => {
    data[k] = typeof v === 'string' ? v.trim() : v;
  });
  return data;
}

/* ------------------------------------------------------------- page: home */

function initHome() {
  const wrap = $('[data-recent]');
  if (!wrap) return;
  api('/api/lessons')
    .then((lessons) => {
      if (!lessons.length) {
        wrap.innerHTML = `<div class="empty">Your saved packages will appear here.</div>`;
        return;
      }
      wrap.innerHTML = `<ul class="row-list">${lessons.slice(0, 4).map((l) => `
        <li class="row">
          <div>
            <h3>${esc(l.title)}</h3>
            <p class="row__meta">${esc(l.subject)}${l.course_name ? ` · ${esc(l.course_name)}` : ''}${
              l.lesson_number ? ` · lesson ${l.lesson_number}` : ''}</p>
          </div>
          <div class="row__actions">
            <a class="btn btn--quiet" href="package.html?id=${l.id}">Open</a>
          </div>
        </li>`).join('')}</ul>`;
    })
    .catch(() => {
      wrap.innerHTML = `<div class="empty">Saved packages are unavailable right now.</div>`;
    });
}

/* ---------------------------------------------------------- page: profile */

async function initProfile() {
  const opts = await optionsReady();
  const form = $('#profile-form');
  const profile = await api('/api/profile').catch(() => ({}));

  $('#role-row').innerHTML = radioRow('teacher_role', opts.teacher_roles, profile.teacher_role || 'both');
  fillSelect($('#learner_group'), opts.learner_groups, profile.learner_group);
  fillSelect($('#setting'), opts.settings, profile.setting);
  fillSelect($('#format'), opts.formats, profile.format);
  ['name', 'subject', 'target_language', 'first_language', 'institution'].forEach((k) => {
    if (form.elements[k] && profile[k]) form.elements[k].value = profile[k];
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api('/api/profile', { method: 'PUT', body: JSON.stringify(formValues(form)) });
    toast('Profile saved.');
  });
}

/* ---------------------------------------------------------- page: courses */

async function initCourses() {
  const opts = await optionsReady();
  const form = $('#course-form');
  const profile = await api('/api/profile').catch(() => ({}));

  $('#c-role-row').innerHTML = radioRow('teacher_role', opts.teacher_roles, profile.teacher_role || 'both');
  $('#c-support-row').innerHTML = radioRow('support_level', opts.support_levels, 'not_sure', true);
  fillSelect($('#c-learner_group'), opts.learner_groups, profile.learner_group);
  fillSelect($('#c-purpose'), opts.purposes);
  fillSelect($('#c-cadence'), opts.cadences, 'bimonthly');
  fillSelect($('#c-setting'), opts.settings, profile.setting);
  fillSelect($('#c-format'), opts.formats, profile.format);
  if (profile.subject) form.elements.subject.value = profile.subject;
  if (profile.target_language) form.elements.target_language.value = profile.target_language;
  if (profile.first_language) form.elements.first_language.value = profile.first_language;

  const list = $('#course-list');
  async function render() {
    const courses = await api('/api/courses');
    if (!courses.length) {
      list.innerHTML = `<div class="empty">No courses yet. Create one below and every lesson after this
        will inherit its context, so you never type it twice.</div>`;
      return;
    }
    list.innerHTML = `<ul class="row-list">${courses.map((c) => `
      <li class="row">
        <div>
          <h3>${esc(c.name)}</h3>
          <p class="row__meta">${esc(c.subject || 'Subject not set')} · ${c.lessons.length} of ${
            esc(c.lesson_total || '?')} lessons planned${
            c.lessons.filter((l) => l.has_reflection).length
              ? ` · ${c.lessons.filter((l) => l.has_reflection).length} reflections recorded` : ''}</p>
        </div>
        <div class="row__actions">
          <a class="btn btn--primary" href="build.html?course=${c.id}">Plan next lesson</a>
          ${c.lessons.length ? `<a class="btn btn--quiet" href="package.html?id=${
            c.lessons[c.lessons.length - 1].id}">Last package</a>
          <a class="btn btn--quiet" href="reports.html">Course update</a>` : ''}
        </div>
      </li>`).join('')}</ul>`;
  }
  render();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api('/api/courses', { method: 'POST', body: JSON.stringify(formValues(form)) });
    form.reset();
    toast('Course created.');
    render();
  });
}

/* ------------------------------------------------------------ page: build */

async function initBuild() {
  const opts = await optionsReady();
  const form = $('#build-form');
  const courseId = params.get('course');
  const profile = await api('/api/profile').catch(() => ({}));

  $('#b-role-row').innerHTML = radioRow('teacher_role', opts.teacher_roles, profile.teacher_role || 'both');
  $('#b-support-row').innerHTML = radioRow('support_level', opts.support_levels, 'not_sure', true);
  fillSelect($('#b-learner_group'), opts.learner_groups, profile.learner_group);
  fillSelect($('#b-purpose'), opts.purposes);
  fillSelect($('#b-setting'), opts.settings, profile.setting);
  fillSelect($('#b-format'), opts.formats, profile.format);
  if (profile.subject) form.elements.subject.value = profile.subject;
  if (profile.target_language) form.elements.target_language.value = profile.target_language;
  if (profile.first_language) form.elements.first_language.value = profile.first_language;

  // Bloom options follow the learner group, so demand always suits the band.
  const bloomSelect = $('#b-bloom');
  const syncBloom = () => {
    const ladder = opts.bloom[$('#b-learner_group').value] || [];
    bloomSelect.innerHTML =
      `<option value="">Let the tool choose for this age group</option>` +
      ladder.map((b) => `<option value="${b}">${b}</option>`).join('');
  };
  $('#b-learner_group').addEventListener('change', syncBloom);
  syncBloom();

  const reflectSection = $('#reflect-section');
  const courseBanner = $('#course-banner');

  if (courseId) {
    const course = await api(`/api/courses/${courseId}`).catch(() => null);
    if (course) {
      form.elements.course_id.value = courseId;
      const done = course.lessons.length;
      courseBanner.hidden = false;
      courseBanner.innerHTML = `
        <p class="eyebrow">Continuing a course</p>
        <h2>${esc(course.name)}</h2>
        <p class="muted">Lesson ${done + 1}${course.lesson_total ? ` of ${esc(course.lesson_total)}` : ''}.
          Course context is already filled in below. Change anything that has moved on.</p>`;
      ['subject', 'target_language', 'first_language'].forEach((k) => {
        if (course[k]) form.elements[k].value = course[k];
      });
      ['learner_group', 'purpose', 'setting', 'format'].forEach((k) => {
        const el = $(`#b-${k}`);
        if (el && course[k]) el.value = course[k];
      });
      if (course.minutes) form.elements.minutes.value = course.minutes;
      syncBloom();

      const last = course.lessons[course.lessons.length - 1];
      if (last) {
        reflectSection.hidden = false;
        form.elements.prior_lesson.value = last.package.header.title || '';
        $('#reflect-intro').textContent =
          `Last lesson: "${last.package.header.title}". Two minutes here changes the next package. Skip
           anything you would rather not answer.`;
        form.elements.reflect_lesson_id.value = last.id;
      }
    }
  }

  const status = $('#build-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    const payload = {
      mode: courseId ? 'course' : 'one_off',
      course_id: courseId || null,
      teacher_role: v.teacher_role,
      subject: v.subject,
      topic: v.topic,
      lesson_idea: v.lesson_idea,
      source_text: v.source_text,
      source_link: v.source_link,
      learner_group: v.learner_group,
      purpose: v.purpose,
      support_level: v.support_level,
      target_language: v.target_language,
      first_language: v.first_language,
      setting: v.setting,
      format: v.format,
      minutes: Number(v.minutes) || 45,
      bloom_level: v.bloom_level || null,
      prior_lesson: v.prior_lesson,
      next_topic: v.next_topic,
      reflection: {
        overall: v.r_overall || '',
        content_outcome: v.r_content || '',
        language_outcome: v.r_language || '',
        struggle: v.r_struggle || '',
        enjoyed: v.r_enjoyed || '',
        cut: v.r_cut || '',
        carry: v.r_carry || '',
      },
    };

    $('#build-submit').disabled = true;
    status.hidden = false;
    status.innerHTML = `<div class="skeleton" style="width:70%"></div>
      <div class="skeleton" style="width:45%;margin-top:.6rem"></div>
      <p class="faint" style="margin-top:.9rem">Assembling your package.</p>`;

    try {
      if (v.reflect_lesson_id && Object.values(payload.reflection).some(Boolean)) {
        await api(`/api/lessons/${v.reflect_lesson_id}/reflection`, {
          method: 'PUT',
          body: JSON.stringify(payload.reflection),
        });
      }
      const pkg = await api('/api/generate', { method: 'POST', body: JSON.stringify(payload) });
      location.href = `package.html?id=${pkg.id}`;
    } catch (err) {
      $('#build-submit').disabled = false;
      status.innerHTML = `<p class="muted">Something went wrong. Nothing was lost. Please try again.</p>`;
    }
  });
}

/* ---------------------------------------------------------- page: package */

async function initPackage() {
  const id = params.get('id');
  const token = params.get('t');
  const root = $('#package-root');
  if (!id) {
    root.innerHTML = `<div class="empty">No package selected. <a href="build.html">Plan a lesson</a>.</div>`;
    return;
  }
  try {
    const pkg = await api(`/api/lessons/${id}${token ? `?token=${token}` : ''}`);
    renderPackage(pkg, root);
  } catch {
    root.innerHTML = `<div class="empty">This package could not be opened.</div>`;
  }
}

function renderPackage(pkg, root, opts = {}) {
  const h = pkg.header;
  /* fivecs.js appends its own section after this render and needs the package
     the render was built from. */
  window.__fivecsPackage = pkg;
  // Every value here is escaped at construction. Subject, course name and the
  // language fields are free text the teacher typed, and packages are openable
  // by share link, so an unescaped value would be a stored-XSS path into
  // somebody else's browser.
  const meta = [
    ['Subject', esc(h.subject)],
    ['Course', esc(h.course_name || 'Standalone lesson')],
    ['Position', esc(pkg.sequence.position)],
    ['Learners', esc(h.learner_group)],
    ['Purpose', esc(h.purpose)],
    ['Target language', esc(h.target_language)],
    ['First language', esc(h.first_language)],
    ['Language support',
      `${esc(h.support_label)} <span class="faint">${esc(h.support_cefr)}</span>`],
    ['Setting', `${esc(h.setting)}, ${esc(String(h.format).toLowerCase())}`],
    ['Length', `${esc(h.minutes)} minutes`],
    ['Planned by', esc(h.teacher_role)],
  ];

  const li = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');

  root.innerHTML = `
    <header>
      <p class="eyebrow">CLIL Lesson Package</p>
      <h1 class="page-title">${esc(h.title)}</h1>
      <dl class="pkg-meta">
        ${meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}
      </dl>
    </header>

    ${pkg.generation ? `<div class="genbar ${pkg.generation.mode === 'grounded' ? 'genbar--grounded' : ''}">
      <b>${esc(pkg.generation.mode === 'grounded' ? 'Grounded in retrieved sources' : 'Structure only')}</b>
      <span>${esc(pkg.generation.note || '')}</span>
      ${pkg.generation.error ? `<span class="faint">${esc(pkg.generation.error)}</span>` : ''}
    </div>` : ''}

    <section class="pkg-section">
      <h2>${esc(pkg.sequence.heading)}</h2>
      <div class="card card--quiet"><ul class="bullets">${li(pkg.sequence.carried_forward)}</ul></div>
    </section>

    <section class="pkg-section">
      <h2>Objectives</h2>
      <p class="mini-head">Content <span class="badge badge--bloom">Bloom: ${esc(pkg.objectives.bloom_level)}</span></p>
      <ul class="obj-list" style="margin-top:.75rem">
        ${pkg.objectives.content.map((o) => `<li>
          <div><span class="badge badge--bloom">${esc(o.bloom)}</span></div>
          <p>${esc(o.text)}</p>
          <p class="obj-note">${esc(o.note)}</p>
        </li>`).join('')}
      </ul>
      <p class="mini-head" style="margin-top:2rem">Language</p>
      <ul class="obj-list" style="margin-top:.75rem">
        ${pkg.objectives.language.map((o) => `<li>
          <div><span class="badge">${esc(o.strand)}</span></div>
          <p>${esc(o.text)}</p>
          <p class="obj-note">${esc(o.note)}</p>
        </li>`).join('')}
      </ul>
      ${pkg.objectives.learning_skill ? `<p class="mini-head" style="margin-top:2rem">Learning skills</p>
        <p style="font-size:var(--text-sm);margin-top:.5rem">${esc(pkg.objectives.learning_skill)}</p>` : ''}
    </section>

    <section class="pkg-section">
      <h2>Lesson shape</h2>
      <div class="timing-bar">
        ${pkg.timings.map((t) => `<div>${esc(t.stage)} · ${t.minutes}m</div>`).join('')}
      </div>
      ${pkg.stages.map((st) => `
        <article class="stage">
          <div class="stage__head">
            <span class="stage__num">${st.number}</span>
            <h3>${esc(st.name)}</h3>
            <span class="badge">${st.minutes} min</span>
          </div>
          <p class="stage__purpose">${esc(st.purpose)}</p>
          <div class="two-col">
            <div><p class="mini-head">Teacher does</p><ul class="bullets">${li(st.teacher_does)}</ul></div>
            <div><p class="mini-head">Learners do</p><ul class="bullets">${li(st.learners_do)}</ul></div>
          </div>
          <div class="note-row">
            <p><b>Language focus</b><br>${esc(st.language_focus)}</p>
            <p><b>Watch for</b><br>${esc(st.watch_for)}</p>
            ${st.differentiation ? `<div><b>Differentiation</b><ul class="bullets">${li(st.differentiation)}</ul></div>` : ''}
            ${st.evidence ? `<div><b>Evidence of learning</b><ul class="bullets">${li(st.evidence)}</ul></div>` : ''}
          </div>
        </article>`).join('')}
    </section>

    <section class="pkg-section">
      <h2>${esc(pkg.language_bank.heading)}</h2>
      <div class="two-col">
        <div class="card card--quiet">
          <p class="mini-head">Functions learners need</p>
          <ul class="bullets">${li(pkg.language_bank.functions)}</ul>
        </div>
        <div class="card card--quiet">
          <p class="mini-head">Sentence frames to display</p>
          <ul class="bullets">${li(pkg.language_bank.frames)}</ul>
        </div>
      </div>
      <div class="note-row">
        <p><b>Text load</b><br>${esc(pkg.language_bank.text_load)}</p>
        <p><b>First language policy</b><br>${esc(pkg.language_bank.first_language_policy)}</p>
        <p><b>Vocabulary</b><br>${esc(pkg.language_bank.vocabulary_note)}</p>
      </div>
    </section>

    <section class="pkg-section">
      <h2>Materials and preparation</h2>
      <div class="card card--quiet"><ul class="bullets">${li(pkg.materials)}</ul></div>
    </section>

    <section class="pkg-section">
      <h2>What this package cannot know</h2>
      ${pkg.compensation.blocks.map((b) => `
        <div class="flag">
          <h3>${esc(b.heading)}</h3>
          <p>${esc(b.why)}</p>
          <ul class="checklist">${b.items.map((i) => `
            <li><input type="checkbox"><span>${esc(i)}</span></li>`).join('')}</ul>
        </div>`).join('')}
    </section>

    <section class="pkg-section">
      <h2>${esc(pkg.looking_ahead.heading)}</h2>
      <div class="card card--quiet">
        <ul class="bullets">${li(pkg.looking_ahead.items)}</ul>
        <p class="faint" style="margin-top:1rem">${esc(pkg.looking_ahead.reflection_prompt)}</p>
      </div>
    </section>

    ${typeof enrichedSections === 'function' ? enrichedSections(pkg) : ''}

    <section class="pkg-section">
      <h2>${esc(pkg.review_checklist.heading)}</h2>
      ${pkg.review_checklist.groups.map((g) => `
        <div class="check-group">
          <h3>${esc(g.label)}</h3>
          <ul class="checklist">${g.items.map((i) => `
            <li><input type="checkbox"><span>${esc(i)}</span></li>`).join('')}</ul>
        </div>`).join('')}
    </section>

    <section class="pkg-section">
      <div class="disclaimer">
        <h2>${esc(pkg.disclaimer.heading)}</h2>
        ${pkg.disclaimer.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        <ul class="source-list">
          ${pkg.disclaimer.sources.map((s) =>
            `<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`).join('')}
        </ul>
      </div>
    </section>

    <div class="export-bar no-print">
      <button class="btn btn--quiet" data-copy>Copy link</button>
      <button class="btn btn--quiet" data-print>PDF</button>
      <a class="btn btn--quiet" data-docx>Word</a>
      <a class="btn btn--quiet" data-pptx>Slides</a>
      ${opts.exemplarSlug ? `<a class="btn btn--quiet" data-materials>Materials</a>` : ''}
      <span class="spacer"></span>
      ${opts.exemplarSlug
        ? `<a class="btn btn--primary" href="build.html">Plan your own</a>`
        : (pkg.course_id
          ? `<a class="btn btn--primary" href="build.html?course=${pkg.course_id}">Plan the next lesson</a>`
          : `<a class="btn btn--primary" href="courses.html">Save as a course</a>`)}
    </div>`;

  if (opts.exemplarSlug) {
    const m = $('[data-materials]');
    if (m) m.href = `${API}/api/exemplars/${opts.exemplarSlug}/materials.docx`;
    const d = $('[data-docx]');
    if (d) d.href = `${API}/api/exemplars/${opts.exemplarSlug}/export.docx`;
    const p = $('[data-pptx]');
    if (p) p.remove();
  }
  const share = opts.exemplarSlug
    ? `${location.origin}${location.pathname}?slug=${opts.exemplarSlug}`
    : `${location.origin}${location.pathname}?id=${pkg.id}&t=${pkg.share_token}`;
  $('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(share);
      toast('Share link copied.');
    } catch {
      toast(share);
    }
  });
  $('[data-print]').addEventListener('click', () => window.print());
  if (!opts.exemplarSlug) {
    $('[data-docx]').href = `${API}/api/lessons/${pkg.id}/export.docx?token=${pkg.share_token}`;
    $('[data-pptx]').href = `${API}/api/lessons/${pkg.id}/export.pptx?token=${pkg.share_token}`;
  }
}

/* -------------------------------------------------------------------- boot */

document.addEventListener('DOMContentLoaded', () => {
  chrome();
  const routes = {
    home: initHome,
    profile: initProfile,
    courses: initCourses,
    build: initBuild,
    package: initPackage,
  };
  const run = routes[document.body.dataset.page];
  if (run) Promise.resolve(run()).catch((e) => console.error(e));
});
