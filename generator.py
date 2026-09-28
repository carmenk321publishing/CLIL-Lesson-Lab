"""
generator.py — the model layer, in three passes.

Pass 1  WRITE       Fill the package structure with subject-specific content,
                    using only the retrieved corpus. Every factual claim must
                    carry the index of the source it came from.
Pass 2  ARTEFACTS   Produce the student worksheet, answer key and glossary.
Pass 3  VERIFY      A separate call audits pass 1 and 2 against the corpus and
                    against the structural rules, and flags what it cannot
                    confirm rather than letting it through silently.

Design rules that matter more than the prompts:
  - The model may not change the lesson structure. It fills named fields.
  - Anything not traceable to a source is marked, not asserted.
  - Vocabulary load is capped by the learner's support level, in code.
  - If any pass fails, the deterministic package is still returned intact.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

WRITE_MODEL = os.environ.get("CLIL_WRITE_MODEL", "claude_sonnet_5_0")
VERIFY_MODEL = os.environ.get("CLIL_VERIFY_MODEL", "claude_sonnet_5_0")

VOCAB_CAP = {
    "beginner": 5,
    "heavy_support": 6,
    "some_support": 8,
    "largely_independent": 10,
    "not_sure": 6,
}


class GenerationError(RuntimeError):
    pass


def _client():
    from anthropic import Anthropic
    return Anthropic()


def _ask(model: str, system: str, user: str, *, max_tokens: int = 8000) -> str:
    message = _client().messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(block.text for block in message.content if block.type == "text")


def _json(raw: str) -> dict[str, Any]:
    """Models wrap JSON in prose or fences often enough to handle it here."""
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise GenerationError("No JSON object in model response")
    return json.loads(text[start:end + 1])


def _ask_json(model: str, system: str, user: str, *, max_tokens: int = 8000) -> dict[str, Any]:
    """Ask for JSON, and repair once if the model returns something invalid.

    A single unescaped quote in a definition should not cost a teacher their
    whole lesson, so one repair attempt is cheaper than a failed generation.
    """
    raw = _ask(model, system, user, max_tokens=max_tokens)
    try:
        return _json(raw)
    except (json.JSONDecodeError, GenerationError) as first:
        repaired = _ask(
            model,
            "You fix malformed JSON. Return only valid JSON with identical content. "
            "Escape any double quotes inside string values. Change nothing else.",
            f"This JSON failed to parse with: {first}\n\n{raw}",
            max_tokens=max_tokens,
        )
        return _json(repaired)


# ---------------------------------------------------------------------------
# Shared context block
# ---------------------------------------------------------------------------

def _context(pkg: dict[str, Any], payload: dict[str, Any]) -> str:
    h = pkg["header"]
    return (
        f"SUBJECT: {h['subject']}\n"
        f"TOPIC: {h['title']}\n"
        f"LEARNERS: {h['learner_group']}\n"
        f"PURPOSE OF STUDY: {h['purpose']}\n"
        f"TARGET LANGUAGE: {h['target_language']}\n"
        f"LEARNERS' FIRST LANGUAGE: {h['first_language']}\n"
        f"LANGUAGE SUPPORT NEEDED: {h['support_label']} ({h['support_cefr']})\n"
        f"SETTING: {h['setting']}, {h['format']}\n"
        f"LESSON LENGTH: {h['minutes']} minutes\n"
        f"TEACHER'S OWN TRAINING: {h['teacher_role']}\n"
        f"COGNITIVE DEMAND REQUIRED (Bloom): {pkg['objectives']['bloom_level']}\n"
        f"VOCABULARY CAP FOR THIS SUPPORT LEVEL: "
        f"{VOCAB_CAP.get(payload.get('support_level') or 'not_sure', 6)} new terms\n"
        f"TEACHER'S OWN IDEA FOR THE LESSON: {payload.get('lesson_idea') or 'none given'}\n"
        f"MATERIAL THE TEACHER SUPPLIED: {(payload.get('source_text') or 'none')[:1500]}\n"
    )


WRITE_SYSTEM = """You write CLIL lesson content for teachers. CLIL means a subject is taught \
through an additional language, so the subject content leads and the language is scaffolded to \
give access to it.

Absolute rules:
1. Use ONLY the numbered sources in the corpus for subject facts. Never add a fact from your own \
knowledge. Every factual claim you write must carry the source index, like [2].
2. If the corpus does not support something a good lesson needs, put it in "gaps" instead of \
inventing it.
3. Content objectives must be achievable in the stated lesson length and match the stated Bloom \
level. Language objectives must be achievable at the stated support level.
4. The main task must have ONE concrete outcome learners produce. Never write vague verb lists \
such as "solve, sort, decide or design something about X". Name the actual task.
5. The task must genuinely require the target language. If the task could be completed in silence, \
rewrite it.
6. Never exceed the vocabulary cap. Choose the terms that unlock the content, not every term.
7. Write for the stated age group. Do not write undergraduate prose for twelve year olds.

