from typing import Any
from app.services.drone_intelligence import haversine_km


def _coordinates(point: Any) -> tuple[float, float]:
    if isinstance(point, dict):
        return float(point["lat"]), float(point["lon"])
    return float(point[0]), float(point[1])


def analyze_route(route: list, optimized_distance_km: float | None = None) -> dict:
    if not isinstance(route, list) or len(route) < 2:
        return {
            "valid": False,
            "message": "At least two waypoints are required.",
            "waypoint_count": len(route) if isinstance(route, list) else 0,
            "total_distance_km": 0,
            "segment_distances_km": [],
        }

    points = [_coordinates(point) for point in route]

    for lat, lon in points:
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError("A waypoint has invalid latitude or longitude.")

    segments = [
        haversine_km(points[index], points[index + 1])
        for index in range(len(points) - 1)
    ]

    total_distance = sum(segments)

    efficiency = None
    if optimized_distance_km is not None:
        baseline = float(optimized_distance_km)
        if baseline > 0:
            efficiency = round(
                min(100, baseline / total_distance * 100)
                if total_distance > 0 else 100,
                2,
            )

    return {
        "valid": True,
        "waypoint_count": len(points),
        "segment_count": len(segments),
        "total_distance_km": round(total_distance, 3),
        "segment_distances_km": [
            round(distance, 3) for distance in segments
        ],
        "average_segment_distance_km": round(
            total_distance / len(segments), 3
        ),
        "route_efficiency_percentage": efficiency,
        "message": "Route analysis completed.",
    }