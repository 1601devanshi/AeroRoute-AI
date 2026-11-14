
from typing import Any


def calculate_route_battery(
    route: list[dict[str, float]],
    battery_capacity_wh: float,
    energy_per_km_wh: float,
    reserve_percentage: float = 20.0,
) -> dict[str, Any]:
    """
    Estimate battery consumption along a route.

    Energy model:
        segment_energy_wh = segment_distance_km * energy_per_km_wh

    This is a simplified configurable energy model. It does not yet
    account for wind, payload, altitude, acceleration or hover time.
    """

    from math import asin, cos, radians, sin, sqrt

    if not route:
        raise ValueError("Route must contain at least one waypoint.")

    if battery_capacity_wh <= 0:
        raise ValueError("Battery capacity must be greater than zero.")

    if energy_per_km_wh <= 0:
        raise ValueError("Energy per kilometre must be greater than zero.")

    if not 0 <= reserve_percentage < 100:
        raise ValueError("Reserve percentage must be between 0 and 99.99.")

    def haversine_km(point_a: dict, point_b: dict) -> float:
        lat1 = radians(float(point_a["lat"]))
        lon1 = radians(float(point_a["lon"]))
        lat2 = radians(float(point_b["lat"]))
        lon2 = radians(float(point_b["lon"]))

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = (
            sin(dlat / 2) ** 2
            + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        )

        return 6371.0 * 2 * asin(sqrt(a))

    reserve_wh = battery_capacity_wh * reserve_percentage / 100
    usable_energy_wh = battery_capacity_wh - reserve_wh

    total_distance_km = 0.0
    total_energy_wh = 0.0
    segment_details = []
    waypoint_details = []

    remaining_energy_wh = battery_capacity_wh

    waypoint_details.append({
        "waypoint_index": 0,
        "remaining_energy_wh": round(remaining_energy_wh, 2),
        "remaining_battery_percentage": 100.0,
        "status": "normal",
    })

    for index in range(len(route) - 1):
        start = route[index]
        end = route[index + 1]

        distance_km = haversine_km(start, end)
        energy_used_wh = distance_km * energy_per_km_wh

        total_distance_km += distance_km
        total_energy_wh += energy_used_wh
        remaining_energy_wh -= energy_used_wh

        remaining_percentage = (
            remaining_energy_wh / battery_capacity_wh
        ) * 100

        if remaining_energy_wh <= 0:
            status = "battery_exhausted"
        elif remaining_energy_wh < reserve_wh:
            status = "low_battery"
        else:
            status = "normal"

        segment_details.append({
            "segment": index + 1,
            "from_waypoint": index,
            "to_waypoint": index + 1,
            "distance_km": round(distance_km, 3),
            "energy_used_wh": round(energy_used_wh, 2),
            "remaining_energy_wh": round(max(0.0, remaining_energy_wh), 2),
            "projected_remaining_energy_wh": round(remaining_energy_wh, 2),
            "remaining_battery_percentage": round(
                max(0.0, remaining_percentage), 2
            ),
            "status": status,
        })

        waypoint_details.append({
            "waypoint_index": index + 1,
            "remaining_energy_wh": round(
                max(0.0, remaining_energy_wh), 2
            ),
            "projected_remaining_energy_wh": round(
                remaining_energy_wh, 2
            ),
            "remaining_battery_percentage": round(
                max(0.0, remaining_percentage), 2
            ),
            "status": status,
        })

    battery_feasible = total_energy_wh <= usable_energy_wh
    projected_remaining_wh = battery_capacity_wh - total_energy_wh
    low_battery = projected_remaining_wh < reserve_wh

    if projected_remaining_wh <= 0:
        battery_status = "battery_insufficient"
    elif not battery_feasible:
        battery_status = "reserve_breached"
    else:
        battery_status = "feasible"

    return {
        "battery_capacity_wh": round(battery_capacity_wh, 2),
        "reserve_percentage": round(reserve_percentage, 2),
        "reserve_energy_wh": round(reserve_wh, 2),
        "usable_energy_wh": round(usable_energy_wh, 2),
        "energy_per_km_wh": round(energy_per_km_wh, 2),
        "total_distance_km": round(total_distance_km, 3),
        "total_energy_required_wh": round(total_energy_wh, 2),
        "projected_remaining_energy_wh": round(
            projected_remaining_wh, 2
        ),
        "remaining_battery_percentage": round(
            max(0.0, projected_remaining_wh / battery_capacity_wh * 100),
            2,
        ),
        "battery_feasible": battery_feasible,
        "low_battery_warning": low_battery,
        "battery_status": battery_status,
        "segment_details": segment_details,
        "waypoint_details": waypoint_details,
        "energy_model": (
            "Simplified distance-based estimate: distance_km × "
            "energy_per_km_wh. Weather, payload and altitude effects "
            "are not included yet."
        ),
    }

