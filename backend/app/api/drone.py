
"""Drone intelligence API endpoints for AeroRoute AI."""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.fleet import (
    get_all_drones,
    get_drone_by_id,
    recommend_drone,
)
from app.services.drone_intelligence import (
    estimate_payload_energy,
    fuse_navigation_measurements,
    assess_gnss_status,
    assess_emergency,
    select_recovery_site,
    simulate_precision_landing,
)
from app.services.weather_intelligence import assess_weather_risk
from app.services.mission import assess_mission
from app.services.emergency_recovery import plan_emergency_recovery
from app.services.dynamic_rerouting import recalculate_route
from app.services.flight_safety import assess_flight_safety
from app.optimization.adaptive_optimizer import (
    run_adaptive_genetic_algorithm,
)

router = APIRouter(prefix="/api/drone", tags=["Drone Intelligence"])


class BatteryRequest(BaseModel):
    distance_km: float = Field(ge=0, le=1000)
    battery_capacity_wh: float = Field(gt=0)
    energy_per_km_wh: float = Field(gt=0)
    payload_kg: float = Field(default=0, ge=0)
    maximum_payload_kg: float = Field(default=2, gt=0)
    reserve_percentage: float = Field(default=20, ge=0, lt=100)


class FusionRequest(BaseModel):
    previous_position: dict
    gps_position: Optional[dict] = None
    imu_displacement: Optional[dict] = None
    gps_valid: bool = True
    gps_weight: float = Field(default=0.85, ge=0, le=1)


class GNSSRequest(BaseModel):
    gps_available: bool
    gps_accuracy_m: Optional[float] = Field(default=None, ge=0)
    maximum_accuracy_m: float = Field(default=10, gt=0)
    fallback_available: bool = True


class WeatherRiskRequest(BaseModel):
    wind_speed_kmh: float = Field(default=0, ge=0)
    wind_gust_kmh: float = Field(default=0, ge=0)
    precipitation_mm: float = Field(default=0, ge=0)
    temperature_c: float = 25
    humidity_percentage: float = Field(default=50, ge=0, le=100)


class EmergencyRequest(BaseModel):
    drone_position: dict
    recovery_sites: list[dict] = []
    battery_percentage: float = Field(ge=0, le=100)
    wind_speed_kmh: float = Field(default=0, ge=0)
    wind_gust_kmh: float = Field(default=0, ge=0)
    gps_available: bool = True
    obstacle_detected: bool = False
    maximum_recovery_distance_km: float = Field(default=10, gt=0)


class LandingRequest(BaseModel):
    drone_position: dict
    landing_target: dict
    landing_tolerance_m: float = Field(default=1, gt=0)


class MissionRequest(BaseModel):
    waypoints: list[dict] = Field(min_length=2, max_length=50)
    drone_id: str
    payload_kg: float = Field(default=0, ge=0)
    reserve_percentage: float = Field(default=20, ge=0, lt=100)


class FleetRecommendationRequest(BaseModel):
    payload_kg: float = Field(default=0, ge=0)
    distance_km: float = Field(ge=0)


class RerouteRequest(BaseModel):
    current_route: list[dict] = Field(min_length=2, max_length=50)
    no_fly_zones: list[dict] = []
    safety_margin_km: float = Field(default=1, ge=0, le=20)
    current_position: Optional[dict] = None


class SafetyRequest(BaseModel):
    route: list[dict] = Field(min_length=2, max_length=50)
    no_fly_zones: list[dict] = []
    wind_speed_kmh: float = Field(default=0, ge=0)
    wind_gust_kmh: float = Field(default=0, ge=0)
    precipitation_mm: float = Field(default=0, ge=0)
    temperature_c: float = 25
    humidity_percentage: float = Field(default=50, ge=0, le=100)
    gps_available: bool = True
    gps_accuracy_m: Optional[float] = Field(default=None, ge=0)


class AdaptiveGARequest(BaseModel):
    points: list[list[float]] = Field(min_length=2, max_length=15)
    population_size: int = Field(default=80, ge=10, le=500)
    generations: int = Field(default=250, ge=10, le=2000)
    stagnation_count: int = Field(default=0, ge=0)
    diversity: float = Field(default=0.5, ge=0, le=1)
    seed: int = 42


@router.get("/fleet")
def fleet():
    return {
        "status": "success",
        "drones": get_all_drones()
    }


@router.get("/fleet/{drone_id}")
def fleet_details(drone_id: str):
    drone = get_drone_by_id(drone_id)

    if drone is None:
        raise HTTPException(status_code=404, detail="Drone not found.")

    return {"status": "success", "drone": drone}


@router.post("/fleet/recommend")
def fleet_recommendation(request: FleetRecommendationRequest):
    return recommend_drone(
        payload_kg=request.payload_kg,
        distance_km=request.distance_km
    )


@router.post("/battery-analysis")
def battery_analysis(request: BatteryRequest):
    try:
        return estimate_payload_energy(**request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/sensor-fusion")
def sensor_fusion(request: FusionRequest):
    try:
        return fuse_navigation_measurements(**request.model_dump())
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/gnss-status")
def gnss_status(request: GNSSRequest):
    return assess_gnss_status(**request.model_dump())


@router.post("/weather-risk")
def weather_risk(request: WeatherRiskRequest):
    try:
        return assess_weather_risk(**request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/emergency-assessment")
def emergency_assessment(request: EmergencyRequest):
    try:
        data = request.model_dump()
        data.pop("drone_position")
        data.pop("recovery_sites")
        data.pop("maximum_recovery_distance_km")
        return assess_emergency(**data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/emergency-recovery")
def emergency_recovery(request: EmergencyRequest):
    try:
        return plan_emergency_recovery(**request.model_dump())
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/precision-landing")
def precision_landing(request: LandingRequest):
    try:
        return simulate_precision_landing(**request.model_dump())
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/mission-assessment")
def mission_assessment(request: MissionRequest):
    try:
        return assess_mission(**request.model_dump())
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/dynamic-rerouting")
def dynamic_rerouting(request: RerouteRequest):
    try:
        return recalculate_route(**request.model_dump())
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/flight-safety")
def flight_safety(request: SafetyRequest):
    try:
        return assess_flight_safety(**request.model_dump())
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/adaptive-ga")
def adaptive_ga(request: AdaptiveGARequest):
    try:
        return run_adaptive_genetic_algorithm(**request.model_dump())
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
