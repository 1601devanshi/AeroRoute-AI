from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.mission_monitor import monitor_mission
from app.services.route_analysis import analyze_route
from app.services.landing_zones import assess_landing_zones


router = APIRouter(
    prefix="/api/operations",
    tags=["Flight Operations"],
)


class MissionMonitorRequest(BaseModel):
    route: list[Any] = Field(default_factory=list)
    current_position: Any
    battery_percentage: float = 100
    mission_status: str = "in_progress"
    completed_waypoints: int = 0


class RouteAnalysisRequest(BaseModel):
    route: list[Any] = Field(default_factory=list)
    optimized_distance_km: float | None = None


class LandingZoneRequest(BaseModel):
    drone_position: Any
    landing_zones: list[dict] = Field(default_factory=list)
    wind_speed_kmh: float = 0
    obstacle_clearance: bool = True
    maximum_distance_km: float = 10


@router.post("/mission-monitor")
def mission_monitor_endpoint(request: MissionMonitorRequest):
    try:
        return monitor_mission(
            route=request.route,
            current_position=request.current_position,
            battery_percentage=request.battery_percentage,
            mission_status=request.mission_status,
            completed_waypoints=request.completed_waypoints,
        )
    except (ValueError, TypeError, KeyError, IndexError) as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/route-analysis")
def route_analysis_endpoint(request: RouteAnalysisRequest):
    try:
        return analyze_route(
            route=request.route,
            optimized_distance_km=request.optimized_distance_km,
        )
    except (ValueError, TypeError, KeyError, IndexError) as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/landing-zones")
def landing_zones_endpoint(request: LandingZoneRequest):
    try:
        return assess_landing_zones(
            drone_position=request.drone_position,
            landing_zones=request.landing_zones,
            wind_speed_kmh=request.wind_speed_kmh,
            obstacle_clearance=request.obstacle_clearance,
            maximum_distance_km=request.maximum_distance_km,
        )
    except (ValueError, TypeError, KeyError, IndexError) as error:
        raise HTTPException(status_code=400, detail=str(error))