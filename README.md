# CLIL Lesson Lab

A planning tool that helps teachers build a full Content and Language Integrated Learning lesson,
subject and language planned together, without starting from a blank page every time.

**[Click Here to Visit the Live Website →](https://portfolio-ck-clil.pplx.app/index.html)**

---

## What it is

Most CLIL guidance explains the theory, content, communication, cognition, culture, and leaves the
teacher to work out what that looks like in a 45-minute lesson on Tuesday. This tool builds the
lesson instead: a full package with objectives, a five-stage structure, language support, a
worksheet, an answer key and a glossary, generated from what the teacher already knows about their
learners and their course.

The framing is deliberately plain. No characters, no points, no rewards. A teacher's time is the
scarce resource here, not their attention, so the tool gets out of the way and produces something
usable.

Courses hold what does not change week to week: the subject, the learner group, the language
support level. Each new lesson inherits that context and starts from how the last lesson went, so
lesson three does not repeat the setup work lesson one already did.

## How it works

A teacher enters a course once, subject, learner group, purpose, target and first language, how
much language support these learners need, and then plans lessons inside it. Planning a lesson can
also stand alone, with nothing set up first.

Every package follows the same fixed shape:

| Part | What it contains |
| --- | --- |
| Header and sequence | Where this lesson sits in the course, and what carried forward from the reflection on the last one |
| Objectives | A content objective tagged to a Bloom's level suited to the age band, plus language objectives split into language of, for, and through learning |
| Five stages | Bridge back, pre-task scaffold, content input, main task, report and check, each proportionally timed |
| Language support bank | Functions, sentence frames, text load, and a first-language policy |
| Materials | Worksheet, answer key, glossary, teacher script |
| Compensation layer | Support aimed at what the plan cannot know: a language teacher gets subject accuracy prompts, a subject teacher gets the language demand made visible, a dual-role teacher gets a balance check |
| Review checklist | Subject accuracy, policy, cultural representation, access |

Subject content is written from retrieved sources rather than invented, and a separate audit pass
checks the result: twelve checks against the corpus and the structural rules, each returned as
passed, flagged, or failed with a specific note. On the "Silk Roads" worked example, the audit
flags a cookbook given a chronological position none of the six sources actually support. It stays
visible, because a tool that only shows its successes cannot be trusted about its failures.

## Features

- **Grounded generation with a visible audit.** Every factual claim in the subject brief carries the
  index of the source it came from. A second model pass checks the lesson and materials against
  that same source set and against the structural rules, and reports what it could not confirm
  rather than letting it through silently.
- **The 5 Cs check.** Paste any lesson plan, from this tool or from anywhere else, and read it back
  strand by strand against the CLIL 5 Cs, content, communication, competences, community, cognition.
  The tool shows the wording it matched; the teacher decides what it means. Two frameworks are
  offered, since there is no single agreed fifth C.
- **Worked examples, served without generating anything.** Three complete packages, each with
  materials, citations, and the audit left visible, including what it found wrong.
- **Course updates.** A family newsletter or an internal staff one-pager, drafted from the lessons
  and reflections already in a course. Nothing new is asked for, and a teacher edits both before
  sending. No learner names are ever asked for or stored.
- **Exports.** Word and PowerPoint, generated on request from the same package data shown on screen.
- **Light and dark themes**, switchable, on a calm sage, sky and sand palette with black text.

## Instructional design grounding

- **The CLIL 4Cs framework** (Coyle) for content, communication, cognition, and culture
- **The CLIL Guidebook's 5Cs** (Attard Montalto, Walter, Theodorou, Chrysanthou) for the alternate
  content, communication, competences, community, cognition framing used in the 5 Cs check
- **Bloom's revised taxonomy** for the cognitive level behind each content objective
- **CEFR** for language support levels, shown in plain language with the formal band alongside
- **Language of, for, and through learning** (Coyle, Hood and Marsh) as the structure behind every
  language objective

## Technology

A static front end (HTML, CSS, vanilla JavaScript, no framework or build step) served alongside a
FastAPI backend that holds the lesson engine, the source retrieval, and the model calls.

```
index.html, courses.html, build.html,      pages
package.html, exemplars.html, profile.html,
reports.html, fivecs.html

assets/css/base.css      design tokens, both colour themes
assets/css/style.css     components, print stylesheet
assets/js/app.js         shared chrome, API client, package renderer
assets/js/enriched.js    the grounded sections: brief, worksheet, key, glossary, audit
assets/js/reports.js     inline editor for course updates
assets/js/fivecs.js      the 5 Cs check engine

api_server.py       FastAPI app: profile, courses, lessons, reflections, exports
api_ai.py           grounded generation, re-audit, exemplars, materials export
api_documents.py    course update routes
clil_engine.py      lesson structure; all pedagogy decisions live here
clil_reports.py     course-level update drafting
generator.py        the model layer: write, build materials, audit
grounding.py        source retrieval, biased to institutional and open-access material
exemplars/           three pre-generated worked examples and their cached evidence
```

### Running it locally

```bash
git clone <repository-url>
cd clil-lesson-lab
python api_server.py          # API on :8000
python -m http.server 5173    # static front end on :5173
```

Generation calls an Anthropic model and needs a credential set as an environment variable. Without
one, the deterministic lesson structure still returns, with a note explaining that the subject
detail is left for the teacher to write.

## Accessibility

- Every colour-coded status (passed, flagged, failed) is also labelled in text.
- Forms are keyboard operable, with visible focus states restyled to match the palette rather than
  relying on the browser default.
- A print stylesheet renders the package page cleanly for the worksheet and materials, without the
  export round trip.

## Design system

Lato for body text, Be Vietnam Pro for display, a calm sage, sky and sand palette, black text with
colour reserved for accents and state. No illustrated scenes, no gamified reward elements: the
absence of those is deliberate, since this tool is aimed at working teachers rather than at
onboarding through play.

## Authorship and attribution

Concept, instructional design, the lesson schema, the compensation layer, the 5 Cs framework
research, and testing by Carmen Khoury.

The code was generated by AI (Perplexity) working from my written specification and iterative
direction. I did not hand-write the Python or JavaScript. I designed what the tool had to produce,
why the lesson takes the shape it does, what the audit should check for, and what a teacher should
walk away with, then directed and tested the build through many rounds of revision.

I am naming that plainly because the distinction matters. This is a learning design and AI-direction
portfolio piece, not a software engineering one.

## Status

A concept project, functional and publicly usable, served from a private demo backend. Public
visitors read the three static worked examples rather than trigger billed generation, a deliberate
choice explained in the code. Not formally validated with a teacher cohort.

Possible next passes: a course-level SWOT-style context capture at setup, SMART goal-writing
guidance beside the objectives, and real teacher accounts in place of the current anonymous
visitor identity.

## Licence

To be confirmed before reuse. Please ask before adapting the pedagogical content, the lesson
schema, or the audit criteria.
