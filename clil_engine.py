"""
clil_engine.py — the structural core of the CLIL Lesson Lab.

This module assembles a CLIL Lesson Package from teacher inputs using
deterministic, rules-based scaffolding. It is intentionally the ONLY place
where pedagogical structure is decided, so the structure can be reviewed,
tested and versioned independently of the interface.

The AI layer plugs in at exactly one place: `enrich_with_model()` at the
bottom of this file. Everything else runs without a model, which means the
package structure is guaranteed to be complete even if generation fails.

Framework references used for structure (public, institutional sources):
  - Coyle's 4Cs and the language of / for / through learning distinction
    (Coyle, Hood and Marsh, Cambridge University Press).
  - CEFR levels and descriptors, Council of Europe Companion Volume:
    https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors
  - European Framework for CLIL Teacher Education, European Centre for
    Modern Languages: https://www.ecml.at/en/Resources/ECML-resources/ID/35
  - EU multilingualism policy, European Commission:
    https://education.ec.europa.eu/focus-topics/improving-quality/multilingualism/about-multilingualism-policy

No third-party course material is reproduced in this file.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

SCHEMA_VERSION = "0.1.0-skeleton"

# ---------------------------------------------------------------------------
# Learner group bands. Grade first, level second — content leads in CLIL.
# ---------------------------------------------------------------------------

LEARNER_GROUPS: list[dict[str, str]] = [
    {"id": "early_primary", "label": "Early primary (ages 5 to 7)"},
    {"id": "primary", "label": "Primary (ages 8 to 11)"},
    {"id": "lower_secondary", "label": "Lower secondary (ages 11 to 14)"},
    {"id": "upper_secondary", "label": "Upper secondary (ages 14 to 18)"},
    {"id": "college", "label": "College or university"},
    {"id": "adult_general", "label": "Adults, general interest"},
    {"id": "adult_professional", "label": "Adults, professional or vocational"},
]

# Bloom's revised taxonomy, filtered so the cognitive demand suits the band.
BLOOM_LADDER: dict[str, list[str]] = {
    "early_primary": ["Remember", "Understand", "Apply"],
    "primary": ["Remember", "Understand", "Apply", "Analyse"],
    "lower_secondary": ["Understand", "Apply", "Analyse", "Evaluate"],
    "upper_secondary": ["Understand", "Apply", "Analyse", "Evaluate", "Create"],
    "college": ["Apply", "Analyse", "Evaluate", "Create"],
    "adult_general": ["Understand", "Apply", "Analyse", "Evaluate"],
    "adult_professional": ["Apply", "Analyse", "Evaluate", "Create"],
}

BLOOM_VERBS: dict[str, list[str]] = {
    "Remember": ["name", "label", "list", "match", "recall", "locate"],
    "Understand": ["describe", "explain", "summarise", "classify", "give an example of"],
    "Apply": ["use", "demonstrate", "solve", "carry out", "measure", "model"],
    "Analyse": ["compare", "sort", "distinguish", "sequence", "identify causes of"],
    "Evaluate": ["judge", "justify", "prioritise", "critique", "recommend"],
    "Create": ["design", "plan", "construct", "propose", "produce"],
}

# ---------------------------------------------------------------------------
# Language support. Plain-language first, CEFR shown quietly alongside.
# ---------------------------------------------------------------------------

SUPPORT_LEVELS: list[dict[str, Any]] = [
    {
        "id": "beginner",
        "label": "New to the language",
        "cefr": "around pre-A1 to A1",
        "text_load": "Up to 40 words of new text, always with images",
        "chunk": "Single words and two-word phrases",
        "l1": "Use the first language freely for thinking and checking",
        "frames": 2,
    },
    {
        "id": "heavy_support",
        "label": "Can follow with heavy support",
        "cefr": "around A1 to A2",
        "text_load": "Up to 100 words of new text, chunked into short sections",
        "chunk": "Short fixed sentences from a model",
        "l1": "First language allowed for planning, target language for the report",
        "frames": 4,
    },
    {
        "id": "some_support",
        "label": "Can follow with some support",
        "cefr": "around A2 to B1",
        "text_load": "Up to 250 words of new text with a glossary",
        "chunk": "Full sentences, joined with simple connectives",
        "l1": "First language for clarifying only",
        "frames": 5,
    },
    {
        "id": "largely_independent",
        "label": "Largely independent",
        "cefr": "around B1 to B2 and above",
        "text_load": "Authentic or lightly adapted text",
        "chunk": "Extended turns and short written paragraphs",
        "l1": "Target language throughout, first language as a personal strategy",
        "frames": 3,
    },
    {
        "id": "not_sure",
        "label": "I am not sure yet",
        "cefr": "assumed around A1 to A2 until you tell us otherwise",
        "text_load": "Up to 100 words of new text, chunked into short sections",
        "chunk": "Short fixed sentences from a model",
        "l1": "First language allowed for planning, target language for the report",
        "frames": 4,
    },
]

PURPOSES: list[dict[str, str]] = [
    {"id": "curriculum", "label": "Required by the curriculum"},
    {"id": "exam", "label": "Exam or assessment preparation"},
    {"id": "university", "label": "Preparation for study in the target language"},
    {"id": "professional", "label": "Workplace or professional need"},
    {"id": "settlement", "label": "Living in a new country"},
    {"id": "interest", "label": "Personal interest or enrichment"},
]

TEACHER_ROLES: list[dict[str, str]] = [
    {"id": "language", "label": "Language teacher"},
    {"id": "content", "label": "Subject or content teacher"},
    {"id": "both", "label": "Both, I teach the subject and the language"},
]

SETTINGS = [
    {"id": "online", "label": "Online"},
    {"id": "in_person", "label": "In person"},
    {"id": "hybrid", "label": "Hybrid"},
]

FORMATS = [
    {"id": "group", "label": "Group class"},
    {"id": "one_to_one", "label": "One to one"},
]


def _support(level_id: str) -> dict[str, Any]:
    for lvl in SUPPORT_LEVELS:
        if lvl["id"] == level_id:
            return lvl
    return SUPPORT_LEVELS[4]


def _label(collection: list[dict[str, str]], item_id: str, fallback: str = "") -> str:
    for item in collection:
        if item["id"] == item_id:
            return item["label"]
    return fallback or item_id


# ---------------------------------------------------------------------------
# Timing. A CLIL lesson needs its scaffold protected, so timing is a share of
# the total rather than a fixed number of minutes.
# ---------------------------------------------------------------------------

TIME_SHARES = [
    ("Bridge back", 0.10),
    ("Pre-task scaffold", 0.20),
    ("Content input", 0.20),
    ("Main task", 0.35),
    ("Report and check", 0.15),
]


def _timings(minutes: int) -> list[dict[str, Any]]:
    out, running = [], 0
    for i, (stage, share) in enumerate(TIME_SHARES):
        if i == len(TIME_SHARES) - 1:
            span = max(1, minutes - running)
        else:
            span = max(1, round(minutes * share))
            running += span
        out.append({"stage": stage, "minutes": span})
    return out


# ---------------------------------------------------------------------------
# The blind-spot compensation layer. This is the part of the product that
# adapts to who the teacher is, rather than only to who the learners are.
# ---------------------------------------------------------------------------

def _compensation(role: str, subject: str, topic: str, target_language: str) -> dict[str, Any]:
    subject = subject or "the subject"
    topic = topic or "this topic"

    content_support = {
        "heading": "Subject accuracy support",
        "why": f"Your training is in language teaching, so this covers the {subject} knowledge behind {topic}.",
        "items": [
            f"State the {subject} idea in one sentence you could defend to a specialist. If you cannot, the lesson is not ready.",
            f"Name the two or three common misconceptions about {topic}, and how the task will surface them.",
            "Check every figure, date, name, unit and process against a source you can name.",
            f"Confirm where {topic} sits in the subject curriculum, so this builds on what learners met in their first language.",
            "Ask a subject colleague to read the content objective and the input section only. Five minutes, most of the risk gone.",
        ],
    }

    language_support = {
        "heading": "Language demand support",
        "why": f"Your training is in the subject, so this makes the {target_language or 'target language'} demand visible.",
        "items": [
            "Read the task aloud and mark every unfamiliar word. More than about eight means pre-teach or reduce.",
            "Separate the language needed to understand the input from the language needed to produce the task. Support both.",
            "Give learners the exact sentence patterns the task requires. They will not find them alone.",
            "Decide when the first language is allowed, and tell learners. Silence on this creates anxiety.",
            "Ask a language colleague whether the task is possible with the language you supplied.",
        ],
    }

    if role == "language":
        blocks = [content_support]
    elif role == "content":
        blocks = [language_support]
    else:
        blocks = [
            {
                "heading": "Dual-role balance check",
                "why": "You teach both, so the risk is not missing knowledge. It is one side taking over.",
                "items": [
                    "Read your two objectives side by side. Could a learner meet one and fail the other?",
                    f"Is the {target_language or 'target language'} carrying the {subject} learning, or competing with it?",
                    "Check that assessment credits subject understanding even when the language is imperfect.",
                    "Check your talking time. In a dual-role lesson it grows unnoticed.",
                ],
            }
        ]
    return {"blocks": blocks}


# ---------------------------------------------------------------------------
# Objectives
# ---------------------------------------------------------------------------

def _objectives(group: str, subject: str, topic: str, support: dict[str, Any],
                bloom_choice: str | None) -> dict[str, Any]:
    ladder = BLOOM_LADDER.get(group, BLOOM_LADDER["lower_secondary"])
    level = bloom_choice if bloom_choice in ladder else ladder[len(ladder) // 2]
    verbs = BLOOM_VERBS[level]
    subject = subject or "the subject"
    topic = topic or "this topic"

    return {
        "bloom_level": level,
        "bloom_available": ladder,
        "content": [
            {
                "bloom": level,
                "text": f"By the end of the lesson, learners will be able to {verbs[0]} {topic} in {subject}.",
                "note": "Replace with the precise subject outcome. Keep the verb.",
            },
            {
                "bloom": ladder[0],
                "text": f"Learners will be able to {BLOOM_VERBS[ladder[0]][0]} the key terms of {topic}.",
                "note": "A lower-demand objective gives every learner a way in.",

            },
        ],
        "language": [
            {
                "strand": "Language of learning",
                "text": f"The vocabulary and structures learners need in order to understand {topic}.",
                "note": "Key subject terms, plus the grammar the input uses.",
            },
            {
                "strand": "Language for learning",
                "text": f"Learners will be able to use {support['chunk'].lower()} to take part in the task.",
                "note": "Classroom language: asking, agreeing, checking, reporting.",
            },
            {
                "strand": "Language through learning",
                "text": "Language that emerges during the task and is captured afterwards.",
                "note": "Leave open. Record what actually came up.",
            },
        ],
        "learning_skill": (
            "Learners will work with a partner or group and report a shared answer."
            if True else ""
        ),
    }


# ---------------------------------------------------------------------------
# Package assembly
# ---------------------------------------------------------------------------

def build_package(payload: dict[str, Any]) -> dict[str, Any]:
    """Assemble a complete CLIL Lesson Package from teacher input."""

    g = payload.get
    group = g("learner_group") or "lower_secondary"
    support = _support(g("support_level") or "not_sure")
    subject = (g("subject") or "").strip()
    topic = (g("topic") or "").strip()
    target_language = (g("target_language") or "English").strip()
    first_language = (g("first_language") or "").strip()
    role = g("teacher_role") or "both"
    minutes = int(g("minutes") or 45)
    setting = g("setting") or "online"
    fmt = g("format") or "group"
    mode = g("mode") or "one_off"          # "course" or "one_off"
    reflection = g("reflection") or {}
    prior = (g("prior_lesson") or "").strip()
    next_topic = (g("next_topic") or "").strip()

    solo = fmt == "one_to_one"

    # --- sequence bridge -------------------------------------------------
    carried: list[str] = []
    if prior:
        carried.append(f"Last lesson covered: {prior}.")
    if reflection.get("content_outcome") == "partly":
        carried.append("Content objective only partly met, so this lesson re-opens it before adding anything new.")
    elif reflection.get("content_outcome") == "not_yet":
        carried.append("Content objective not met, so this lesson re-teaches it rather than moving on.")
    if reflection.get("language_outcome") in ("partly", "not_yet"):
        carried.append("Language objective not fully met, so the frames below are repeated rather than replaced.")
    if reflection.get("struggle"):
        carried.append(f"Learners struggled with {reflection['struggle']}, so the pre-task scaffold targets it.")
    if reflection.get("enjoyed"):
        carried.append(f"Learners responded well to {reflection['enjoyed']}, so the main task keeps it.")
    if reflection.get("cut"):
        carried.append(f"You ran out of time for {reflection['cut']}, so it comes early here.")
    if not carried:
        carried.append(
            "Standalone lesson, so the bridge activates general prior knowledge rather than a specific previous lesson."
            if mode == "one_off" else
            "No reflection recorded, so the bridge activates general prior knowledge."
        )

    # --- package ---------------------------------------------------------
    package: dict[str, Any] = {
        "id": uuid.uuid4().hex[:12],
        "schema_version": SCHEMA_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": mode,
        "header": {
            "title": topic or "Untitled lesson",
            "subject": subject or "Subject not stated",
            "course_name": g("course_name") or "",
            "lesson_number": g("lesson_number") or None,
            "lesson_total": g("lesson_total") or None,
            "learner_group": _label(LEARNER_GROUPS, group),
            "purpose": _label(PURPOSES, g("purpose") or "curriculum"),
            "target_language": target_language,
            "first_language": first_language or "not stated",
            "support_label": support["label"],
            "support_cefr": support["cefr"],
            "setting": _label(SETTINGS, setting),
            "format": _label(FORMATS, fmt),
            "minutes": minutes,
            "teacher_role": _label(TEACHER_ROLES, role),
        },
        "sequence": {
            "heading": "Where this lesson sits",
            "carried_forward": carried,
            "position": (
                f"Lesson {g('lesson_number')} of {g('lesson_total')}"
                if g("lesson_number") and g("lesson_total") else
                ("Part of a course" if mode == "course" else "Standalone lesson")
            ),
        },
        "objectives": _objectives(group, subject, topic, support, g("bloom_level")),
        "timings": _timings(minutes),
        "stages": [],
        "language_bank": {
            "heading": "Language support bank",
            "text_load": support["text_load"],
            "first_language_policy": support["l1"],
            "functions": [
                "Describing what something is and what it does",
                "Comparing two things",
                "Giving a reason",
                "Checking understanding with a partner",
                "Reporting a group answer",
            ],
            "frames": [
                "This is a ___ because ___.",
                "One difference between ___ and ___ is ___.",
                "We think ___ because ___.",
                "Can you say that again, please?",
                "Our group decided ___.",
            ][: support["frames"]],
            "vocabulary_note": (
                f"List six to eight key {subject or 'subject'} terms, each with an image or first-language "
                "gloss. Never more than eight new terms in one lesson."
            ),
        },
        "materials": [
            "One visual for the key subject idea, such as a diagram, photograph or short clip",
            "Printed or on-screen sentence frames, visible for the whole lesson",
            f"A short text or input source of about the length noted above ({support['text_load'].lower()})",
            "A simple recording sheet or shared document for the task outcome",
            ("A breakout room plan or turn-taking order" if not solo and setting != "in_person"
             else "A seating or grouping plan"),
        ],
        "compensation": _compensation(role, subject, topic, target_language),
        "looking_ahead": {
            "heading": "Looking ahead",
            "next_topic": next_topic,
            "items": [
                (f"Next lesson: {next_topic}. Say this to learners at the end so the sequence is visible."
                 if next_topic else
                 "Name the next lesson before learners leave. It frames what they just did as part of something larger."),
                "Carry the language that emerged into the next lesson. That is the through-learning strand.",
                "Note anything you cut. It opens the next bridge.",
            ],
            "reflection_prompt": "Two minutes on the reflection form changes the next package.",
        },
        "review_checklist": {
            "heading": "Before you teach, check with a colleague",
            "groups": [
                {
                    "label": "Subject accuracy",
                    "items": [
                        "Is every subject claim correct and current for my curriculum?",
                        "Would a specialist accept the content objective as written?",
                    ],
                },
                {
                    "label": "Policy and curriculum",
                    "items": [
                        "Does this topic sit within what my school, curriculum authority and national policy permit?",
                        "Does the language of instruction match what my institution requires?",
                        "Can I credit subject understanding separately from language accuracy under my assessment policy?",
                    ],
                },
                {
                    "label": "Culture, representation and sensitivity",
                    "items": [
                        "Is this topic sensitive for any learner or family in this group?",
                        "Whose perspective does the content assume, and whose is missing?",
                        "Do the examples, names and images reflect my learners?",
                        "Could anything here read as a political or religious position?",
                    ],
                },
                {
                    "label": "Access",
                    "items": [
                        "Can the least confident learner still enter the task?",
                        "Is there a route through this for a learner who joins late or misses the input?",
                    ],
                },
            ],
        },
        "disclaimer": {
            "heading": "Please read before you teach",
            "body": [
                "A planning draft, not an approved lesson. Assembled from what you supplied plus general CLIL structure. Not checked against your curriculum, your institution's policies or your learners' circumstances.",
                "You are the qualified professional. Verify subject accuracy with a colleague, confirm policy with your school, and judge cultural fit for your learners yourself.",
                "CLIL Lesson Lab accepts no liability for subject accuracy, policy or contractual compliance, assessment validity, or cultural appropriateness. Material you supply, including its copyright, remains your responsibility.",
            ],
            "sources": [
                {"label": "CEFR levels and descriptors, Council of Europe",
                 "url": "https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors"},
                {"label": "European Framework for CLIL Teacher Education, ECML",
                 "url": "https://www.ecml.at/en/Resources/ECML-resources/ID/35"},
                {"label": "Multilingualism policy, European Commission",
                 "url": "https://education.ec.europa.eu/focus-topics/improving-quality/multilingualism/about-multilingualism-policy"},
            ],
        },
    }

    package["stages"] = _stages(package, solo, setting, support, subject, topic, minutes)
    return package


def _stages(pkg: dict[str, Any], solo: bool, setting: str, support: dict[str, Any],
            subject: str, topic: str, minutes: int) -> list[dict[str, Any]]:
    t = {row["stage"]: row["minutes"] for row in pkg["timings"]}
    subject = subject or "the subject"
    topic = topic or "the topic"
    online = setting in ("online", "hybrid")

    def interaction(group_text: str, solo_text: str) -> str:
        return solo_text if solo else group_text

    return [
        {
            "number": 1,
            "name": "Bridge back",
            "minutes": t["Bridge back"],
            "purpose": "Make the link to prior learning explicit, so this lesson is felt as part of a sequence.",
            "teacher_does": [
                "Show one image or object from the previous lesson and ask learners what they remember.",
                "Record two or three remembered terms where everyone can see them.",
                "Say in one sentence how today follows on.",
            ],
            "learners_do": [
                interaction("In pairs, recall two things from last time before anyone answers aloud.",
                            "Recall two things from last time, with thinking time before answering."),
                "Add one term to the shared list.",
            ],
            "language_focus": "Recall and naming. Accept the first language here if it speeds up retrieval.",
            "watch_for": "Do not let this become a full review lesson. It is a doorway, not a room.",
        },
        {
            "number": 2,
            "name": "Pre-task scaffold",
            "minutes": t["Pre-task scaffold"],
            "purpose": "Remove the language barrier before the content arrives, not during it.",
            "teacher_does": [
                f"Pre-teach no more than eight key {subject} terms, each with a visual or a first-language gloss.",
                "Display the sentence frames from the language bank and model one aloud.",
                "Check understanding with a quick non-verbal response, such as pointing, holding up fingers or matching.",
            ],
            "learners_do": [
                interaction("Match terms to images with a partner, then compare with another pair.",
                            "Match terms to images, then explain one match to the teacher."),
                "Say one frame aloud once, so the first use is not during the task.",
            ],
            "language_focus": f"Language of learning. {support['text_load']}.",
            "watch_for": "If learners cannot use a frame here, they will not use it in the task. Slow down rather than continue.",
        },
        {
            "number": 3,
            "name": "Content input",
            "minutes": t["Content input"],
            "purpose": "Deliver the subject content in a form learners can actually access.",
            "teacher_does": [
                f"Present the core {subject} idea about {topic} using a visual first and words second.",
                "Chunk the input. Stop after each chunk and ask one checking question.",
                ("Share your screen and annotate as you go, so learners see the idea being built."
                 if online else "Build the idea on the board so learners see it develop, not finished."),
                "Name the misconception you expect and address it openly.",
            ],
            "learners_do": [
                "Complete a partly finished organiser, diagram or table while listening.",
                interaction("Compare organisers with a partner and fix gaps before moving on.",
                            "Compare the organiser with the teacher's version and fix gaps."),
            ],
            "language_focus": "Receptive. Learners need to understand, not yet to produce.",
            "watch_for": "Long unbroken teacher talk is the most common failure point in CLIL input. Chunk it.",
        },
        {
            "number": 4,
            "name": "Main task",
            "minutes": t["Main task"],
            "purpose": "Learners use the subject content to reach an outcome, and need the language to do it.",
            "teacher_does": [
                "Give the task outcome first, then the instructions. Learners need to know what they are producing.",
                "Model the first step with one learner or pair, then withdraw.",
                ("Move between breakout rooms and listen without correcting immediately."
                 if online and not solo else "Circulate and listen without correcting immediately."),
                "Note language that emerges. This becomes the language through learning record.",
            ],
            "learners_do": [
                interaction(
                    f"In small groups, use the {subject} content to solve, sort, decide, investigate or design something about {topic}, and agree one answer to report.",
                    f"Work with the teacher to solve, sort, decide or design something about {topic}, with the teacher holding information the learner needs and must ask for.",
                ),
                "Use the frames to negotiate, disagree and check with each other.",
                "Prepare a short report of the outcome.",
            ],
            "language_focus": "Language for learning. Interaction, negotiation and reporting.",
            "watch_for": (
                "In a one-to-one lesson, do not simply remove interaction. Create a genuine information gap so the learner has a reason to ask."
                if solo else
                "If groups fall silent, the language support is missing, not the motivation."
            ),
            "differentiation": [
                "Less confident: give a completed example and let them adapt it.",
                "More confident: remove one frame, or ask for a justification as well as an answer.",
                "Very mixed group: assign roles so every learner has a defined turn.",
            ],
        },
        {
            "number": 5,
            "name": "Report and check",
            "minutes": t["Report and check"],
            "purpose": "Make learning visible, and gather evidence against both objectives separately.",
            "teacher_does": [
                interaction("Take one report per group, holding others to listening with a specific question.",
                            "Ask the learner to report the outcome as if to a third person."),
                "Give one piece of content feedback and one piece of language feedback, clearly labelled as such.",
                "Record who met the content objective and who met the language objective. They are not the same list.",
            ],
            "learners_do": [
                "Report the outcome using the frames.",
                "Complete a one-question exit check on the content, answerable in the first language if needed.",
            ],
            "language_focus": "Language through learning. Capture what emerged and reuse it next lesson.",
            "watch_for": "Judging content understanding through language accuracy is the classic CLIL assessment error. Separate them.",
            "evidence": [
                "Content evidence: the exit check and the correctness of the task outcome.",
                "Language evidence: use of the target frames during the task and the report.",
            ],
        },
    ]


# ---------------------------------------------------------------------------
# AI plug-in point.
# ---------------------------------------------------------------------------

def enrich_with_model(package: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    """Single insertion point for the generative layer.

    In the skeleton this is a no-op. When the model layer is added, it should
    fill in subject-specific detail INSIDE the existing structure and never
    change the structure itself. Suggested responsibilities, in order:

      1. Rewrite objective placeholders with real subject outcomes.
      2. Replace generic vocabulary and frames with topic-specific ones.
      3. Draft the concrete main task, with a named outcome.
      4. Name real, sourced misconceptions for the subject accuracy block.
      5. Add citations for every factual claim it introduces.

    Anything the model cannot ground in a source must be flagged to the
    teacher rather than asserted.
    """
    package["generation"] = {
        "mode": "structural skeleton",
        "note": "Structure generated. Subject detail left as guided placeholders for you to complete.",
    }
    return package


def generate(payload: dict[str, Any]) -> dict[str, Any]:
    return enrich_with_model(build_package(payload), payload)


OPTIONS = {
    "learner_groups": LEARNER_GROUPS,
    "support_levels": SUPPORT_LEVELS,
    "purposes": PURPOSES,
    "teacher_roles": TEACHER_ROLES,
    "settings": SETTINGS,
    "formats": FORMATS,
    "bloom": BLOOM_LADDER,
}
