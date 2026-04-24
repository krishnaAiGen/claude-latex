"""Venue lookup endpoints – areas, types, and fuzzy search."""

from fastapi import APIRouter, Query

from app.services.venue_index import get_areas, get_types_for_area, search_venues

router = APIRouter(prefix="/venues", tags=["venues"])


@router.get("/areas")
async def list_areas() -> list[str]:
    """Return the 27 SCImago subject areas, sorted alphabetically."""
    return get_areas()


@router.get("/types")
async def list_types(area: str = Query(..., description="Subject area")) -> list[str]:
    """Return venue types available within an area (e.g. journal, conference)."""
    return get_types_for_area(area)


@router.get("/search")
async def venue_search(
    area: str = Query(..., description="Subject area"),
    type: str | None = Query(None, description="Venue type filter"),
    q: str = Query("", description="Search query (fuzzy)"),
    limit: int = Query(50, ge=1, le=100),
) -> list[dict]:
    """Fuzzy-search venues within an area + optional type.

    Returns top results sorted by SJR (empty query) or fuzzy relevance.
    """
    return search_venues(area=area, venue_type=type, q=q, limit=limit)
