"""
clil_reports.py — course-level updates built from lessons and reflections.

Two audiences, two documents, deliberately different:

  build_newsletter()  Families and guardians, or adult learners themselves.
                      Reassuring, plain, short. Addresses the classic CLIL
                      worry that learning through another language slows the
                      subject down.

  build_briefing()    Internal staff: principal, academic manager, co-teacher.
                      Candid about struggles, specific about support needed,
                      and honest about what is still unchecked.

Privacy rule, enforced by design, not by policy text: neither document ever
asks for or stores a learner's name. Where named detail belongs, the briefing
produces a labelled blank for the teacher to complete on their own device.
Both are drafts. The teacher edits every section before it goes anywhere.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

CADENCES = [
    {"id": "bimonthly", "label": "Every two months", "days": 61},
    {"id": "monthly", "label": "Monthly", "days": 30},
    {"id": "termly", "label": "Once a term", "days": 120},
    {"id": "manual", "label": "Only when I ask", "days": 0},
]

DOC_KINDS = [
    {"id": "newsletter", "label": "Family newsletter"},
    {"id": "briefing", "label": "Staff one-pager"},
]


def _plain(objective: str, subject: str = "") -> str:
    """Turn an objective written for a plan into something a family can read."""
    text = objective.strip()
    for prefix in (
        "By the end of the lesson, learners will be able to ",
        "Learners will be able to ",
    ):
        if text.startswith(prefix):
            text = text[len(prefix):]
            break
    if subject:
        tail = f" in {subject}."
        if text.lower().endswith(tail.lower()):
            text = text[: -len(tail)] + "."
    return text[0].lower() + text[1:] if text else text


def _section(heading: str, body: list[str], *, hint: str = "", locked: bool = False) -> dict[str, Any]:
    """A section is editable unless locked. Locked sections carry legal or
    privacy meaning, so the teacher can remove them but not silently rewrite
    them into something misleading."""
    return {
        "id": uuid.uuid4().hex[:8],
        "heading": heading,
        "body": [b for b in body if b],
        "hint": hint,
        "locked": locked,
        "editable": not locked,
    }


def _harvest(lessons: list[dict[str, Any]]) -> dict[str, Any]:
    """Pull the reportable facts out of a course's lessons and reflections."""
    topics, content_obj, lang_obj, frames = [], [], [], []
    enjoyed, struggles, cut, carried = [], [], [], []
    met_content = partly_content = not_content = 0
    met_lang = partly_lang = not_lang = 0
    next_topics = []

    for entry in lessons:
        pkg = entry.get("package") or {}
        h = pkg.get("header") or {}
        if h.get("title"):
            topics.append(h["title"])
        obj = pkg.get("objectives") or {}
        for o in obj.get("content", [])[:1]:
            content_obj.append(o.get("text", ""))
        for o in obj.get("language", []):
            if o.get("strand") == "Language for learning":
                lang_obj.append(o.get("text", ""))
        frames += (pkg.get("language_bank") or {}).get("frames", [])
        nt = (pkg.get("looking_ahead") or {}).get("next_topic")
        if nt:
            next_topics.append(nt)

        r = entry.get("reflection") or {}
        if r.get("enjoyed"):
            enjoyed.append(r["enjoyed"])
        if r.get("struggle"):
            struggles.append(r["struggle"])
        if r.get("cut"):
            cut.append(r["cut"])
        if r.get("carry"):
            carried.append(r["carry"])
        c, l = r.get("content_outcome"), r.get("language_outcome")
        met_content += c == "met"
        partly_content += c == "partly"
        not_content += c == "not_yet"
        met_lang += l == "met"
        partly_lang += l == "partly"
        not_lang += l == "not_yet"

    def dedupe(seq: list[str]) -> list[str]:
        seen, out = set(), []
        for s in seq:
            key = s.strip().lower()
            if s.strip() and key not in seen:
                seen.add(key)
                out.append(s.strip())
        return out

    reflected = sum(1 for e in lessons if e.get("reflection"))
    return {
        "count": len(lessons),
        "reflected": reflected,
        "topics": dedupe(topics),
        "content_obj": dedupe(content_obj),
        "lang_obj": dedupe(lang_obj),
        "frames": dedupe(frames)[:5],
        "enjoyed": dedupe(enjoyed),
        "struggles": dedupe(struggles),
        "cut": dedupe(cut),
        "carried": dedupe(carried),
        "next_topics": dedupe(next_topics),
        "content_tally": (met_content, partly_content, not_content),
        "lang_tally": (met_lang, partly_lang, not_lang),
    }