Reply with JSON only, no commentary. Inside string values use single quotes, never double quotes, 
so the JSON stays valid."""

WRITE_TEMPLATE = """{context}

CORPUS (the only permitted source of subject facts):
{corpus}

Return this exact JSON shape:

{{
  "subject_brief": [
    {{"claim": "one sentence of subject content the teacher must be sure of", "source": 1}}
  ],
  "misconceptions": [
    {{"learners_think": "...", "why_it_is_wrong": "...", "what_is_correct": "...", "source": 2}}
  ],
  "content_objectives": [
    {{"bloom": "Analyse", "text": "By the end of the lesson, learners will be able to ...", "evidence": "how the teacher will know"}}
  ],
  "language_objectives": [
    {{"strand": "Language of learning", "text": "..."}},
    {{"strand": "Language for learning", "text": "..."}},
    {{"strand": "Language through learning", "text": "..."}}
  ],
  "vocabulary": [
    {{"term": "...", "definition": "learner-facing definition at the right level", "example_sentence": "...", "visual": "what image or diagram to show", "source": 1}}
  ],
  "language_bank": {{
    "functions": ["the specific things learners must do with language in this task"],
    "frames": ["sentence frames that fit THIS topic, not generic ones"],
    "pronunciation_watch": ["terms likely to be mispronounced, with the difficulty named"]
  }},
  "input_stage": {{
    "explanation_for_teacher": "how to deliver the content in this lesson, in 3 to 5 sentences, with source indices",
    "board_or_screen": ["what goes on the board or screen, in order"],
    "checking_questions": [{{"question": "...", "expected": "..."}}]
  }},
  "main_task": {{
    "name": "short name for the task",
    "outcome": "the single concrete thing learners produce",
    "why_language_is_needed": "one sentence",
    "teacher_steps": ["..."],
    "learner_steps": ["..."],
    "grouping": "how learners are organised, suited to the stated setting and format",
    "differentiation": {{"less_confident": "...", "more_confident": "...", "mixed": "..."}}
  }},
  "gaps": ["anything a good lesson needs that the corpus did not support"]
}}"""


ARTEFACT_SYSTEM = """You produce classroom-ready materials from an already-written CLIL lesson.

Rules:
1. The worksheet must be usable as printed. Learners must be able to complete it from the lesson \
input, not from prior knowledge or outside research.
2. Language demand on the worksheet must match the stated support level. Provide the frames \
learners need on the sheet itself.
3. Every worksheet item must have an answer in the answer key, including a note on what to accept.
4. Mark clearly where subject understanding is being assessed and where language is being \
assessed. They are never the same item.
5. Use only the subject facts supplied to you. Add nothing new.

Reply with JSON only. Inside string values use single quotes, never double quotes, so the JSON 
stays valid."""

ARTEFACT_TEMPLATE = """{context}

THE LESSON CONTENT YOU ARE BUILDING MATERIALS FOR:
{lesson}

Return this exact JSON shape:

{{
  "worksheet": {{
    "title": "...",
    "learner_instructions": "one or two sentences a learner can follow alone",
    "language_help_box": ["the frames and key words printed on the sheet"],
    "parts": [
      {{"number": 1, "heading": "...", "instructions": "...",
        "assesses": "content" or "language",
        "items": [{{"prompt": "...", "response_type": "label" | "short answer" | "table" | "ranking" | "diagram" | "extended", "lines": 2}}]}}
    ],
    "exit_check": {{"prompt": "one question answerable in 30 seconds", "note": "first language accepted"}}
  }},
  "answer_key": [
    {{"part": 1, "prompt": "...", "answer": "...", "accept_also": "...", "marking_note": "..."}}
  ],
  "glossary": [
    {{"term": "...", "definition": "...", "part_of_speech": "...", "pronunciation_note": "...", "first_language_space": true}}
  ],
  "teacher_script": ["3 to 6 things the teacher actually says aloud, in order"]
}}"""


VERIFY_SYSTEM = """You audit generated CLIL lesson material. You are the last check before a \
teacher sees it, so be strict and specific. You do not rewrite; you report.

For each check return status "pass", "flag" or "fail" and a short specific note. Use "flag" when \
something is probably fine but a human should confirm it. Use "fail" when it should not reach a \
classroom as written.

Reply with JSON only."""

VERIFY_TEMPLATE = """{context}

CORPUS THE CONTENT WAS SUPPOSED TO COME FROM:
{corpus}

GENERATED LESSON CONTENT:
{lesson}

GENERATED MATERIALS:
{artefacts}

Run these checks and return this exact JSON shape:

