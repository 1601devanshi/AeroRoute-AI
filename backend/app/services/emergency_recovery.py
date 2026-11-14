
"""Emergency recovery decision support simulation."""

from app.services.drone_intelligence import (
    assess_emergency,
    select_recovery_site
)


def plan_emergency_recovery(
    drone_position: dict,
    recovery_sites: list,
    battery_percentage: float,
    wind_speed_kmh: float = 0,
    wind_gust_kmh: float = 0,
    gps_available: bool = True,
    obstacle_detected: bool = False,
    maximum_recovery_distance_km: float = 10.0
) -> dict:
    """
    Assess an emergency and select a configured recovery location.

    This is a decision-support simulation, not an autonomous
    real-world flight or landing command.
    """

    if not 0 <= battery_percentage <= 100:
        raise ValueError("Battery percentage must be between 0 and 100.")

    emergency = assess_emergency(
        battery_percentage=battery_percentage,
        wind_speed_kmh=wind_speed_kmh,
        wind_gust_kmh=wind_gust_kmh,
        gps_available=gps_available,
        obstacle_detected=obstacle_detected
    )

    recovery = select_recovery_site(
        drone_position=drone_position,
        recovery_sites=recovery_sites,
        maximum_distance_km=maximum_recovery_distance_km
    )

    if emergency["emergency_level"] == "NORMAL":
        status = "NO_EMERGENCY"
    elif recovery["selected_site"] is None:
        status = "RECOVERY_SITE_UNAVAILABLE"
    else:
        status = "RECOVERY_PLAN_AVAILABLE"

    return {
        "status": status,
        "emergency_assessment": emergency,
        "recovery_assessment": recovery,
        "recommended_action": (
            "Review the recovery location and mission conditions."
            if status == "RECOVERY_PLAN_AVAILABLE"
            else (
                "No configured safe recovery site is available."
                if status == "RECOVERY_SITE_UNAVAILABLE"
                else "No emergency trigger was detected."
            )
        ),
        "simulation_only": True
    }
