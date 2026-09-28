/* fivecs.js — the 5 Cs check.

   Two jobs, one engine:
     1. On fivecs.html, a teacher pastes any lesson plan and gets a strand by
        strand reading of it, with the matched wording shown back to them.
     2. On package.html and exemplars.html, the same reading runs over a
        generated package using its structured fields, which are far more
        reliable than a text scan.

   What this is not: a judgement on the lesson. The scan reads words on a page.
   It cannot see the questions a teacher asks or the talk a task actually
   produces, so every strand ends with the teacher's own verdict, and it is the
   teacher's verdict that carries into the summary. Loaded after app.js and
   reuses esc(), $, $$ and toast(). */

/* ------------------------------------------------------------- frameworks */

/* There is no single agreed fifth C. The two sets below are the ones a teacher
   is most likely to have been taught, so the framework is chosen, not assumed,
   and each one is cited on the page. */

const FIVECS_STRANDS = {
  content: {
    name: 'Content',
    gist: 'Subject knowledge, skills and understanding, built on what learners already know.',
    prompt: 'Is the subject learning here more than a topic heading, and does it start from what these learners already know?',
    signals: [
      'by the end', 'learners will know', 'students will know', 'learning objective',
      'content objective', 'content aim', 'prior knowledge', 'already know',
      'recap', 'revisit', 'build on', 'understand that', 'understand how',
      'understand why', 'learn about', 'key idea', 'key concept',
    ],
  },
  communication: {
    name: 'Communication',
    gist: 'Language for learning and through learning, with learners talking to each other and not only to the teacher.',
    prompt: 'Do learners have to produce the language themselves, and are they given the wording to do it with?',
    signals: [
      'in pairs', 'pair work', 'in groups', 'group work', 'discuss', 'discussion',
      'talk to', 'talk about', 'speaking', 'listening', 'reading', 'writing',
      'sentence frame', 'sentence starter', 'substitution table', 'language frame',
      'functional language', 'useful language', 'language of', 'vocabulary',
      'glossary', 'word bank', 'scaffold', 'role play', 'explain to', 'report back',
      'present their', 'ask each other', 'peer',
    ],
  },
  competences: {
    name: 'Competences',
    gist: 'Can-do outcomes for the subject and for the language, and a way of seeing whether learners reached them.',
    prompt: 'Could a learner tell you what they are now able to do, and is there something in the lesson that would show it?',
    signals: [
      'can-do', 'can do', 'will be able to', 'able to', 'success criteria',
      'criteria', 'outcome', 'assess', 'assessment', 'exit ticket', 'exit check',
      'check understanding', 'checking understanding', 'rubric', 'evidence of learning',
      'demonstrate', 'show that they', 'self-assess', 'answer key', 'mark',
    ],
  },
  community: {
    name: 'Community',
    gist: "Linking the lesson to learners' real world, daily life, surroundings and work.",
    prompt: 'Would these learners recognise where this shows up outside the classroom, in their own life or workplace?',
    signals: [
      'real world', 'real-world', 'real life', 'real-life', 'everyday', 'every day',
      'daily life', 'at home', 'in your area', 'local', 'community', 'neighbourhood',
      'neighborhood', 'workplace', 'at work', 'on the ward', 'in the clinic',
      'family', 'their own life', 'around them', 'outside the classroom',
      'case study', 'guest speaker', 'field trip', 'in their country',
    ],
  },
  cognition: {
    name: 'Cognition',
    gist: 'Thinking demand, from remembering and applying through to analysing, evaluating and creating.',
    prompt: 'Does the hardest thinking sit with the learners, or has the reasoning already been done for them on the handout?',
    signals: [
      'compare', 'contrast', 'classify', 'categorise', 'categorize', 'sort',
      'analyse', 'analyze', 'evaluate', 'justify', 'give reasons', 'predict',
      'hypothesis', 'hypothesise', 'infer', 'deduce', 'explain why', 'work out',
      'decide which', 'rank', 'prioritise', 'prioritize', 'design', 'solve',
      'problem', 'higher order', 'thinking skill', 'apply', 'identify', 'describe',
      'summarise', 'summarize', 'reflect',
    ],
  },
  culture: {
    name: 'Culture',
    gist: 'Awareness of self and of others, including how the subject looks from more than one place.',
    prompt: 'Is there room here for more than one perspective, and for what learners bring from their own language and setting?',
    signals: [
      'culture', 'cultural', 'intercultural', 'perspective', 'point of view',
      'in your country', 'in their country', 'compare countries', 'tradition',
      'identity', 'first language', 'mother tongue', 'home language',
      'translanguaging', 'diversity', 'global', 'international', 'norms',
      'attitudes', 'values',
    ],
  },
};

