"""In-memory venue index built from the SCImago 2025 CSV.

Loaded once at startup.  Provides area listing, type listing, and
fuzzy search over ~32 K journal / conference titles using *rapidfuzz*.
"""

import csv
import logging
from collections import defaultdict
from pathlib import Path

from rapidfuzz import fuzz, process

logger = logging.getLogger("venue_index")

# ── module-level singletons ─────────────────────────────────────────────────

_all_venues: list[dict] = []
_areas: list[str] = []
# (area, type) → list[dict] sorted by SJR descending
_index: dict[tuple[str, str], list[dict]] = {}

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "scimagojr_2025.csv"


def _parse_sjr(raw: str) -> float | None:
    """Parse SJR values like '104,065' (European decimal) → 104.065."""
    if not raw or raw.strip() == "":
        return None
    try:
        return float(raw.replace(",", "."))
    except ValueError:
        return None


def _parse_int(raw: str) -> int | None:
    if not raw or raw.strip() == "":
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def load_venues() -> None:
    """Parse CSV and build the in-memory index.  Call once from startup."""
    global _all_venues, _areas, _index

    if _all_venues:
        logger.info("Venue index already loaded (%d venues)", len(_all_venues))
        return

    if not CSV_PATH.exists():
        logger.warning("SCImago CSV not found at %s – venue search disabled", CSV_PATH)
        return

    tmp: list[dict] = []
    area_set: set[str] = set()
    idx: dict[tuple[str, str], list[dict]] = defaultdict(list)

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            venue_type = row.get("Type", "").strip()
            areas_raw = row.get("Areas", "").strip()
            if not areas_raw:
                continue

            venue = {
                "sourceid": row.get("Sourceid", "").strip(),
                "title": row.get("Title", "").strip(),
                "type": venue_type,
                "sjr": _parse_sjr(row.get("SJR", "")),
                "sjr_quartile": row.get("SJR Best Quartile", "").strip() or None,
                "h_index": _parse_int(row.get("H index", "")),
                "country": row.get("Country", "").strip() or None,
                "areas": areas_raw,
                "categories": row.get("Categories", "").strip(),
                "publisher": row.get("Publisher", "").strip() or None,
                "open_access": row.get("Open Access", "").strip().lower() == "yes",
            }
            tmp.append(venue)

            for area in areas_raw.split(";"):
                area = area.strip()
                if area:
                    area_set.add(area)
                    idx[(area, venue_type)].append(venue)

    # Sort each bucket by SJR descending (None → bottom)
    for key in idx:
        idx[key].sort(key=lambda v: v["sjr"] if v["sjr"] is not None else -1, reverse=True)

    _all_venues = tmp
    _areas = sorted(area_set)
    _index = dict(idx)

    logger.info("Loaded %d venues into memory (%d areas)", len(_all_venues), len(_areas))


def get_areas() -> list[str]:
    """Return sorted unique area names."""
    return _areas


def get_types_for_area(area: str) -> list[str]:
    """Return venue types available for a given area, sorted alphabetically."""
    types = set()
    for (a, t) in _index:
        if a == area:
            types.add(t)
    return sorted(types)


def search_venues(
    area: str,
    venue_type: str | None = None,
    q: str = "",
    limit: int = 50,
) -> list[dict]:
    """Search venues within an area (and optional type) with fuzzy matching.

    - If *q* is empty, returns top venues by SJR.
    - If *q* is provided, uses rapidfuzz WRatio for typo-tolerant matching.
    """
    # Collect candidates from index
    candidates: list[dict] = []
    if venue_type:
        candidates = _index.get((area, venue_type), [])
    else:
        for (a, t), venues in _index.items():
            if a == area:
                candidates.extend(venues)
        # De-duplicate by sourceid (venues can appear in multiple type buckets)
        seen = set()
        deduped = []
        for v in candidates:
            if v["sourceid"] not in seen:
                seen.add(v["sourceid"])
                deduped.append(v)
        candidates = deduped
        candidates.sort(key=lambda v: v["sjr"] if v["sjr"] is not None else -1, reverse=True)

    if not candidates:
        return []

    if not q or not q.strip():
        return candidates[:limit]

    # Fuzzy search
    titles = [v["title"] for v in candidates]
    matches = process.extract(
        q.strip(),
        titles,
        scorer=fuzz.WRatio,
        limit=min(limit, len(titles)),
        score_cutoff=40,
    )

    results = []
    for title, score, idx in matches:
        venue = candidates[idx]
        results.append({**venue, "_score": score})

    return results
