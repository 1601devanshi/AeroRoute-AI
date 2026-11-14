
"""Dynamic route recalculation for AeroRoute AI."""

from app.services.detours import generate_detour_route
from app.services.airspace import check_route_airspace


def recalculate_route(
    current_route: list,
    no_fly_zones: list,
    safety_margin_km: float = 1.0,
    current_position: dict | None = None
) -> dict:
    """
    Recalculate a route around configured restricted zones.

    If current_position is supplied, it becomes the start of the
    recalculated route. Remaining original waypoints are retained.
    """

    if len(current_route) < 2:
        raise ValueError("At least two route points are required.")

    if safety_margin_km < 0:
        raise ValueError("Safety margin cannot be negative.")

    route = [
        [float(point["lat"]), float(point["lon"])]
        for point in current_route
    ]

    if current_position is not None:
        route[0] = [
            float(current_position["lat"]),
            float(current_position["lon"])
        ]

    detour = generate_detour_route(
        route=route,
        zones=no_fly_zones,
        safety_margin_km=safety_margin_km
    )

    if detour.get("status") != "clear":
        return {
            "status": "NO_SAFE_DETOUR",
            "message": detour.get(
                "message",
                "A clear route could not be generated."
            ),
            "route": None,
            "simulation_only": True
        }

    candidate = detour.get("route", [])

    if len(candidate) < 2:
        return {
            "status": "INVALID_DETOUR",
            "message": "The generated route is incomplete.",
            "route": None,
            "simulation_only": True
        }

    validation = check_route_airspace(
        candidate,
        no_fly_zones
    )

    if not validation["is_clear"]:
        return {
            "status": "VALIDATION_FAILED",
            "message": "The recalculated route did not pass validation.",
            "route": None,
            "violations": validation["violations"],
            "simulation_only": True
        }

    return {
        "status": "REROUTED",
        "message": "A new route was generated and checked.",
        "route": [
            {"lat": point[0], "lon": point[1]}
            for point in candidate
        ],
        "distance_km": detour.get("distance_km"),
        "detour_count": detour.get("detour_count"),
        "safety_margin_km": safety_margin_km,
        "simulation_only": True
    }
