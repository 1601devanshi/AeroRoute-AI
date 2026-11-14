from typing import Any
from app.services.drone_intelligence import haversine_km


def _coordinates(point: Any) -> tuple[float, float]:
    if isinstance(point, dict):
        return float(point["lat"]), float(point["lon"])
    return float(point[0]), float(point[1])


def _distance_to_route(position, route) -> float:
    if not route:
        return 0.0

    current = _coordinates(position)
    return min(
        haversine_km(current, _coordinates(point))
        for point in route
    )


def monitor_mission(
    route: list,
    current_position: Any,
    battery_percentage: float = 100,
    mission_status: str = "in_progress",
    completed_waypoints: int = 0,
) -> dict:
    if not route:
        return {
            "status": "invalid",
            "message": "No route was provided.",
            "progress_percentage": 0,
            "remaining_waypoints": 0,
        }

    total_waypoints = len(route)
    completed = max(0, min(int(completed_waypoints), total_waypoints))
    remaining = total_waypoints - completed

    progress = (
        completed / total_waypoints * 100
        if total_waypoints
        else 0
    )

    distance_to_route = _distance_to_route(
        current_position,
        route
    )

    battery = max(0, min(float(battery_percentage), 100))

    if mission_status == "completed":
        status = "completed"
    elif battery <= 15:
        status = "critical_battery"
    elif distance_to_route > 1:
        status = "off_route"
    else:
        status = mission_status

    return {
        "status": status,
        "progress_percentage": round(progress, 2),
        "total_waypoints": total_waypoints,
        "completed_waypoints": completed,
        "remaining_waypoints": remaining,
        "battery_percentage": round(battery, 2),
        "distance_from_nearest_waypoint_km": round(
            distance_to_route, 3
        ),
        "message": _status_message(status),
    }


def _status_message(status: str) -> str:
    messages = {
        "completed": "Mission marked as completed.",
        "critical_battery": "Critical battery level. Review recovery options.",
        "off_route": "Drone position is more than 1 km from the nearest route waypoint.",
        "in_progress": "Mission is progressing.",
        "paused": "Mission is paused.",
        "invalid": "Mission data is invalid.",
    }
    return messages.get(status, "Mission status updated.")