const FIVECS_FRAMEWORKS = {
  guidebook: {
    label: 'The CLIL Guidebook',
    order: ['content', 'communication', 'competences', 'community', 'cognition'],
    cite: 'Attard Montalto, Walter, Theodorou and Chrysanthou, The CLIL Guidebook, CLIL4U, funded by the European Commission.',
    url: 'https://languages.dk/archive/clil4u/book/CLIL%20Book%20Original%20EN.pdf',
  },
  coyle: {
    label: 'Coyle, with community',
    order: ['content', 'communication', 'cognition', 'culture', 'community'],
    cite: 'Coyle, Hood and Marsh (2010), the 4Cs framework, with the community strand as set out by Post-Primary Languages Ireland.',
    url: 'https://ppli.ie/wp-content/uploads/2019/05/Section-1-Content-b-1.pdf',
  },
};

const FIVECS_VERDICTS = [
  ['clear', 'Clear'],
  ['thin', 'Thin'],
  ['missing', 'Missing'],
];

/* ------------------------------------------------------------------ engine */

/* A strand is called thin rather than absent on a single hit, because one
   matched phrase is as likely to be an accident of wording as a design choice. */
function fivecsStatus(count) {
  if (count >= 3) return 'pass';
  if (count >= 1) return 'flag';
  return 'fail';
}

const FIVECS_STATUS_LABEL = {
  pass: 'Signals found',
  flag: 'Thin',
  fail: 'Not visible',
};

function fivecsEscapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* Returns the matched phrase plus a little of the text either side, so the
   teacher can see why it matched and dismiss it if the match is spurious. */
function fivecsFindSignals(text, signals) {
  const found = [];
  const seen = new Set();
  const taken = [];
  const hay = String(text || '');
  if (!hay.trim()) return found;
  for (const signal of signals) {
    /* The trailing s catches the plural a plan is as likely to use: a lesson
       says "sentence frames provided", not "sentence frame provided". */
    const re = new RegExp(`(^|[^a-z])(${fivecsEscapeRe(signal)}s?)(?![a-z])`, 'i');
    const m = re.exec(hay);
    if (!m) continue;
    const key = signal.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const at = m.index + m[1].length;
    const len = m[2].length;
    /* Two signals landing in the same sentence would quote the same line back
       twice, which reads like padding. The later one is hidden from the list
       but still counts, because it is a second thing the plan genuinely does. */
    const crowded = taken.some((prev) => Math.abs(prev - at) < 60);
    taken.push(at);
    const from = Math.max(0, at - 45);
    const to = Math.min(hay.length, at + len + 55);
    found.push({
      signal,
      crowded,
      before: (from > 0 ? '…' : '') + hay.slice(from, at).replace(/\s+/g, ' '),
      hit: hay.slice(at, at + len),
      after: hay.slice(at + len, to).replace(/\s+/g, ' ') + (to < hay.length ? '…' : ''),
    });
  }
  return found;
}

/* Structured packages carry their own evidence, so the fields are read directly
   and only fall back to the text scan for the two strands no field records. */
