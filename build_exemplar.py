#!/usr/bin/env python3
"""
build_exemplar.py — produce a published exemplar package.

Retrieval runs here, in the sandbox, where the search library is authenticated.
Generation runs in the web server, where the model credentials live. The two
are deliberately separate processes: retrieval is the step most likely to fail
or be rate limited, and it should not be able to take the web server down.

Usage:
    python build_exemplar.py spec.json out-slug
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request

import grounding

API = "http://localhost:8000/api/generate/grounded"


def main() -> int:
    spec_path, slug = sys.argv[1], sys.argv[2]
    with open(spec_path, encoding="utf-8") as fh:
        spec = json.load(fh)

    # Retrieval is cached per slug, so iterating on prompts does not re-fetch
    # sources and does not make the result depend on search results shifting.
    cache = f"exemplars/_evidence-{slug}.json"
    if os.path.isfile(cache):
        print(f"Reusing cached sources from {cache}")
        with open(cache, encoding="utf-8") as fh:
            evidence = json.load(fh)
    else:
        print(f"Retrieving sources for: {spec['topic']} ({spec['subject']})")
        evidence = grounding.build_evidence(spec["subject"], spec["topic"],
                                            limit=int(spec.get("source_limit", 6)))
        with open(cache, "w", encoding="utf-8") as fh:
            json.dump(evidence, fh, indent=1, ensure_ascii=False)
    print(f"  {evidence['usable']} usable of {evidence['searched']} retrieved")
    for s in evidence["sources"]:
        print(f"  [{s['index']}] {s['publisher']} — {s['title'][:70]}")

    spec["evidence"] = evidence
    request = urllib.request.Request(
        API,
        data=json.dumps(spec).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    print("Generating, auditing and building materials")
    with urllib.request.urlopen(request, timeout=900) as response:
        package = json.loads(response.read())

    out = f"exemplars/{slug}.json"
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(package, fh, indent=1, ensure_ascii=False)
    print(f"Wrote {out} (mode: {package.get('generation', {}).get('mode')})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
