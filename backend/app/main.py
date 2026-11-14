
from time import perf_counter
from datetime import datetime, timezone
from typing import List, Union, Literal
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from app.api.drone import router as drone_router

from app.api.operations import router as operations_router

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.optimization.algorithms import (
    genetic_algorithm,
    dijkstra,
    a_star,
    haversine,
)
from app.services.airspace import check_route_airspace
from app.services.detours import generate_detour_route
from app.services.battery import calculate_route_battery


# =========================================================
# APPLICATION
# =========================================================

app = FastAPI(
    title="AeroRoute AI API",
    description=(
        "Drone route planning, intelligent optimization, "
        "live weather intelligence, airspace safety, "
        "automatic detours and battery-aware mission assessment."
    ),
    version="1.5.0",
)

# Register API routers
app.include_router(drone_router)
app.include_router(operations_router)



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REQUEST MODELS
# =========================================================

class Waypoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class CircleNoFlyZone(BaseModel):
    type: Literal["circle"] = "circle"
    name: str = Field(
        default="Circular restricted zone",
        min_length=1,
    )
    center: Waypoint
    radius_km: float = Field(gt=0, le=500)


class PolygonNoFlyZone(BaseModel):
    type: Literal["polygon"] = "polygon"
    name: str = Field(
        default="Polygon restricted zone",
        min_length=1,
    )
    vertices: List[Waypoint] = Field(
        min_length=3,
        max_length=50,
    )


NoFlyZone = Union[
    CircleNoFlyZone,
    PolygonNoFlyZone,
]


class OptimizationRequest(BaseModel):
    waypoints: List[Waypoint] = Field(
        min_length=2,
        max_length=15,
    )

    population_size: int = Field(
        default=80,
        ge=10,
        le=500,
    )

    generations: int = Field(
        default=250,
        ge=10,
        le=2000,
    )

    battery_capacity_wh: float = Field(
        default=150,
        gt=0,
    )

    energy_per_km_wh: float = Field(
        default=25,
        gt=0,
    )

    battery_reserve_percentage: float = Field(
        default=20.0,
        ge=0,
        lt=100,
    )

    no_fly_zones: List[NoFlyZone] = Field(
        default_factory=list,
        max_length=20,
    )

    avoid_no_fly_zones: bool = True

    safety_margin_km: float = Field(
        default=1.0,
        gt=0,
        le=20,
    )


class WeatherRouteRequest(BaseModel):
    waypoints: List[Waypoint] = Field(
        min_length=2,
        max_length=15,
    )


# =========================================================
# DEMO RESTRICTED ZONES
# These are simulated examples, not official restrictions.
# =========================================================

DEMO_NO_FLY_ZONES = [
    {
        "type": "circle",
        "name": "Demo Restricted Zone - Mathura Region",
        "center": {
            "lat": 27.4924,
            "lon": 77.6737,
        },
        "radius_km": 8.0,
    },
    {
        "type": "polygon",
        "name": "Demo Restricted Zone - Agra Region",
        "vertices": [
            {"lat": 27.05, "lon": 77.95},
            {"lat": 27.10, "lon": 78.05},
            {"lat": 27.02, "lon": 78.12},
            {"lat": 26.97, "lon": 78.02},
        ],
    },
]


# =========================================================
# BASIC ENDPOINTS
# =========================================================