{{
  "checks": [
    {{"name": "Every subject claim traces to a source", "status": "pass|flag|fail", "note": "..."}},
    {{"name": "No fact contradicts the corpus", "status": "...", "note": "..."}},
    {{"name": "No outdated or disputed science presented as settled", "status": "...", "note": "..."}},
    {{"name": "Objectives achievable in the lesson length", "status": "...", "note": "..."}},
    {{"name": "Cognitive demand matches the stated Bloom level", "status": "...", "note": "..."}},
    {{"name": "Vocabulary load within the cap", "status": "...", "note": "..."}},
    {{"name": "Language on the worksheet matches the support level", "status": "...", "note": "..."}},
    {{"name": "Task genuinely requires the target language", "status": "...", "note": "..."}},
    {{"name": "Task outcome is concrete, not a verb list", "status": "...", "note": "..."}},
    {{"name": "Every worksheet item has an answer", "status": "...", "note": "..."}},
    {{"name": "Content and language assessed separately", "status": "...", "note": "..."}},
    {{"name": "Age and register appropriate for the learner group", "status": "...", "note": "..."}}
  ],
  "unsupported_claims": [{{"claim": "...", "why": "..."}}],
  "teacher_must_confirm": ["specific things only the teacher can decide, in their context"]
}}"""


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def enrich(pkg: dict[str, Any], payload: dict[str, Any], evidence: dict[str, Any]) -> dict[str, Any]:
    """Run the three passes and fold the results into the package."""
    if not evidence.get("corpus"):
        pkg["generation"] = {
            "mode": "structure only",
            "note": "No usable sources were found, so no subject content was generated. "
                    "The structure below is complete and the subject detail is yours to write.",
        }
        return pkg

    context = _context(pkg, payload)
    cap = VOCAB_CAP.get(payload.get("support_level") or "not_sure", 6)

    lesson = _ask_json(
        WRITE_MODEL, WRITE_SYSTEM,
        WRITE_TEMPLATE.format(context=context, corpus=evidence["corpus"]),
    )

    # Hard cap enforced in code, never left to the prompt.
    lesson["vocabulary"] = (lesson.get("vocabulary") or [])[:cap]

    artefacts = _ask_json(
        WRITE_MODEL, ARTEFACT_SYSTEM,
        ARTEFACT_TEMPLATE.format(context=context, lesson=json.dumps(lesson, indent=1)),
        max_tokens=9000,
    )

    audit = audit_content(context, lesson, artefacts, evidence)
    return _merge(pkg, lesson, artefacts, audit, evidence)


def audit_content(context: str, lesson: dict[str, Any], artefacts: dict[str, Any],
                  evidence: dict[str, Any]) -> dict[str, Any]:
    """Pass 3, callable on its own so an existing package can be re-audited."""
    try:
        return _ask_json(
            VERIFY_MODEL, VERIFY_SYSTEM,
            VERIFY_TEMPLATE.format(
                context=context,
                # Never truncate the corpus here. A source the auditor cannot
                # see gets reported as a fabricated citation, which is a false
                # accusation and destroys trust in the whole audit.
                corpus=evidence["corpus"],
                lesson=json.dumps(lesson, indent=1),
                artefacts=json.dumps(artefacts, indent=1),
            ),
            max_tokens=8000,
        )
    except Exception as exc:
        return {
            "checks": [{"name": "Verification pass", "status": "fail",
                        "note": f"The audit could not be completed ({type(exc).__name__}: {exc}). "
                                f"Treat every claim below as unverified."}],
            "unsupported_claims": [],
            "teacher_must_confirm": ["Everything. The automatic check did not run."],
        }


def rebuild_inputs(pkg: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Reconstruct the audit inputs from a merged package.

    Lets a stored package be re-audited without regenerating it, which matters
    because auditing is cheap and regenerating is not.
    """
    task_stage = next((s for s in pkg["stages"] if s["number"] == 4), {})
    input_stage = next((s for s in pkg["stages"] if s["number"] == 3), {})
    grounded = pkg.get("grounded") or {}
    bank = pkg.get("language_bank") or {}

    lesson = {
        "subject_brief": grounded.get("brief", []),
        "misconceptions": grounded.get("misconceptions", []),
        "content_objectives": pkg["objectives"]["content"],
        "language_objectives": pkg["objectives"]["language"],
        "vocabulary": bank.get("vocabulary", []),
        "language_bank": {
            "functions": bank.get("functions", []),
            "frames": bank.get("frames", []),
            "pronunciation_watch": bank.get("pronunciation_watch", []),
        },
        "input_stage": {
            "explanation_for_teacher": input_stage.get("purpose", ""),
            "board_or_screen": input_stage.get("teacher_does", []),
        },
        "main_task": {
            "name": task_stage.get("name", ""),
            "outcome": task_stage.get("purpose", ""),
            "why_language_is_needed": task_stage.get("language_focus", ""),
            "teacher_steps": task_stage.get("teacher_does", []),
            "learner_steps": task_stage.get("learners_do", []),
            "differentiation": task_stage.get("differentiation", []),
        },
        "gaps": grounded.get("gaps", []),
    }
    artefacts = {
        "worksheet": pkg.get("worksheet"),
        "answer_key": pkg.get("answer_key", []),
        "glossary": pkg.get("glossary", []),
        "teacher_script": pkg.get("teacher_script", []),
    }
    return lesson, artefacts