function fivecsFromPackage(pkg) {
  const h = pkg.header || {};
  const obj = pkg.objectives || {};
  const bank = pkg.language_bank || {};
  const stages = pkg.stages || [];
  const sheet = pkg.worksheet || {};
  const flat = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  /* Objectives arrive as objects carrying the wording plus its bloom level or
     language strand, and materials arrive as plain strings, so both shapes are
     reduced to the sentence a teacher would read. */
  const say = (v) => (v && typeof v === 'object' ? (v.text || v.detail || '') : String(v ?? ''));
  const tag = (v) => (v && typeof v === 'object' ? (v.bloom || v.strand || '') : '');

  const prose = [
    h.purpose, h.subject, obj.learning_skill,
    ...flat(obj.content).map(say), ...flat(obj.content).map((x) => (x && x.note) || ''),
    ...flat(obj.language).map(say),
    ...stages.map((s) => [s.purpose, s.language_focus, s.watch_for,
      ...flat(s.teacher_does), ...flat(s.learners_do)].join(' ')),
    sheet.learner_instructions,
    ...flat(sheet.parts).map((p) => JSON.stringify(p)),
    bank.first_language_policy, bank.vocabulary_note,
    (pkg.looking_ahead || {}).reflection_prompt,
  ].filter(Boolean).join('\n');

  const ev = {};

  ev.content = flat(obj.content).map((x) => ({
    label: tag(x) ? `Content objective, ${tag(x)}` : 'Content objective',
    detail: say(x),
  }));
  if (pkg.grounded && (pkg.grounded.brief || []).length) {
    ev.content.push({
      label: 'Grounded subject brief',
      detail: `${pkg.grounded.brief.length} statements, ${(pkg.grounded.sources || []).length} sources`,
    });
  }
  if (pkg.sequence && (pkg.sequence.carried_forward || []).length) {
    ev.content.push({
      label: 'Carried forward from the last lesson',
      detail: pkg.sequence.carried_forward.join('; '),
    });
  }

  ev.communication = flat(obj.language).map((x) => ({
    label: tag(x) || 'Language objective',
    detail: say(x),
  }));
  if ((bank.functions || []).length) {
    ev.communication.push({ label: 'Language functions', detail: bank.functions.join('; ') });
  }
  if ((bank.frames || []).length) {
    ev.communication.push({ label: 'Sentence frames', detail: `${bank.frames.length} provided` });
  }
  if ((bank.vocabulary || []).length) {
    ev.communication.push({ label: 'Vocabulary', detail: `${bank.vocabulary.length} items` });
  }
  const talk = stages.filter((s) => /pair|group|discuss|partner|each other/i.test(
    [s.language_focus, ...flat(s.learners_do)].join(' '),
  ));
  if (talk.length) {
    ev.communication.push({
      label: 'Stages with learner to learner talk',
      detail: talk.map((s) => s.name).join(', '),
    });
  }

  ev.competences = [];
  if (sheet.exit_check && sheet.exit_check.prompt) {
    ev.competences.push({ label: 'Exit check', detail: sheet.exit_check.prompt });
  }
  if ((pkg.answer_key || []).length) {
    ev.competences.push({ label: 'Answer key', detail: `${pkg.answer_key.length} items with marking notes` });
  }
  const canDo = [...flat(obj.content), ...flat(obj.language)]
    .map(say).filter((x) => /able to|can /i.test(x));
  if (canDo.length) {
    ev.competences.push({
      label: `Can-do phrasing in ${canDo.length === 1 ? 'an objective' : 'objectives'}`,
      detail: canDo.join(' '),
    });
  }
  const notes = flat(obj.content).map((x) => (x && x.note) || '').filter(Boolean);
  if (notes.length) {
    ev.competences.push({ label: 'How the objective would be evidenced', detail: notes.join(' ') });
  }
  if (obj.learning_skill) {
    ev.competences.push({ label: 'Learning skill', detail: obj.learning_skill });
  }

  ev.cognition = [];
  if (obj.bloom_level) {
    ev.cognition.push({
      label: 'Thinking level set for the lesson',
      detail: `${obj.bloom_level}${(obj.bloom_available || []).length
        ? ` (available: ${obj.bloom_available.join(', ')})` : ''}`,
    });
  }
  const thinking = stages.filter((s) => new RegExp(
    FIVECS_STRANDS.cognition.signals.slice(0, 22).map(fivecsEscapeRe).join('|'), 'i',
  ).test([s.purpose, ...flat(s.learners_do)].join(' ')));
  if (thinking.length) {
    ev.cognition.push({
      label: 'Stages asking learners to reason',
      detail: thinking.map((s) => s.name).join(', '),
    });
  }

  /* No field records community or culture, so these two are read from the
     prose the same way a pasted plan is. They are the strands most often
     missing from a generated package, which is exactly why they are shown. */
  ev.community = null;
  ev.culture = null;

  const out = {};
  for (const key of Object.keys(FIVECS_STRANDS)) {
    const fields = ev[key];
    if (fields && fields.length) {
      /* A named field is far stronger evidence than a phrase that happened to
         match, so two of them are enough where a text scan needs three. */
      out[key] = {
        kind: 'fields',
        fields,
        status: fields.length >= 2 ? 'pass' : 'flag',
      };
    } else if (fields && fields.length === 0) {
      out[key] = { kind: 'fields', fields: [], status: 'fail' };
    } else {
      const hits = fivecsFindSignals(prose, FIVECS_STRANDS[key].signals);
      out[key] = { kind: 'text', hits, status: fivecsStatus(hits.length) };
    }
  }
  return out;
}