@app.get("/")
def home():
    return {
        "project": "AeroRoute AI",
        "status": "online",
        "version": "1.5.0",
        "message": (
            "AeroRoute AI intelligent flight planning API "
            "is running."
        ),
        "integrations": {
            "route_optimization": True,
            "battery_assessment": True,
            "airspace_geometry": True,
            "automatic_detours": True,
            "live_weather": True,
        },
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": "1.5.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/demo-no-fly-zones")
def get_demo_no_fly_zones():
    return {
        "status": "success",
        "count": len(DEMO_NO_FLY_ZONES),
        "zones": DEMO_NO_FLY_ZONES,
        "note": (
            "These are simulated demonstration zones, "
            "not official airspace restrictions."
        ),
    }


# =========================================================
# OPTIMIZATION ENDPOINT
# =========================================================

@app.post("/api/optimize")
def optimize_route(request: OptimizationRequest):

    points = [
        [waypoint.lat, waypoint.lon]
        for waypoint in request.waypoints
    ]

    zones = [
        zone.model_dump()
        for zone in request.no_fly_zones
    ]

    try:

        # -------------------------------------------------
        # 1. GENETIC ALGORITHM
        # -------------------------------------------------

        start_time = perf_counter()

        ga_route, ga_distance = genetic_algorithm(
            points,
            population_size=request.population_size,
            generations=request.generations,
        )

        ga_time = (
            perf_counter() - start_time
        ) * 1000

        # -------------------------------------------------
        # 2. DIJKSTRA
        # -------------------------------------------------

        start_time = perf_counter()

        dijkstra_route, dijkstra_distance = dijkstra(points)

        dijkstra_time = (
            perf_counter() - start_time
        ) * 1000

        # -------------------------------------------------
        # 3. A STAR
        # -------------------------------------------------

        start_time = perf_counter()

        astar_route, astar_distance = a_star(points)

        astar_time = (
            perf_counter() - start_time
        ) * 1000

        # -------------------------------------------------
        # SHARED HELPERS
        # -------------------------------------------------

        def format_route(route):
            return [
                {
                    "index": index,
                    "lat": points[index][0],
                    "lon": points[index][1],
                }
                for index in route
            ]

        def route_distance_km(route):
            return sum(
                haversine(
                    points[route[i]],
                    points[route[i + 1]],
                )
                for i in range(len(route) - 1)
            )

        def battery_analysis(route_points):
            return calculate_route_battery(
                route=route_points,
                battery_capacity_wh=request.battery_capacity_wh,
                energy_per_km_wh=request.energy_per_km_wh,
                reserve_percentage=(
                    request.battery_reserve_percentage
                ),
            )

        def legacy_energy(battery):
            return {
                "estimated_energy_wh": (
                    battery["total_energy_required_wh"]
                ),
                "remaining_energy_wh": (
                    battery["projected_remaining_energy_wh"]
                ),
                "remaining_battery_percentage": (
                    battery["remaining_battery_percentage"]
                ),
                "within_capacity": (
                    battery["total_energy_required_wh"]
                    <= battery["battery_capacity_wh"]
                ),
            }

        def assess_mission(
            airspace,
            battery,
            detour_status=None,
        ):

            airspace_clear = bool(
                airspace and airspace.get("is_clear")
            )

            battery_ok = bool(
                battery and battery.get("battery_feasible")
            )

            if airspace_clear and battery_ok:
                status = "feasible"

            elif not airspace_clear and not battery_ok:
                status = "airspace_and_battery_infeasible"

            elif not airspace_clear:
                status = "airspace_blocked"

            else:
                status = "battery_insufficient"

            return {
                "status": status,
                "mission_feasible": (
                    airspace_clear and battery_ok
                ),
                "airspace_feasible": airspace_clear,
                "battery_feasible": battery_ok,
                "detour_status": detour_status,
                "note": (
                    "Geometric and simplified battery checks only; "
                    "this is not flight authorization or a certified "
                    "flight-performance assessment."
                ),
            }

        # -------------------------------------------------
        # ORIGINAL ROUTE AIRSPACE VALIDATION
        # -------------------------------------------------

        def check_algorithm_route(route):
            return check_route_airspace(
                format_route(route),
                zones,
            )

        ga_airspace = check_algorithm_route(ga_route)

        dijkstra_airspace = check_algorithm_route(
            dijkstra_route
        )

        astar_airspace = check_algorithm_route(astar_route)

        # -------------------------------------------------
        # AUTOMATIC DETOUR GENERATION
        # -------------------------------------------------

        def build_detour(route):

            original_route = format_route(route)

            if not request.avoid_no_fly_zones:

                battery = battery_analysis(original_route)

                airspace = check_route_airspace(
                    original_route,
                    zones,
                )

                return {
                    "status": "not_requested",
                    "route": original_route,
                    "distance_km": round(
                        route_distance_km(route),
                        3,
                    ),
                    "detour_waypoint_count": 0,
                    "energy": legacy_energy(battery),
                    "battery_analysis": battery,
                    "airspace": airspace,
                    "mission_assessment": assess_mission(
                        airspace,
                        battery,
                        "not_requested",
                    ),
                    "message": (
                        "Automatic detour generation is disabled."
                    ),
                }

            if not zones:

                battery = battery_analysis(original_route)

                airspace = {
                    "is_clear": True,
                    "violations": [],
                    "violation_count": 0,
                }

                return {
                    "status": "clear",
                    "route": original_route,
                    "distance_km": round(
                        route_distance_km(route),
                        3,
                    ),
                    "detour_waypoint_count": 0,
                    "energy": legacy_energy(battery),
                    "battery_analysis": battery,
                    "airspace": airspace,
                    "mission_assessment": assess_mission(
                        airspace,
                        battery,
                        "clear",
                    ),
                    "message": (
                        "No restricted zones were supplied."
                    ),
                }

            detour = generate_detour_route(
                original_route,
                zones,
                safety_margin_km=request.safety_margin_km,
            )

            if detour["status"] != "clear":

                failed_airspace = {
                    "is_clear": False,
                    "violations": [],
                    "violation_count": 0,
                }

                return {
                    **detour,
                    "energy": None,
                    "battery_analysis": None,
                    "airspace": failed_airspace,
                    "mission_assessment": assess_mission(
                        failed_airspace,
                        None,
                        detour["status"],
                    ),
                }

            generated_route = detour["route"]

            airspace_result = check_route_airspace(
                generated_route,
                zones,
            )

            if not airspace_result["is_clear"]:

                return {
                    **detour,
                    "status": "no_feasible_route",
                    "energy": None,
                    "battery_analysis": None,
                    "airspace": airspace_result,
                    "mission_assessment": assess_mission(
                        airspace_result,
                        None,
                        "no_feasible_route",
                    ),
                    "message": (
                        "The generated route did not pass "
                        "the original airspace validation."
                    ),
                }

            battery = battery_analysis(generated_route)

            return {
                **detour,
                "energy": legacy_energy(battery),
                "battery_analysis": battery,
                "airspace": airspace_result,
                "mission_assessment": assess_mission(
                    airspace_result,
                    battery,
                    "clear",
                ),
                "message": (
                    "The generated detour passed the available "
                    "geometric checks. Battery feasibility is "
                    "assessed separately."
                ),
            }

        # -------------------------------------------------
        # ALGORITHM RESULT
        # -------------------------------------------------

        def algorithm_result(
            route,
            distance,
            execution_time,
            airspace,
        ):

            original_route = format_route(route)

            battery = battery_analysis(original_route)

            detour = build_detour(route)

            return {
                "route": original_route,
                "distance_km": round(distance, 3),
                "waypoints_visited": len(route),
                "execution_time_ms": round(
                    execution_time,
                    3,
                ),
                "energy": legacy_energy(battery),
                "battery_analysis": battery,
                "airspace": airspace,
                "route_status": (
                    "clear"
                    if airspace["is_clear"]
                    else "blocked"
                ),
                "mission_assessment": assess_mission(
                    airspace,
                    battery,
                ),
                "detour": detour,
            }

        ga_result = algorithm_result(
            ga_route,
            ga_distance,
            ga_time,
            ga_airspace,
        )

        dijkstra_result = algorithm_result(
            dijkstra_route,
            dijkstra_distance,
            dijkstra_time,
            dijkstra_airspace,
        )

        astar_result = algorithm_result(
            astar_route,
            astar_distance,
            astar_time,
            astar_airspace,
        )

        # -------------------------------------------------
        # COMPARISON AND SUMMARIES
        # -------------------------------------------------

        all_visit_waypoints = all(
            len(route) == len(points)
            for route in [
                ga_route,
                dijkstra_route,
                astar_route,
            ]
        )

        all_routes_clear = all(
            result["airspace"]["is_clear"]
            for result in [
                ga_result,
                dijkstra_result,
                astar_result,
            ]
        )

        fastest_algorithm = min(
            [
                ("genetic_algorithm", ga_time),
                ("dijkstra", dijkstra_time),
                ("a_star", astar_time),
            ],
            key=lambda item: item[1],
        )[0]

        algorithm_results = {
            "genetic_algorithm": ga_result,
            "dijkstra": dijkstra_result,
            "a_star": astar_result,
        }

        all_original_missions_feasible = all(
            result["mission_assessment"]["mission_feasible"]
            for result in algorithm_results.values()
        )

        detour_results = [
            ga_result["detour"],
            dijkstra_result["detour"],
            astar_result["detour"],
        ]

        feasible_detours = [
            result
            for result in detour_results
            if result["status"] == "clear"
        ]

        all_detours_clear = (
            len(feasible_detours) == 3
            if request.avoid_no_fly_zones
            else False
        )

        all_detour_missions_feasible = (
            len([
                result
                for result in detour_results
                if result.get(
                    "mission_assessment", {}
                ).get("mission_feasible", False)
            ]) == 3
            if request.avoid_no_fly_zones
            else False
        )

        ga_battery = ga_result["battery_analysis"]

        return {
            "status": "success",
            "api_version": "1.5.0",

            "genetic_algorithm": ga_result,
            "dijkstra": dijkstra_result,
            "a_star": astar_result,

            "comparison": {
                "shortest_distance_km": round(
                    min(
                        ga_distance,
                        dijkstra_distance,
                        astar_distance,
                    ),
                    3,
                ),
                "fastest_algorithm": fastest_algorithm,
                "all_algorithms_visit_all_waypoints": (
                    all_visit_waypoints
                ),
                "all_routes_airspace_clear": all_routes_clear,
                "all_original_missions_battery_and_airspace_feasible": (
                    all_original_missions_feasible
                ),
                "all_detours_geometrically_clear": all_detours_clear,
                "all_detour_missions_feasible": (
                    all_detour_missions_feasible
                ),
            },

            "airspace_summary": {
                "zones_checked": len(zones),
                "all_routes_clear": all_routes_clear,
                "mission_status": (
                    "clear"
                    if all_routes_clear
                    else "blocked"
                ),
                "note": (
                    "Original algorithm routes are checked against "
                    "the submitted restricted zones."
                ),
            },

            "detour_summary": {
                "enabled": request.avoid_no_fly_zones,
                "safety_margin_km": request.safety_margin_km,
                "feasible_detour_count": len(feasible_detours),
                "total_detour_count": len(detour_results),
                "all_detours_geometrically_clear": all_detours_clear,
                "all_detour_missions_feasible": (
                    all_detour_missions_feasible
                ),
                "mission_status": (
                    "feasible"
                    if all_detour_missions_feasible
                    else (
                        "geometrically_clear_but_battery_infeasible"
                        if all_detours_clear
                        else (
                            "not_requested"
                            if not request.avoid_no_fly_zones
                            else "blocked_or_infeasible"
                        )
                    )
                ),
                "note": (
                    "Detour paths use approximate local 2D geometry. "
                    "They are not official aviation clearance."
                ),
            },

            "battery_summary": {
                "battery_capacity_wh": (
                    request.battery_capacity_wh
                ),
                "energy_per_km_wh": (
                    request.energy_per_km_wh
                ),
                "reserve_percentage": (
                    request.battery_reserve_percentage
                ),
                "reserve_energy_wh": (
                    ga_battery["reserve_energy_wh"]
                ),
                "usable_energy_wh": (
                    ga_battery["usable_energy_wh"]
                ),
                "genetic_algorithm_battery_feasible": (
                    ga_battery["battery_feasible"]
                ),
                "genetic_algorithm_battery_status": (
                    ga_battery["battery_status"]
                ),
                "genetic_algorithm_energy_required_wh": (
                    ga_battery["total_energy_required_wh"]
                ),
                "genetic_algorithm_projected_remaining_wh": (
                    ga_battery["projected_remaining_energy_wh"]
                ),
                "note": (
                    "Battery feasibility includes the configured reserve."
                ),
            },

            "note": (
                "Energy is estimated using distance multiplied by "
                "the configured Wh/km value. Wind, payload, altitude, "
                "hover time and other flight dynamics are not modelled. "
                "Airspace checks use approximate geometry and are not "
                "official aviation clearance or flight authorization."
            ),
        }

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error),
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Optimization failed: {str(error)}",
        )