def reaudit(pkg: dict[str, Any], payload: dict[str, Any], evidence: dict[str, Any]) -> dict[str, Any]:
    lesson, artefacts = rebuild_inputs(pkg)
    pkg["verification"] = audit_content(_context(pkg, payload), lesson, artefacts, evidence)
    return pkg


def _merge(pkg: dict[str, Any], lesson: dict[str, Any], artefacts: dict[str, Any],
           audit: dict[str, Any], evidence: dict[str, Any]) -> dict[str, Any]:
    """Fold generated content into the deterministic package.

    Structure is never replaced, only populated. If a field is missing from the
    model output, the deterministic version survives.
    """
    if lesson.get("content_objectives"):
        pkg["objectives"]["content"] = [
            {"bloom": o.get("bloom") or pkg["objectives"]["bloom_level"],
             "text": o.get("text", ""),
             "note": o.get("evidence", "")}
            for o in lesson["content_objectives"]
        ]
    if lesson.get("language_objectives"):
        pkg["objectives"]["language"] = [
            {"strand": o.get("strand", ""), "text": o.get("text", ""), "note": ""}
            for o in lesson["language_objectives"]
        ]

    bank = lesson.get("language_bank") or {}
    if bank.get("functions"):
        pkg["language_bank"]["functions"] = bank["functions"]
    if bank.get("frames"):
        pkg["language_bank"]["frames"] = bank["frames"]
    if bank.get("pronunciation_watch"):
        pkg["language_bank"]["pronunciation_watch"] = bank["pronunciation_watch"]
    if lesson.get("vocabulary"):
        pkg["language_bank"]["vocabulary"] = lesson["vocabulary"]
        pkg["language_bank"]["vocabulary_note"] = (
            f"{len(lesson['vocabulary'])} terms, within the cap for this support level. "
            "Add a first-language gloss beside each one."
        )

    # Stage 3 and 4 are the two stages the model can meaningfully improve.
    stages = {s["number"]: s for s in pkg["stages"]}
    inp = lesson.get("input_stage") or {}
    if inp and 3 in stages:
        s = stages[3]
        s["purpose"] = inp.get("explanation_for_teacher", s["purpose"])
        if inp.get("board_or_screen"):
            s["teacher_does"] = inp["board_or_screen"]
        if inp.get("checking_questions"):
            s["learners_do"] = [f"Answer: {q['question']} (expected: {q['expected']})"
                                for q in inp["checking_questions"]]

    task = lesson.get("main_task") or {}
    if task and 4 in stages:
        s = stages[4]
        s["name"] = f"Main task: {task.get('name', s['name'])}"
        s["purpose"] = task.get("outcome", s["purpose"])
        if task.get("teacher_steps"):
            s["teacher_does"] = task["teacher_steps"]
        if task.get("learner_steps"):
            s["learners_do"] = task["learner_steps"]
        if task.get("why_language_is_needed"):
            s["language_focus"] = task["why_language_is_needed"]
        d = task.get("differentiation") or {}
        if d:
            s["differentiation"] = [f"Less confident: {d.get('less_confident','')}",
                                    f"More confident: {d.get('more_confident','')}",
                                    f"Mixed group: {d.get('mixed','')}"]

    pkg["grounded"] = {
        "brief": lesson.get("subject_brief", []),
        "misconceptions": lesson.get("misconceptions", []),
        "gaps": lesson.get("gaps", []),
        "sources": evidence["sources"],
        "searched": evidence["searched"],
        "usable": evidence["usable"],
    }
    pkg["worksheet"] = artefacts.get("worksheet")
    pkg["answer_key"] = artefacts.get("answer_key", [])
    pkg["glossary"] = artefacts.get("glossary", [])
    pkg["teacher_script"] = artefacts.get("teacher_script", [])
    pkg["verification"] = audit
    pkg["generation"] = {
        "mode": "grounded",
        "write_model": WRITE_MODEL,
        "verify_model": VERIFY_MODEL,
        "note": f"Subject content written from {evidence['usable']} retrieved sources and audited "
                f"by a second pass. Claims carry source numbers. Anything the audit could not "
                f"confirm is flagged rather than hidden.",
    }
    return pkg
