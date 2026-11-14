
"""Combined flight safety assessment for AeroRoute AI."""

from app.services.obstacle_avoidance import detect_obstacles
from app.services.weather_intelligence import assess_weather_risk
from app.services.drone_intelligence import assess_gnss_status


def assess_flight_safety(
    route: list,
    no_fly_zones: list,
    wind_speed_kmh: float = 0,
    wind_gust_kmh: float = 0,
    precipitation_mm: float = 0,
    temperature_c: float = 25,
    humidity_percentage: float = 50,
    gps_available: bool = True,
    gps_accuracy_m: float | None = None
) -> dict:
    """Generate a combined informational safety assessment."""

    obstacle_result = detect_obstacles(
        route=route,
        no_fly_zones=no_fly_zones
    )

    weather_result = assess_weather_risk(
        wind_speed_kmh=wind_speed_kmh,
        wind_gust_kmh=wind_gust_kmh,
        precipitation_mm=precipitation_mm,
        temperature_c=temperature_c,
        humidity_percentage=humidity_percentage
    )

    gnss_result = assess_gnss_status(
        gps_available=gps_available,
        gps_accuracy_m=gps_accuracy_m
    )

    warnings = []

    if not obstacle_result["safe"]:
        warnings.append("Configured restricted-zone intersection detected.")

    if weather_result["risk_level"] == "HIGH":
        warnings.append("High simulated weather risk.")

    elif weather_result["risk_level"] == "MODERATE":
        warnings.append("Moderate simulated weather risk.")

    if gnss_result["status"] != "NORMAL":
        warnings.append("GNSS navigation is degraded or unavailable.")

    if not obstacle_result["safe"] or weather_result["risk_level"] == "HIGH":
        overall_status = "HIGH_RISK"

    elif warnings:
        overall_status = "REVIEW_REQUIRED"

    else:
        overall_status = "LOW_RISK"

    return {
        "overall_status": overall_status,
        "route_assessment": obstacle_result,
        "weather_assessment": weather_result,
        "navigation_assessment": gnss_result,
        "warnings": warnings,
        "simulation_only": True,
        "disclaimer": (
            "This is an informational software simulation, not a "
            "certified flight-safety assessment or permission to fly."
        )
    }