def _period(lessons: list[dict[str, Any]]) -> str:
    dates = [e.get("created_at") for e in lessons if e.get("created_at")]
    if not dates:
        return date.today().strftime("%d %B %Y")

    def fmt(raw: str) -> str:
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "")).strftime("%d %B %Y")
        except ValueError:
            return str(raw)[:10]

    first, last = fmt(min(dates)), fmt(max(dates))
    return first if first == last else f"{first} to {last}"


# ---------------------------------------------------------------------------
# Family newsletter
# ---------------------------------------------------------------------------

def build_newsletter(course: dict[str, Any], lessons: list[dict[str, Any]],
                     profile: dict[str, Any] | None = None) -> dict[str, Any]:
    profile = profile or {}
    d = _harvest(lessons)
    subject = course.get("subject") or "the subject"
    lang = course.get("target_language") or "the target language"
    adult = (course.get("learner_group") or "").startswith("adult") or course.get("learner_group") == "college"
    who = "you" if adult else "your child"
    whose = "your" if adult else "your child's"

    sections = [
        _section(
            "What we have been learning",
            [f"Over this period we covered {len(d['topics'])} topics in {subject}:" if d["topics"] else
             f"We have been working on {subject} through {lang}."]
            + [f"• {t}" for t in d["topics"][:8]],
            hint="Cut anything families do not need. Two or three topics usually lands better than eight.",
        ),
        _section(
            f"What {who} can now do",
            ([f"In {subject}: {_plain(o, subject)}" for o in d["content_obj"][:3]] or
             [f"In {subject}: add one or two things learners can now do."])
            + ([f"In {lang}: {_plain(o)}" for o in d["lang_obj"][:2]] or
               [f"In {lang}: add what learners can now say or write."]),
            hint="Say what learners can do, not what was covered. Families read this part most closely.",
        ),
        _section(
            "What went well",
            ([f"Learners responded especially well to {e}." for e in d["enjoyed"][:3]] or
             ["Add one moment from the last few weeks that you would want a family to hear about."]),
        ),
        _section(
            f"Language {who} may bring home",
            ([f"• {f}" for f in d["frames"]] or ["Add two or three phrases learners have been using."])
            + [f"You do not need to speak {lang} to help. Asking {who} to explain a topic in "
               f"{'your own' if adult else 'the family'} language is genuinely useful."],
            hint="This is the single most useful section for families. Keep it.",
        ),
        _section(
            "How progress works in this kind of course",
            [f"Learning {subject} through {lang} usually starts slower than learning it in a first language, "
             f"and then catches up. Early hesitation is normal and is not a sign that {who} "
             f"{'are' if adult else 'is'} falling behind in {subject}.",
             f"Using {whose} first language to think, check and discuss is encouraged, not discouraged."],
            hint="Written to answer the question families ask most. Adjust the wording, keep the message.",
        ),
        _section(
            "Coming next",
            ([f"• {t}" for t in d["next_topics"][:4]] or
             ["Add the next two or three topics."]),
        ),
        _section(
            "How to reach me",
            ["Add your preferred contact route and when you are available.",
             "Add anything you would like families to do before the next unit."],
        ),
    ]

    return {
        "id": uuid.uuid4().hex[:12],
        "kind": "newsletter",
        "kind_label": "Family newsletter",
        "audience": "Families and guardians" if not adult else "Learners",
        "title": f"{course.get('name') or 'Course'}: course update",
        "period": _period(lessons),
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "from_line": (f"From {profile.get('name')}" if profile.get("name") else "From your teacher")
                     + (f", {profile['institution']}" if profile.get("institution") else ""),
        "meta": [
            ["Course", course.get("name") or ""],
            ["Subject", subject],
            ["Language of learning", lang],
            ["Lessons covered", str(d["count"])],
            ["Period", _period(lessons)],
        ],
        "sections": sections,
        "notice": {
            "heading": "Before you send this",
            "body": [
                "This is a draft assembled from your own lessons and reflections. Read every line before it "
                "leaves your hands.",
                "No learner is named anywhere in it, and this tool never stores learner names. Add any "
                "individual comment on your own device, after you download.",
                "Check it against your school's communication policy. Some schools require newsletters to be "
                "approved, translated, or sent through an official channel.",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Internal staff one-pager
# ---------------------------------------------------------------------------

def build_briefing(course: dict[str, Any], lessons: list[dict[str, Any]],
                   profile: dict[str, Any] | None = None) -> dict[str, Any]:
    profile = profile or {}
    d = _harvest(lessons)
    subject = course.get("subject") or "the subject"
    lang = course.get("target_language") or "the target language"
    mc, pc, nc = d["content_tally"]
    ml, pl, nl = d["lang_tally"]

    def tally(met: int, partly: int, notyet: int, label: str) -> str:
        total = met + partly + notyet
        if not total:
            return f"{label}: not yet recorded across these lessons."
        return (f"{label}: met in {met} of {total} reflected lessons, partly met in {partly}, "
                f"not met in {notyet}.")

    sections = [
        _section(
            "Purpose of this one-pager",
            ["Add one line: what you want the reader to know, decide or approve.",
             "Add who else has seen this."],
            hint="Managers read the first three lines. Put the ask here.",
        ),
        _section(
            "Where the course has reached",
            [f"{d['count']} lessons delivered"
             + (f" of {course.get('lesson_total')} planned" if course.get("lesson_total") else "") + ".",
             f"Reflections recorded for {d['reflected']} of {d['count']} lessons.",
             f"Topics covered: {', '.join(d['topics'][:8])}." if d["topics"] else "",
             f"Delivery: {course.get('setting') or 'not stated'}, {course.get('format') or 'not stated'}."],
        ),
        _section(
            "Progress against objectives",
            [tally(mc, pc, nc, "Content objectives"),
             tally(ml, pl, nl, "Language objectives"),
             "Content and language are tracked separately, so a gap between the two lines is expected and "
             "informative rather than a problem."],
            hint="If the two lines diverge sharply, say what you think is causing it.",
        ),
        _section(
            "Working well",
            ([f"• {e}" for e in d["enjoyed"][:4]] or ["Add what is working, with one piece of evidence."])
            + ([f"• Carried forward deliberately: {c}" for c in d["carried"][:3]]),
        ),
        _section(
            "Where learners are struggling",
            ([f"• {s}" for s in d["struggles"][:5]] or ["Add the recurring difficulty and how often it appears."])
            + ([f"• Repeatedly ran short of time for: {', '.join(d['cut'][:3])}."] if d["cut"] else []),
            hint="Be specific. 'The reading' is more actionable than 'comprehension'.",
        ),
        _section(
            "What I have already tried",
            ["Add the adjustments you made in response, and what changed.",
             "Add anything you decided against, and why."],
            hint="This is what separates a briefing from a complaint.",
        ),
        _section(
            "Support or decisions I am asking for",
            ["Add the specific ask: time, materials, a co-teaching slot, a subject colleague's review, "
             "a timetable change, an assessment adjustment.",
             "Add what happens if it is not possible."],
        ),
        _section(
            "Still unverified",
            ["Subject accuracy: name anything a subject specialist has not yet reviewed.",
             "Policy: name anything you need confirmed against curriculum or institutional policy.",
             "Culture and representation: name anything you want a second opinion on.",
             "Assessment: confirm whether subject understanding can be credited separately from language."],
            hint="Naming open risks early is usually read as competence, not weakness.",
        ),
        _section(
            "Individual learners",
            ["This section is intentionally blank.",
             "Add named learner detail on your own device after downloading, and share it only through your "
             "school's approved channel.",
             "Suggested structure to complete offline: learner, what is working, what is not, what you have "
             "tried, what you are asking for."],
            hint="Do not type learner names into this tool.",
            locked=True,
        ),
        _section(
            "Next period",
            ([f"• {t}" for t in d["next_topics"][:4]] or ["Add the next topics."])
            + ["Add what you will change in how you teach them."],
        ),
    ]

    return {
        "id": uuid.uuid4().hex[:12],
        "kind": "briefing",
        "kind_label": "Staff one-pager",
        "audience": "Principal, academic manager or co-instructor",
        "title": f"{course.get('name') or 'Course'}: internal update",
        "period": _period(lessons),
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "from_line": (f"From {profile.get('name')}" if profile.get("name") else "From the course teacher")
                     + (f", {profile['institution']}" if profile.get("institution") else ""),
        "meta": [
            ["Course", course.get("name") or ""],
            ["Subject", subject],
            ["Language of learning", lang],
            ["Lessons delivered", str(d["count"])],
            ["Reflections recorded", f"{d['reflected']} of {d['count']}"],
            ["Period", _period(lessons)],
        ],
        "sections": sections,
        "notice": {
            "heading": "What this is and is not",
            "body": [
                "An outline built only from what this account already holds: your lesson packages and your "
                "own reflections. It contains no learner names and no personal data, because none is stored.",
                "It is not a performance record, an assessment report, or a safeguarding document. Complete "
                "the individual section on your own device and route it through your school's channel.",
                "Check any reporting requirement or template your institution mandates before sending.",
            ],
        },
    }


BUILDERS = {"newsletter": build_newsletter, "briefing": build_briefing}


def build(kind: str, course: dict[str, Any], lessons: list[dict[str, Any]],
          profile: dict[str, Any] | None = None) -> dict[str, Any]:
    if kind not in BUILDERS:
        raise ValueError(f"Unknown document kind: {kind}")
    return BUILDERS[kind](course, lessons, profile)