function fivecsFromText(text) {
  const out = {};
  for (const key of Object.keys(FIVECS_STRANDS)) {
    const hits = fivecsFindSignals(text, FIVECS_STRANDS[key].signals);
    out[key] = { kind: 'text', hits, status: fivecsStatus(hits.length) };
  }
  return out;
}

/* -------------------------------------------------------------- rendering */

function fivecsStrandHtml(key, result, framework, idx) {
  const s = FIVECS_STRANDS[key];
  const status = result.status;
  let evidence;

  if (result.kind === 'fields') {
    evidence = result.fields.length
      ? `<ul class="bullets fivecs__evidence">${result.fields.map((f) => `
          <li><strong>${esc(f.label)}.</strong> ${esc(f.detail)}</li>`).join('')}</ul>`
      : `<p class="faint">Nothing in the package records this strand.</p>`;
  } else if (result.hits.length) {
    const shown = result.hits.filter((hit) => !hit.crowded).slice(0, 4);
    const rest = result.hits.length - shown.length;
    evidence = `<ul class="bullets fivecs__evidence">${shown.map((hit) => `
        <li><span class="faint">${esc(hit.before)}</span><mark>${esc(hit.hit)}</mark><span class="faint">${esc(hit.after)}</span></li>`).join('')}
      ${rest > 0
        ? `<li class="faint">and ${rest} more matched ${rest === 1 ? 'phrase' : 'phrases'}: ${esc(result.hits.filter((hit) => !shown.includes(hit)).map((hit) => hit.signal).join(', '))}</li>`
        : ''}</ul>`;
  } else {
    evidence = `<p class="faint">No wording in the plan points to this strand.</p>`;
  }

  return `
    <div class="check check--${esc(status)} fivecs__strand" data-strand="${esc(key)}">
      <div class="check__head">
        <span class="fivecs__num">${idx + 1}</span>
        <h3>${esc(s.name)}</h3>
        <span class="badge badge--${esc(status)}">${esc(FIVECS_STATUS_LABEL[status])}</span>
      </div>
      <p class="fivecs__gist">${esc(s.gist)}</p>
      ${evidence}
      <p class="fivecs__ask"><strong>Your call.</strong> ${esc(s.prompt)}</p>
      <div class="fivecs__verdict" role="group" aria-label="Your verdict on ${esc(s.name)}">
        ${FIVECS_VERDICTS.map(([value, label]) => `
          <label class="fivecs__pick">
            <input type="radio" name="verdict-${esc(key)}" value="${esc(value)}">
            <span>${esc(label)}</span>
          </label>`).join('')}
        <input class="fivecs__note" type="text" data-note="${esc(key)}"
               placeholder="What you would change, if anything"
               aria-label="Your note on ${esc(s.name)}">
      </div>
    </div>`;
}