# =========================================================
# LIVE WEATHER INTEGRATION - OPEN-METEO
# =========================================================

OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
)

WEATHER_FIELDS = (
    "temperature_2m,"
    "relative_humidity_2m,"
    "apparent_temperature,"
    "is_day,"
    "precipitation,"
    "rain,"
    "showers,"
    "weather_code,"
    "wind_speed_10m,"
    "wind_direction_10m,"
    "wind_gusts_10m"
)


def fetch_live_weather(
    latitude: float,
    longitude: float,
):
    """
    Retrieve current weather from Open-Meteo.
    """

    params = urlencode({
        "latitude": latitude,
        "longitude": longitude,
        "current": WEATHER_FIELDS,
        "timezone": "auto",
        "forecast_days": 1,
    })

    request = Request(
        f"{OPEN_METEO_URL}?{params}",
        headers={
            "Accept": "application/json",
            "User-Agent": "AeroRoute-AI/1.0",
        },
    )

    try:

        with urlopen(request, timeout=15) as response:
            data = json.loads(
                response.read().decode("utf-8")
            )

        current = data.get("current")

        if not current:
            raise ValueError(
                "Weather provider returned no current data."
            )

        return {
            "latitude": data.get("latitude"),
            "longitude": data.get("longitude"),
            "timezone": data.get("timezone"),
            "observed_at": current.get("time"),
            "temperature_c": current.get("temperature_2m"),
            "feels_like_c": current.get("apparent_temperature"),
            "humidity_percentage": current.get(
                "relative_humidity_2m"
            ),
            "precipitation_mm": current.get("precipitation"),
            "rain_mm": current.get("rain"),
            "showers_mm": current.get("showers"),
            "weather_code": current.get("weather_code"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "wind_direction_degrees": current.get(
                "wind_direction_10m"
            ),
            "wind_gusts_kmh": current.get("wind_gusts_10m"),
            "units": data.get("current_units", {}),
        }

    except Exception as error:

        raise RuntimeError(
            f"Live weather request failed: {error}"
        )


def classify_weather_risk(weather: dict):
    """
    Informational weather warning thresholds.
    These are not certified drone operating limits.
    """

    wind = weather.get("wind_speed_kmh") or 0
    gusts = weather.get("wind_gusts_kmh") or 0
    precipitation = weather.get("precipitation_mm") or 0

    warnings = []

    if gusts >= 35:
        warnings.append(
            "High wind gusts detected."
        )

    if wind >= 25:
        warnings.append(
            "Strong wind conditions detected."
        )

    if precipitation >= 2:
        warnings.append(
            "Significant precipitation detected."
        )

    if (
        gusts >= 35
        or wind >= 25
        or precipitation >= 2
    ):
        risk = "high"

    elif (
        gusts >= 20
        or wind >= 15
        or precipitation > 0
    ):
        risk = "moderate"

    else:
        risk = "low"

    return {
        "risk_level": risk,
        "warnings": warnings,
        "assessment": (
            "Weather conditions require additional review."
            if risk == "high"
            else (
                "Monitor weather before the mission."
                if risk == "moderate"
                else "No warning thresholds were triggered."
            )
        ),
    }


# =========================================================
# CURRENT WEATHER ENDPOINT
# =========================================================

@app.get("/api/weather/current")
def get_current_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):

    try:

        weather = fetch_live_weather(lat, lon)

        risk = classify_weather_risk(weather)

        return {
            "status": "success",
            "source": "Open-Meteo",
            "retrieved_at": (
                datetime.now(timezone.utc).isoformat()
            ),
            "location": {
                "latitude": lat,
                "longitude": lon,
            },
            "weather": weather,
            "safety_assessment": risk,
            "disclaimer": (
                "Weather warnings are informational. "
                "They are not certified drone operating limits "
                "or flight authorization."
            ),
        }

    except Exception as error:

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to retrieve live weather: "
                f"{str(error)}"
            ),
        )


