
"""Weather-based drone mission risk assessment."""

def assess_weather_risk(
    wind_speed_kmh: float = 0,
    wind_gust_kmh: float = 0,
    precipitation_mm: float = 0,
    temperature_c: float = 25,
    humidity_percentage: float = 50
):
    values = [
        wind_speed_kmh,
        wind_gust_kmh,
        precipitation_mm,
        humidity_percentage
    ]

    if any(value < 0 for value in values):
        raise ValueError("Weather measurements cannot be negative.")

    if humidity_percentage > 100:
        raise ValueError("Humidity cannot exceed 100%.")

    if not -80 <= temperature_c <= 70:
        raise ValueError("Temperature is outside supported simulation bounds.")

    reasons = []
    score = 0

    if wind_speed_kmh >= 25:
        score += 35
        reasons.append("High wind speed")
    elif wind_speed_kmh >= 15:
        score += 15
        reasons.append("Moderate wind speed")

    if wind_gust_kmh >= 35:
        score += 30
        reasons.append("Strong wind gusts")
    elif wind_gust_kmh >= 20:
        score += 15
        reasons.append("Moderate wind gusts")

    if precipitation_mm >= 2:
        score += 30
        reasons.append("Heavy precipitation")
    elif precipitation_mm > 0:
        score += 15
        reasons.append("Precipitation detected")

    if temperature_c >= 40 or temperature_c <= 0:
        score += 15
        reasons.append("Temperature outside preferred simulation range")

    if humidity_percentage >= 90:
        score += 10
        reasons.append("Very high humidity")

    score = min(score, 100)

    if score >= 60:
        risk = "HIGH"
    elif score >= 30:
        risk = "MODERATE"
    else:
        risk = "LOW"

    return {
        "risk_level": risk,
        "risk_score": score,
        "reasons": reasons,
        "recommended_action": (
            "Review conditions and simulate mission cancellation."
            if risk == "HIGH"
            else (
                "Review the route and weather before proceeding."
                if risk == "MODERATE"
                else "No elevated risk detected by this basic model."
            )
        ),
        "simulated_assessment": True,
        "disclaimer": (
            "Informational simulation only. These thresholds are not "
            "certified aviation operating limits."
        )
    }