function fivecsPanelHtml(results, frameworkKey, opts = {}) {
  const fw = FIVECS_FRAMEWORKS[frameworkKey];
  const tally = fw.order.reduce((acc, k) => {
    acc[results[k].status] = (acc[results[k].status] || 0) + 1;
    return acc;
  }, {});

  return `
    <div class="fivecs" data-framework="${esc(frameworkKey)}">
      <div class="audit-tally">
        <span class="badge badge--pass">${tally.pass || 0} with signals</span>
        <span class="badge badge--flag">${tally.flag || 0} thin</span>
        <span class="badge badge--fail">${tally.fail || 0} not visible</span>
      </div>
      <p class="faint fivecs__caveat">
        This reads the words in the plan. It cannot hear the questions you ask or the
        talk a task actually produces, so treat every line below as a question put to
        you, not a result. Your verdict is the one that goes into the summary.
      </p>
      ${fw.order.map((k, i) => fivecsStrandHtml(k, results[k], fw, i)).join('')}
      <div class="fivecs__foot">
        <button class="btn btn--quiet" type="button" data-fivecs-copy>Copy the summary</button>
        ${opts.print === false ? '' : '<button class="btn btn--text" type="button" data-fivecs-print>Print</button>'}
      </div>
      <p class="faint fivecs__cite">
        Strands as set out in ${esc(fw.label)}. ${esc(fw.cite)}
        <a href="${esc(fw.url)}" target="_blank" rel="noopener">Read the source</a>.
        There is no single agreed fifth C, so the framework above is the one you chose.
      </p>
    </div>`;
}

/* Verdicts and notes belong to the teacher, so the summary is built from those
   and only mentions the scan where the teacher left a strand unanswered. */
function fivecsSummary(root, results, frameworkKey, title) {
  const fw = FIVECS_FRAMEWORKS[frameworkKey];
  const lines = [
    `5 Cs check${title ? `: ${title}` : ''}`,
    `Framework: ${fw.label}`,
    '',
  ];
  for (const key of fw.order) {
    const picked = root.querySelector(`input[name="verdict-${key}"]:checked`);
    const note = root.querySelector(`[data-note="${key}"]`);
    const verdict = picked
      ? (FIVECS_VERDICTS.find(([v]) => v === picked.value) || [])[1]
      : `not yet judged, the scan read this as ${FIVECS_STATUS_LABEL[results[key].status].toLowerCase()}`;
    lines.push(`${FIVECS_STRANDS[key].name}: ${verdict}${note && note.value.trim() ? ` — ${note.value.trim()}` : ''}`);
  }
  lines.push('', fw.cite);
  return lines.join('\n');
}

function fivecsWire(root, results, frameworkKey, title) {
  const copy = root.querySelector('[data-fivecs-copy]');
  if (copy) {
    copy.addEventListener('click', async () => {
      const text = fivecsSummary(root, results, frameworkKey, title);
      try {
        await navigator.clipboard.writeText(text);
        toast('Summary copied.');
      } catch {
        toast('Copying is blocked here. Select the summary and copy it by hand.');
      }
    });
  }
  const print = root.querySelector('[data-fivecs-print]');
  if (print) print.addEventListener('click', () => window.print());

  /* Colour the strand by the teacher's verdict once they give one, so the
     scan's reading stops competing with theirs. */
  root.addEventListener('change', (e) => {
    if (!e.target.matches('input[type="radio"]')) return;
    const strand = e.target.closest('.fivecs__strand');
    if (!strand) return;
    const map = { clear: 'pass', thin: 'flag', missing: 'fail' };
    strand.classList.remove('check--pass', 'check--flag', 'check--fail');
    strand.classList.add(`check--${map[e.target.value]}`);
    const badge = strand.querySelector('.badge');
    badge.className = `badge badge--${map[e.target.value]}`;
    badge.textContent = `You said: ${(FIVECS_VERDICTS.find(([v]) => v === e.target.value) || [])[1].toLowerCase()}`;
  });
}

