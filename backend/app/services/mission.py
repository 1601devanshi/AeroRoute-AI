
"""Mission validation and feasibility assessment."""

from app.services.drone_intelligence import estimate_payload_energy
from app.services.fleet import get_drone_by_id
from app.optimization.algorithms import haversine


def calculate_mission_distance(waypoints: list) -> float:
    """Calculate total distance through ordered mission waypoints."""

    if len(waypoints) < 2:
        raise ValueError("A mission requires at least two waypoints.")

    distance = 0.0

    for index in range(len(waypoints) - 1):
        distance += haversine(
            [
                float(waypoints[index]["lat"]),
                float(waypoints[index]["lon"])
            ],
            [
                float(waypoints[index + 1]["lat"]),
                float(waypoints[index + 1]["lon"])
            ]
        )

    return round(distance, 3)


def assess_mission(
    waypoints: list,
    drone_id: str,
    payload_kg: float = 0.0,
    reserve_percentage: float = 20.0
) -> dict:
    """Assess a mission using configured fleet specifications."""

    drone = get_drone_by_id(drone_id)

    if drone is None:
        raise ValueError("Unknown drone ID.")

    distance = calculate_mission_distance(waypoints)

    battery = estimate_payload_energy(
        distance_km=distance,
        battery_capacity_wh=drone["battery_capacity_wh"],
        energy_per_km_wh=drone["energy_per_km_wh"],
        payload_kg=payload_kg,
        maximum_payload_kg=drone["maximum_payload_kg"],
        reserve_percentage=reserve_percentage
    )

    within_nominal_range = distance <= drone["maximum_range_km"]

    feasible = (
        battery["feasible"]
        and within_nominal_range
    )

    return {
        "mission_status": (
            "FEASIBLE" if feasible else "NOT_FEASIBLE"
        ),
        "drone": drone,
        "distance_km": distance,
        "payload_kg": payload_kg,
        "within_nominal_range": within_nominal_range,
        "battery_analysis": battery,
        "warnings": [
            warning for warning in [
                battery["warning"],
                (
                    "Mission exceeds configured nominal range."
                    if not within_nominal_range else None
                )
            ] if warning
        ],
        "simulation_only": True
    }
