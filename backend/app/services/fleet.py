
"""Drone fleet specifications and selection."""

DRONE_FLEET = [
    {
        "id": "scout",
        "name": "AeroScout",
        "category": "Lightweight",
        "battery_capacity_wh": 120,
        "maximum_payload_kg": 0.5,
        "energy_per_km_wh": 18,
        "maximum_range_km": 6,
        "maximum_speed_kmh": 35,
        "description": "Lightweight drone for short-distance missions."
    },
    {
        "id": "delivery",
        "name": "AeroDeliver",
        "category": "Delivery",
        "battery_capacity_wh": 250,
        "maximum_payload_kg": 2.0,
        "energy_per_km_wh": 25,
        "maximum_range_km": 10,
        "maximum_speed_kmh": 45,
        "description": "Payload-oriented drone for delivery simulations."
    },
    {
        "id": "surveillance",
        "name": "AeroWatch",
        "category": "Surveillance",
        "battery_capacity_wh": 300,
        "maximum_payload_kg": 1.0,
        "energy_per_km_wh": 22,
        "maximum_range_km": 13,
        "maximum_speed_kmh": 40,
        "description": "Longer-range observation and monitoring drone."
    },
    {
        "id": "heavy",
        "name": "AeroCargo",
        "category": "Heavy Lift",
        "battery_capacity_wh": 500,
        "maximum_payload_kg": 5.0,
        "energy_per_km_wh": 40,
        "maximum_range_km": 12,
        "maximum_speed_kmh": 35,
        "description": "Higher-capacity drone for heavy payload simulations."
    }
]


def get_all_drones():
    """Return available drone specifications."""
    return DRONE_FLEET


def get_drone_by_id(drone_id: str):
    """Find a drone using its unique ID."""
    return next(
        (drone for drone in DRONE_FLEET if drone["id"] == drone_id),
        None
    )


def recommend_drone(payload_kg: float, distance_km: float):
    """Recommend a drone based on payload and nominal range."""

    if payload_kg < 0 or distance_km < 0:
        raise ValueError("Payload and distance cannot be negative.")

    candidates = [
        drone for drone in DRONE_FLEET
        if drone["maximum_payload_kg"] >= payload_kg
        and drone["maximum_range_km"] >= distance_km
    ]

    if not candidates:
        return {
            "status": "NO_SUITABLE_DRONE",
            "recommended_drone": None,
            "message": "No configured drone meets these nominal limits."
        }

    # Choose the smallest configured drone that meets the limits.
    selected = min(
        candidates,
        key=lambda drone: (
            drone["battery_capacity_wh"],
            drone["maximum_payload_kg"]
        )
    )

    return {
        "status": "RECOMMENDATION_AVAILABLE",
        "recommended_drone": selected,
        "message": "Drone selected using configured payload and range limits."
    }
