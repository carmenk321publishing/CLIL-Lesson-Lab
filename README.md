# CLIL Lesson Lab

A planning tool for teachers new to Content and Language Integrated Learning (CLIL). The concept,
structure and learning design are mine. I used AI to build it to my specifications, then tested and
revised it myself.

**Live site:** https://portfolio-ck-clil.pplx.app

## Skeleton build notes

A planning tool for teachers new to CLIL. A teacher supplies context, the tool returns a
structured CLIL Lesson Package, and the reflection they write afterwards shapes the next one.

This is a skeleton: the structure, data model, interface and export paths are real and working.
Subject-specific detail is left as guided placeholders, with one clearly marked insertion point
for the generative layer.

## Running it

```bash
python api_server.py          # API on :8000
python -m http.server 5173    # static front end on :5173
```

## Files

| File | Role |
| --- | --- |
| `clil_engine.py` | Lesson structure. All lesson pedagogy is decided here and nowhere else. |
| `grounding.py` | Source retrieval. Biased to institutional and open-access material. |
| `generator.py` | The model layer: write, build materials, audit. Three passes. |
| `api_ai.py` | Grounded generation, re-audit, exemplars and the materials export. |
| `build_exemplar.py` | Produces a published exemplar. Caches retrieval per slug. |
| `clil_reports.py` | Course-level updates: family newsletter and internal staff one-pager. |
| `api_server.py` | FastAPI app: profile, courses, lessons, reflections, share links, exports. |
| `api_documents.py` | Routes for course updates, kept separate from the lesson pipeline. |
| `index.html` | Landing page with the two entry paths. |
| `profile.html` | Teacher profile, asked once. Drives the compensation layer. |
| `courses.html` | Course list and course creation. |
| `build.html` | Lesson intake, with the prior-lesson reflection at the top when inside a course. |
| `package.html` | The rendered package, review checklist, disclaimer and exports. |
| `reports.html` | Course updates: draft, edit inline, export. |
| `exemplars.html` | Published worked examples, served without generating anything. |
| `fivecs.html` | The 5 Cs check: reads any lesson plan strand by strand, with the teacher's verdict carried into the summary. |
| `assets/css/base.css` | Tokens, both colour modes, reset. |
| `assets/css/style.css` | Components, including the print stylesheet used for PDF. |
| `assets/js/app.js` | Shared chrome, API client, page controllers, package renderer. |
| `assets/js/reports.js` | The inline document editor for course updates. |
| `assets/js/enriched.js` | Renders the grounded sections: brief, worksheet, key, glossary, audit. |
| `assets/js/fivecs.js` | The 5 Cs check engine, used on its own page and attached to every package. |
| `assets/img/wash.svg` | The watercolour backdrop, drawn with SVG turbulence filters. |

## Data model

Three stored objects, so context is entered once and never retyped.

- **Profile** — role identity, subject, languages, usual learner group, setting and format.
- **Course** — subject, learner group, purpose, languages, support level, length, lesson count.
- **Lesson** — the payload, the generated package, a share token, and the teacher's reflection.
- **Document** — a course update, its kind, the teacher's edits and a share token.

Records are scoped by the `X-Visitor-Id` header the host proxy supplies, since sandboxed frames
have no cookies or local storage. Real accounts replace this layer without touching the engine.

## The package schema

Fixed order, nothing omitted:

1. Header and context
2. Where this lesson sits — the sequence bridge, including reflection carried forward
3. Objectives — content objectives tagged to a Bloom level suited to the age band, plus language
   objectives split into language of, for and through learning
4. Lesson shape — five stages with proportional timing: bridge back, pre-task scaffold, content
   input, main task, report and check
5. Language support bank — functions, sentence frames, text load, first-language policy
6. Materials and preparation
7. Support for what the package cannot know — the compensation layer
8. Looking ahead
9. Professional review checklist — subject accuracy, policy, culture and representation, access
10. Disclaimer and framework sources

## Course updates

Both are drafted from records the account already holds: lesson packages plus the teacher's own
reflections. Nothing new is asked for. Every section is editable in place, and sections can be
removed.

