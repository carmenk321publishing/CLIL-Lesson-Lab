"""
grounding.py — retrieve real subject sources before anything is generated.

The rule this file exists to enforce: the model never writes subject content
from memory. It writes from text that was fetched from a named source, and
every factual claim carries the index of the source it came from.

Retrieval is deliberately biased towards institutional and open-access
material: government health bodies, university and open textbooks,
peer-reviewed literature and education-research journals. Commercial blogs and
content farms are excluded, because a teacher cannot defend them to a
department head.
"""

from __future__ import annotations

import re
from typing import Any

import pplx_sdk

# Domains a teacher can cite without apologising for the source.
PREFERRED_DOMAINS = [
    "ncbi.nlm.nih.gov",
    "pmc.ncbi.nlm.nih.gov",
    "pubmed.ncbi.nlm.nih.gov",
    "nature.com",
    "libretexts.org",
    "coe.int",
    "ecml.at",
    "europa.eu",
    "unesco.org",
    "oecd.org",
    "who.int",
    "journals.physiology.org",
    "royalsociety.org",
    "britannica.com",
]

BLOCKED_PATTERNS = re.compile(
    r"(scribd|pinterest|quizlet|coursehero|studocu|chegg|blogspot|medium\.com|"
    r"teacherspayteachers|wikihow|answers\.com|sci-hub)",
    re.I,
)

# Queries that reliably surface the two things a CLIL lesson needs: the
# subject explanation, and what learners typically get wrong about it.
QUERY_SHAPES = [
    "{topic} {subject} explanation",
    "{topic} mechanism physiology process",
    "{topic} figures values units",
    "common student misconceptions {topic}",
    "misconceptions teaching {subject} {topic} education research",
]


def _clean(hits: list[Any]) -> list[Any]:
    seen, out = set(), []
    for h in hits:
        if BLOCKED_PATTERNS.search(h.url or ""):
            continue
        domain = (h.domain or "").lower()
        if domain in seen:
            continue
        seen.add(domain)
        out.append(h)
    return out


def _rank(hits: list[Any]) -> list[Any]:
    def score(h: Any) -> int:
        d = (h.domain or "").lower()
        if any(p in d for p in PREFERRED_DOMAINS):
            return 0
        if d.endswith((".gov", ".edu", ".ac.uk", ".int")):
            return 1
        if d.endswith(".org"):
            return 2
        return 3

    return sorted(hits, key=score)


def find_sources(subject: str, topic: str, *, limit: int = 6) -> list[dict[str, Any]]:
    """Search for citable sources on the subject content of this lesson."""
    queries = [q.format(subject=subject, topic=topic) for q in QUERY_SHAPES]
    results = pplx_sdk.search.web_by_query(queries)
    pooled: list[Any] = []
    for hits in results.values():
        pooled.extend(hits[:6])
    ranked = _rank(_clean(pooled))[:limit]
    return [
        {"title": h.title, "url": h.url, "publisher": h.domain, "snippet": h.snippet}
        for h in ranked
    ]


def read_sources(sources: list[dict[str, Any]], subject: str, topic: str) -> list[dict[str, Any]]:
    """Fetch each source and extract only what this lesson needs from it.

    Extraction happens at fetch time so the generation prompt receives dense,
    relevant text rather than whole pages, which keeps both accuracy and token
    cost under control.
    """
    prompt = (
        f"From this page, extract only material useful for teaching '{topic}' in {subject} "
        f"to school or college learners. Include: the mechanism or explanation, any specific "
        f"figures with units, and any stated student misconceptions. If the page contains "
        f"nothing useful for this, say exactly: NOTHING USEFUL."
    )
    fetched = pplx_sdk.content.fetch([s["url"] for s in sources], prompt=prompt)
    by_url = {f.url: f for f in fetched}

    out = []
    for index, source in enumerate(sources, start=1):
        page = by_url.get(source["url"])
        text = (getattr(page, "content", "") or "").strip()
        if not text or "NOTHING USEFUL" in text[:200].upper():
            continue
        out.append({
            "index": len(out) + 1,
            "title": (getattr(page, "title", None) or source["title"] or "").strip(),
            "url": source["url"],
            "publisher": source["publisher"],
            "published": getattr(page, "published_date", None),
            "extract": text[:6000],
        })
    return out


def build_evidence(subject: str, topic: str, *, limit: int = 6) -> dict[str, Any]:
    """The full grounding step. Returns sources plus the text the model may use."""
    found = find_sources(subject, topic, limit=limit)
    read = read_sources(found, subject, topic)
    return {
        "subject": subject,
        "topic": topic,
        "searched": len(found),
        "usable": len(read),
        "sources": [
            {"index": s["index"], "title": s["title"], "url": s["url"],
             "publisher": s["publisher"], "published": s["published"]}
            for s in read
        ],
        "corpus": "\n\n".join(
            f"[SOURCE {s['index']}] {s['title']} ({s['publisher']}) {s['url']}\n{s['extract']}"
            for s in read
        ),
    }