/* ---------------------------------------------------------- standalone page */

async function initFivecs() {
  const root = $('#fivecs-root');
  if (!root) return;

  const results = { current: null, framework: 'guidebook', title: '' };

  const run = (text, title) => {
    results.title = title || '';
    results.current = fivecsFromText(text);
    const out = $('#fivecs-out');
    out.innerHTML = fivecsPanelHtml(results.current, results.framework);
    fivecsWire(out, results.current, results.framework, results.title);
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  $('[data-fivecs-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#fivecs-text').value;
    if (text.trim().length < 40) {
      toast('Paste a little more of the plan, there is not enough here to read.');
      return;
    }
    run(text, $('#fivecs-title').value.trim());
  });

  $$('[name="fivecs-framework"]').forEach((input) => {
    input.addEventListener('change', () => {
      results.framework = input.value;
      $('[data-fivecs-cite]').textContent = FIVECS_FRAMEWORKS[input.value].cite;
      $('[data-fivecs-cite-link]').href = FIVECS_FRAMEWORKS[input.value].url;
      if (results.current) {
        const out = $('#fivecs-out');
        out.innerHTML = fivecsPanelHtml(results.current, results.framework);
        fivecsWire(out, results.current, results.framework, results.title);
      }
    });
  });

  /* A teacher arriving from a package gets it loaded rather than retyped. */
  const id = params.get('id');
  const slug = params.get('slug');
  if (id || slug) {
    try {
      const pkg = slug
        ? await api(`/api/exemplars/${encodeURIComponent(slug)}`)
        : await api(`/api/lessons/${id}${params.get('t') ? `?token=${params.get('t')}` : ''}`);
      results.title = pkg.header.title;
      results.current = fivecsFromPackage(pkg);
      const out = $('#fivecs-out');
      out.innerHTML = fivecsPanelHtml(results.current, results.framework);
      fivecsWire(out, results.current, results.framework, results.title);
      $('#fivecs-title').value = pkg.header.title;
      $('[data-fivecs-loaded]').hidden = false;
      $('[data-fivecs-loaded] strong').textContent = pkg.header.title;
    } catch {
      toast('That lesson could not be loaded. Paste the plan instead.');
    }
  }
}

/* ------------------------------------------------- attaching to a package */

/* app.js owns #package-root and replaces its contents wholesale, so rather than
   reach into that function the check waits for the render to land and appends
   itself. Nothing here runs if the package never arrives. */
function fivecsAttachToPackage() {
  const page = document.body.dataset.page;
  if (page !== 'package' && page !== 'exemplars') return;
  const root = $('#package-root') || $('#exemplar-root');
  if (!root) return;

  let done = false;
  const attach = () => {
    if (done) return;
    const anchor = root.querySelector('.disclaimer');
    const pkg = window.__fivecsPackage;
    if (!anchor || !pkg) return;
    done = true;
    observer.disconnect();

    const results = fivecsFromPackage(pkg);

    const section = document.createElement('section');
    section.className = 'pkg-section';
    section.id = 'fivecs';
    section.innerHTML = `
      <h2>The 5 Cs check</h2>
      <p class="faint" style="margin-bottom:var(--space-5)">
        A strand by strand read of this package against the CLIL Guidebook 5Cs.
        Community and culture are the two the generator is least able to supply,
        because they depend on who is in front of you.</p>
      ${fivecsPanelHtml(results, 'guidebook', { print: false })}`;
    anchor.parentNode.insertBefore(section, anchor);
    fivecsWire(section, results, 'guidebook', pkg.header.title);
    const link = document.createElement('p');
    link.className = 'faint fivecs__handoff';
    link.innerHTML = `Working from a plan you wrote elsewhere? <a href="fivecs.html">Run the same check on it</a>.`;
    section.append(link);
  };

  const observer = new MutationObserver(attach);
  observer.observe(root, { childList: true, subtree: true });
  attach();
}

document.addEventListener('DOMContentLoaded', () => {
  initFivecs().catch((err) => console.error(err));
  fivecsAttachToPackage();
});
