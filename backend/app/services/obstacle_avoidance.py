
"""AeroRoute AI obstacle detection and route safety."""

from app.services.airspace import check_route_airspace


def detect_obstacles(route: list, no_fly_zones: list) -> dict:
    """
    Check whether an ordered route intersects configured restricted zones.

    Route points must use:
        {"lat": latitude, "lon": longitude}

    Supported zones are the existing circle and polygon schemas.
    """

    if len(route) < 2:
        raise ValueError("At least two route points are required.")

    if not isinstance(no_fly_zones, list):
        raise ValueError("No-fly zones must be a list.")

    normalized_route = []

    for point in route:
        lat = float(point["lat"])
        lon = float(point["lon"])

        if not -90 <= lat <= 90 or not -180 <= lon <= 180:
            raise ValueError("Invalid route coordinates.")

        normalized_route.append([lat, lon])

    result = check_route_airspace(
        normalized_route,
        no_fly_zones
    )

    return {
        "safe": result["is_clear"],
        "obstacle_detected": not result["is_clear"],
        "violation_count": result["violation_count"],
        "violations": result["violations"],
        "route": [
            {"lat": point[0], "lon": point[1]}
            for point in normalized_route
        ],
        "simulation_only": True
    }


def validate_route(route: list, no_fly_zones: list) -> dict:
    """Return a simple route validation result."""

    assessment = detect_obstacles(route, no_fly_zones)

    return {
        "valid": assessment["safe"],
        "message": (
            "No restricted-zone intersections detected."
            if assessment["safe"]
            else "Route intersects one or more configured restricted zones."
        ),
        "assessment": assessment
    }
