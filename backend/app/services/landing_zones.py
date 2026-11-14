from typing import Any
from app.services.drone_intelligence import haversine_km


def _coordinates(point: Any) -> tuple[float, float]:
    if isinstance(point, dict):
        return float(point["lat"]), float(point["lon"])
    return float(point[0]), float(point[1])


def assess_landing_zones(
    drone_position: Any,
    landing_zones: list[dict],
    wind_speed_kmh: float = 0,
    obstacle_clearance: bool = True,
    maximum_distance_km: float = 10,
) -> dict:
    drone_coordinates = _coordinates(drone_position)
    candidates = []

    for index, zone in enumerate(landing_zones):
        try:
            zone_coordinates = _coordinates(zone)
        except (KeyError, TypeError, ValueError, IndexError):
            continue

        distance = haversine_km(
            drone_coordinates,
            zone_coordinates
        )

        surface = str(zone.get("surface", "unknown")).lower()
        surface_score = {
            "concrete": 30,
            "asphalt": 30,
            "grass": 20,
            "open_ground": 15,
            "unknown": 5,
        }.get(surface, 5)

        within_range = distance <= maximum_distance_km
        wind_ok = wind_speed_kmh <= 25
        obstacles_ok = obstacle_clearance and bool(
            zone.get("obstacle_clear", True)
        )

        score = surface_score
        score += 25 if within_range else 0
        score += 25 if wind_ok else 0
        score += 20 if obstacles_ok else 0

        suitable = (
            within_range
            and wind_ok
            and obstacles_ok
            and surface != "unknown"
        )

        candidates.append({
            "zone_id": zone.get("id", f"zone_{index + 1}"),
            "name": zone.get("name", f"Landing Zone {index + 1}"),
            "latitude": zone_coordinates[0],
            "longitude": zone_coordinates[1],
            "distance_km": round(distance, 3),
            "surface": surface,
            "score": score,
            "suitable": suitable,
            "reasons": _reasons(
                within_range, wind_ok, obstacles_ok, surface
            ),
        })

    candidates.sort(
        key=lambda item: (item["suitable"], item["score"], -item["distance_km"]),
        reverse=True,
    )

    recommended = next(
        (zone for zone in candidates if zone["suitable"]),
        None,
    )

    return {
        "recommended_zone": recommended,
        "landing_zones": candidates,
        "total_candidates": len(candidates),
        "message": (
            "A potentially suitable landing zone was identified."
            if recommended
            else "No candidate met the configured suitability checks."
        ),
        "disclaimer": (
            "Simulation estimate only. Verify the actual landing area, "
            "airspace, weather and local aviation requirements before flight."
        ),
    }


def _reasons(within_range, wind_ok, obstacles_ok, surface):
    reasons = []

    if not within_range:
        reasons.append("Outside configured distance range.")
    if not wind_ok:
        reasons.append("Wind exceeds the configured threshold.")
    if not obstacles_ok:
        reasons.append("Obstacle clearance is not confirmed.")
    if surface == "unknown":
        reasons.append("Landing surface is unknown.")

    if not reasons:
        reasons.append("Passed the configured simulation checks.")

    return reasons