
"""
AeroRoute AI - Drone Intelligence Simulation

Includes:
1. Payload-aware energy estimation
2. GPS and IMU sensor fusion
3. GNSS fallback simulation
4. Emergency recovery assessment
5. Recovery-site selection
6. Precision landing simulation
7. Adaptive Genetic Algorithm parameter selection

These are software simulations, not certified flight-control systems.
"""

from math import radians, sin, cos, asin, sqrt
from typing import Optional


# ---------------------------------------------------------
# 1. GEOLOCATION
# ---------------------------------------------------------

def haversine_km(point_a: dict, point_b: dict) -> float:
    """Calculate distance between two latitude/longitude points."""

    lat1 = radians(float(point_a["lat"]))
    lon1 = radians(float(point_a["lon"]))
    lat2 = radians(float(point_b["lat"]))
    lon2 = radians(float(point_b["lon"]))

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    value = (
        sin(dlat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    )

    return 6371.0 * 2 * asin(sqrt(value))


# ---------------------------------------------------------
# 2. PAYLOAD-AWARE BATTERY MODEL
# ---------------------------------------------------------

def estimate_payload_energy(
    distance_km: float,
    battery_capacity_wh: float,
    energy_per_km_wh: float,
    payload_kg: float = 0.0,
    maximum_payload_kg: float = 2.0,
    reserve_percentage: float = 20.0,
    payload_energy_factor: float = 0.12,
) -> dict:
    """
    Estimate energy consumption using a simplified payload factor.

    payload_energy_factor:
        Additional energy fraction per kg of payload.

    Example:
        1 kg payload and factor 0.12 means 12% additional
        energy consumption compared with the baseline.
    """

    if distance_km < 0:
        raise ValueError("Distance cannot be negative.")

    if battery_capacity_wh <= 0 or energy_per_km_wh <= 0:
        raise ValueError("Battery capacity and energy rate must be positive.")

    if maximum_payload_kg <= 0:
        raise ValueError("Maximum payload must be positive.")

    if payload_kg < 0:
        raise ValueError("Payload cannot be negative.")

    if not 0 <= reserve_percentage < 100:
        raise ValueError("Reserve must be between 0 and 100.")

    payload_exceeded = payload_kg > maximum_payload_kg

    payload_factor = 1 + (
        payload_kg * payload_energy_factor
    )

    adjusted_energy_per_km = energy_per_km_wh * payload_factor

    estimated_energy = distance_km * adjusted_energy_per_km

    reserve_wh = battery_capacity_wh * reserve_percentage / 100
    usable_energy = battery_capacity_wh - reserve_wh

    remaining_energy = battery_capacity_wh - estimated_energy

    feasible = (
        not payload_exceeded
        and estimated_energy <= usable_energy
    )

    return {
        "distance_km": round(distance_km, 3),
        "payload_kg": round(payload_kg, 2),
        "maximum_payload_kg": round(maximum_payload_kg, 2),
        "payload_exceeded": payload_exceeded,
        "payload_energy_factor": round(payload_factor, 3),
        "baseline_energy_wh": round(
            distance_km * energy_per_km_wh, 2
        ),
        "estimated_energy_wh": round(estimated_energy, 2),
        "battery_capacity_wh": round(battery_capacity_wh, 2),
        "reserve_wh": round(reserve_wh, 2),
        "usable_energy_wh": round(usable_energy, 2),
        "remaining_energy_wh": round(remaining_energy, 2),
        "battery_percentage_remaining": round(
            max(0, remaining_energy) / battery_capacity_wh * 100,
            2
        ),
        "feasible": feasible,
        "status": "FEASIBLE" if feasible else "NOT_FEASIBLE",
        "warning": (
            "Payload exceeds configured drone limit."
            if payload_exceeded
            else (
                "Estimated energy exceeds usable battery."
                if not feasible
                else "Estimated mission is within configured limits."
            )
        )
    }


# ---------------------------------------------------------
# 3. GPS + IMU SENSOR FUSION
# ---------------------------------------------------------

def fuse_navigation_measurements(
    previous_position: dict,
    gps_position: Optional[dict] = None,
    imu_displacement: Optional[dict] = None,
    gps_valid: bool = True,
    gps_weight: float = 0.85,
) -> dict:
    """
    Simplified complementary position fusion.

    gps_position:
        {"lat": ..., "lon": ...}

    imu_displacement:
        {"north_m": ..., "east_m": ...}

    IMU displacement is treated as a simulated movement estimate.
    """

    if not 0 <= gps_weight <= 1:
        raise ValueError("GPS weight must be between 0 and 1.")

    previous_lat = float(previous_position["lat"])
    previous_lon = float(previous_position["lon"])

    north_m = float(
        (imu_displacement or {}).get("north_m", 0)
    )

    east_m = float(
        (imu_displacement or {}).get("east_m", 0)
    )

    # Approximate conversion from metres to degrees.
    imu_lat = previous_lat + north_m / 111320.0

    longitude_scale = max(
        0.01, cos(radians(previous_lat))
    )

    imu_lon = previous_lon + (
        east_m / (111320.0 * longitude_scale)
    )

    if gps_valid and gps_position:
        gps_lat = float(gps_position["lat"])
        gps_lon = float(gps_position["lon"])

        fused_lat = (
            gps_weight * gps_lat
            + (1 - gps_weight) * imu_lat
        )

        fused_lon = (
            gps_weight * gps_lon
            + (1 - gps_weight) * imu_lon
        )

        mode = "GPS_IMU_FUSION"

    else:
        fused_lat = imu_lat
        fused_lon = imu_lon
        mode = "IMU_FALLBACK"

    return {
        "position": {
            "lat": round(fused_lat, 7),
            "lon": round(fused_lon, 7)
        },
        "gps_available": bool(gps_valid and gps_position),
        "navigation_mode": mode,
        "sensor_sources": (
            ["GPS", "IMU"]
            if gps_valid and gps_position
            else ["IMU"]
        ),
        "simulated": True,
        "warning": (
            "GPS signal unavailable. Position is estimated using "
            "simulated IMU displacement."
            if mode == "IMU_FALLBACK"
            else "Position estimated using simulated sensor fusion."
        )
    }


# ---------------------------------------------------------
# 4. GNSS FALLBACK
# ---------------------------------------------------------

def assess_gnss_status(
    gps_available: bool,
    gps_accuracy_m: Optional[float] = None,
    maximum_accuracy_m: float = 10.0,
    fallback_available: bool = True,
) -> dict:

    accurate_gps = (
        gps_available
        and gps_accuracy_m is not None
        and gps_accuracy_m <= maximum_accuracy_m
    )

    if accurate_gps:
        mode = "GNSS_PRIMARY"
        status = "NORMAL"

    elif fallback_available:
        mode = "FALLBACK_NAVIGATION"
        status = "DEGRADED"

    else:
        mode = "NAVIGATION_UNAVAILABLE"
        status = "CRITICAL"

    return {
        "status": status,
        "navigation_mode": mode,
        "gps_available": gps_available,
        "gps_accuracy_m": gps_accuracy_m,
        "fallback_available": fallback_available,
        "warning": (
            "GNSS signal is usable."
            if status == "NORMAL"
            else (
                "GNSS degraded or unavailable. "
                "Fallback navigation simulation activated."
                if status == "DEGRADED"
                else "Navigation unavailable. Mission must be stopped."
            )
        )
    }


# ---------------------------------------------------------
# 5. EMERGENCY RECOVERY ASSESSMENT
# ---------------------------------------------------------

def assess_emergency(
    battery_percentage: float,
    wind_speed_kmh: float = 0.0,
    wind_gust_kmh: float = 0.0,
    gps_available: bool = True,
    obstacle_detected: bool = False,
    battery_critical_threshold: float = 15.0,
    maximum_wind_kmh: float = 35.0,
) -> dict:

    reasons = []

    if battery_percentage <= battery_critical_threshold:
        reasons.append("CRITICAL_BATTERY")

    if wind_speed_kmh >= maximum_wind_kmh:
        reasons.append("HIGH_WIND")

    if wind_gust_kmh >= maximum_wind_kmh:
        reasons.append("HIGH_WIND_GUSTS")

    if not gps_available:
        reasons.append("GNSS_UNAVAILABLE")

    if obstacle_detected:
        reasons.append("OBSTACLE_DETECTED")

    if not reasons:
        level = "NORMAL"
        action = "CONTINUE_MISSION"

    elif (
        "CRITICAL_BATTERY" in reasons
        or "OBSTACLE_DETECTED" in reasons
    ):
        level = "CRITICAL"
        action = "SIMULATE_EMERGENCY_RECOVERY"

    else:
        level = "WARNING"
        action = "SIMULATE_SAFE_REROUTING"

    return {
        "emergency_level": level,
        "recommended_action": action,
        "reasons": reasons,
        "battery_percentage": battery_percentage,
        "wind_speed_kmh": wind_speed_kmh,
        "wind_gust_kmh": wind_gust_kmh,
        "gps_available": gps_available,
        "obstacle_detected": obstacle_detected,
        "simulated": True
    }


# ---------------------------------------------------------
# 6. RECOVERY SITE SELECTION
# ---------------------------------------------------------

def select_recovery_site(
    drone_position: dict,
    recovery_sites: list,
    maximum_distance_km: float = 10.0
) -> dict:
    """
    Select the nearest available recovery site.

    Each site:
    {
        "name": "Landing Site A",
        "lat": 26.9,
        "lon": 75.8,
        "safe": True
    }
    """

    candidates = []

    for site in recovery_sites:
        if not site.get("safe", False):
            continue

        distance = haversine_km(
            drone_position,
            site
        )

        if distance <= maximum_distance_km:
            candidates.append({
                "name": site.get("name", "Recovery Site"),
                "lat": float(site["lat"]),
                "lon": float(site["lon"]),
                "distance_km": round(distance, 3)
            })

    if not candidates:
        return {
            "status": "NO_SAFE_SITE_FOUND",
            "selected_site": None,
            "candidates": []
        }

    selected = min(
        candidates,
        key=lambda item: item["distance_km"]
    )

    return {
        "status": "RECOVERY_SITE_SELECTED",
        "selected_site": selected,
        "candidates": candidates
    }


# ---------------------------------------------------------
# 7. PRECISION LANDING SIMULATION
# ---------------------------------------------------------

def simulate_precision_landing(
    drone_position: dict,
    landing_target: dict,
    landing_tolerance_m: float = 1.0
) -> dict:

    if landing_tolerance_m <= 0:
        raise ValueError("Landing tolerance must be positive.")

    distance_km = haversine_km(
        drone_position,
        landing_target
    )

    error_m = distance_km * 1000

    landed = error_m <= landing_tolerance_m

    return {
        "landing_status": (
            "LANDING_SUCCESS"
            if landed
            else "ALIGNMENT_REQUIRED"
        ),
        "horizontal_error_m": round(error_m, 3),
        "landing_tolerance_m": landing_tolerance_m,
        "target": landing_target,
        "simulated": True,
        "message": (
            "Simulated landing alignment achieved."
            if landed
            else "Drone requires further simulated alignment."
        )
    }


# ---------------------------------------------------------
# 8. ADAPTIVE GENETIC ALGORITHM SETTINGS
# ---------------------------------------------------------

def adaptive_ga_parameters(
    base_population: int = 80,
    base_generations: int = 250,
    stagnation_count: int = 0,
    diversity: float = 0.5
) -> dict:
    """
    Adjust GA settings based on stagnation and population diversity.

    diversity should be between 0 and 1.
    """

    if base_population < 10 or base_generations < 10:
        raise ValueError("Base GA settings are too small.")

    if stagnation_count < 0:
        raise ValueError("Stagnation count cannot be negative.")

    if not 0 <= diversity <= 1:
        raise ValueError("Diversity must be between 0 and 1.")

    population = base_population
    generations = base_generations

    mutation_rate = 0.10

    if stagnation_count >= 10:
        population = int(base_population * 1.5)
        generations = int(base_generations * 1.2)
        mutation_rate = 0.25

    elif stagnation_count >= 5:
        population = int(base_population * 1.25)
        mutation_rate = 0.18

    if diversity < 0.2:
        mutation_rate = max(mutation_rate, 0.30)

    return {
        "population_size": min(population, 500),
        "generations": min(generations, 2000),
        "mutation_rate": round(mutation_rate, 2),
        "diversity": diversity,
        "stagnation_count": stagnation_count,
        "adaptation_enabled": True
    }