**Family newsletter.** What was covered, what learners can now do, what went well, language they
may bring home, and a short section on how progress works when a subject is taught through another
language. That last one answers the question families actually ask, so it is generated rather than
left blank.

**Staff one-pager.** For a principal, academic manager or co-instructor. Progress against content
and language objectives separately, what is working, where learners are struggling, what the
teacher already tried, the specific ask, and what is still unverified.

Cadence is set per course: every two months, monthly, once a term, or only on request. In this
build cadence is stored and displayed; the scheduled reminder is not wired up yet.

### Two privacy rules, enforced in code

1. **No learner names, ever.** Neither document asks for or stores them. Where named detail belongs
   in a staff briefing, the tool emits a labelled blank and tells the teacher to complete it on
   their own device and route it through the school's channel.
2. **Locked sections cannot be silently rewritten.** `update_document()` preserves the generated
   wording of any section marked `locked`. A teacher can delete such a section, but cannot edit a
   privacy or liability notice into something misleading and then send it out.

## Two design decisions worth noting

**Grade before level.** CLIL is content-led, so the intake asks for the learner group and the
purpose of learning first. Language proficiency is a supporting field in plain language, with the
CEFR equivalent shown quietly beside it and "I am not sure yet" as a valid answer. When the answer
is unknown the package states the assumption it made rather than hiding it.

**The compensation layer.** A language teacher receives subject accuracy prompts and misconception
checks. A subject teacher receives the language demand of the task made explicit. A dual-role
teacher receives a balance check instead. This is decided in `clil_engine._compensation()`.

## The generation pipeline

Three model passes, run after the deterministic structure already exists. If any pass fails, the
complete structure is still returned, which is the degradation behaviour a teacher-facing tool
needs.

1. **Retrieve** (`grounding.py`) — search, filter to institutional and open-access domains, fetch
   and extract only what this lesson needs. Commercial content sites are excluded by pattern.
2. **Write** (`generator.py`, pass 1) — objectives, subject brief, misconceptions, vocabulary,
   language bank, input stage and main task. Only the retrieved corpus may be used for facts, and
   every claim carries a source index.
3. **Build materials** (pass 2) — student worksheet, answer key, glossary, teacher script.
4. **Audit** (pass 3) — a separate call checks twelve things against the corpus and the structural
   rules, and returns pass, flag or fail with a specific note. It reports; it never rewrites.

### Rules enforced in code, not in the prompt

- Vocabulary is truncated to the cap for the learner's support level after generation.
- The audit receives the **full** corpus, never a truncated one. A source the auditor cannot see
   gets reported as a fabricated citation, which is a false accusation and destroys trust in the
   whole audit. This happened during development and is the reason for the comment in
   `audit_content()`.
- Invalid JSON gets one repair attempt before the pass is treated as failed.
- Structure is never replaced by model output, only populated. Missing fields fall back to the
   deterministic version.

### Why exemplars are static

`exemplars/*.json` are pre-generated and served as files. A visitor reading one costs nothing.
Public generation billed to one account is an unbounded liability, so the live pipeline stays
private and the published examples carry the quality argument.

The first exemplar deliberately ships with a failing audit check. The audit caught the lesson
teaching "repaying an oxygen debt", an outdated model of EPOC that none of the six sources support.
It is left visible because a tool that only shows its successes cannot be trusted about its
failures.

## Not built yet

File upload and extraction, real accounts, bring-your-own-key, generation rate limits and caching,
a CEFR language-demand engine, scheduled update reminders, and terms and privacy pages.

## Framework sources

Structure is informed by public, institutional material. No third-party course content is
reproduced anywhere in this project.

- CEFR levels and descriptors, Council of Europe —
  https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors
- European Framework for CLIL Teacher Education, European Centre for Modern Languages —
  https://www.ecml.at/en/Resources/ECML-resources/ID/35
- Multilingualism policy, European Commission —
  https://education.ec.europa.eu/focus-topics/improving-quality/multilingualism/about-multilingualism-policy
- Coyle's 4Cs and the language of, for and through learning distinction, cited as scholarship —
  https://www.cambridge.org/core/elements/content-and-language-integrated-learning-clil/9F6F698B7526AC6313DA1E95A61C2271