# =========================================================
# WEATHER FOR ALL MISSION WAYPOINTS
# =========================================================

@app.post("/api/weather/route")
def assess_route_weather(
    request: WeatherRouteRequest,
):

    results = [None] * len(request.waypoints)
    errors = []

    def fetch_waypoint(index, waypoint):

        weather = fetch_live_weather(
            waypoint.lat,
            waypoint.lon,
        )

        return {
            "waypoint_index": index,
            "location": {
                "latitude": waypoint.lat,
                "longitude": waypoint.lon,
            },
            "weather": weather,
            "safety_assessment": (
                classify_weather_risk(weather)
            ),
        }

    with ThreadPoolExecutor(max_workers=5) as executor:

        futures = {
            executor.submit(
                fetch_waypoint,
                index,
                waypoint,
            ): index
            for index, waypoint in enumerate(
                request.waypoints
            )
        }

        for future in as_completed(futures):

            index = futures[future]

            try:

                results[index] = future.result()

            except Exception as error:

                errors.append({
                    "waypoint_index": index,
                    "error": str(error),
                })

    successful_results = [
        result
        for result in results
        if result is not None
    ]

    risk_levels = [
        result["safety_assessment"]["risk_level"]
        for result in successful_results
    ]

    if "high" in risk_levels:
        overall_risk = "high"

    elif "moderate" in risk_levels:
        overall_risk = "moderate"

    elif risk_levels:
        overall_risk = "low"

    else:
        overall_risk = "unavailable"

    return {
        "status": (
            "success"
            if not errors
            else (
                "partial_success"
                if successful_results
                else "unavailable"
            )
        ),
        "source": "Open-Meteo",
        "retrieved_at": (
            datetime.now(timezone.utc).isoformat()
        ),
        "waypoints_checked": len(successful_results),
        "waypoints_requested": len(request.waypoints),
        "overall_weather_risk": overall_risk,
        "waypoint_weather": successful_results,
        "errors": errors,
        "disclaimer": (
            "Weather conditions can change during a mission. "
            "This assessment is informational and does not "
            "constitute flight authorization."
        ),
    }
