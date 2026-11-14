
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// =========================================================
// COMMON API HELPERS
// =========================================================

async function handleResponse(response) {
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message =
      typeof data.detail === "string"
        ? data.detail
        : data.detail
          ? JSON.stringify(data.detail)
          : `API request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}

async function getJSON(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return handleResponse(response);
}

async function postJSON(path, payload = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

// =========================================================
// WAYPOINT NORMALIZER
// Accepts [lat, lon] or {lat, lon}
// =========================================================

function normalizeWaypoints(waypoints = []) {
  if (!Array.isArray(waypoints)) {
    throw new Error("Waypoints must be an array.");
  }

  return waypoints.map((point) => {
    const lat = Array.isArray(point)
      ? Number(point[0])
      : Number(point.lat);

    const lon = Array.isArray(point)
      ? Number(point[1])
      : Number(point.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error("Every waypoint must have valid lat and lon values.");
    }

    return { lat, lon };
  });
}

// =========================================================
// EXISTING APIs - PRESERVED
// =========================================================

// Demo no-fly zones
export async function getDemoNoFlyZones() {
  return getJSON("/api/demo-no-fly-zones");
}

// Route optimization
export async function optimizeRoute(
  waypoints,
  settings = {},
  noFlyZones = []
) {
  const payload = {
    waypoints: normalizeWaypoints(waypoints),

    population_size: Number(settings.populationSize ?? 80),
    generations: Number(settings.generations ?? 250),

    battery_capacity_wh: Number(settings.batteryCapacity ?? 150),
    energy_per_km_wh: Number(settings.energyPerKm ?? 25),
    battery_reserve_percentage: Number(settings.batteryReserve ?? 20),

    avoid_no_fly_zones: settings.avoidNoFlyZones ?? true,
    safety_margin_km: Number(settings.safetyMargin ?? 1),

    no_fly_zones: noFlyZones,
  };

  return postJSON("/api/optimize", payload);
}

// Current weather
export async function getCurrentWeather(lat, lon) {
  if (
    !Number.isFinite(Number(lat)) ||
    !Number.isFinite(Number(lon))
  ) {
    throw new Error("Valid latitude and longitude are required.");
  }

  const params = new URLSearchParams({
    lat: String(Number(lat)),
    lon: String(Number(lon)),
  });

  return getJSON(`/api/weather/current?${params.toString()}`);
}

// Weather for mission waypoints
export async function getRouteWeather(waypoints) {
  const normalized = normalizeWaypoints(waypoints);

  if (normalized.length < 2) {
    throw new Error("At least two mission waypoints are required.");
  }

  return postJSON("/api/weather/route", {
    waypoints: normalized,
  });
}

// Backend health check
export async function checkBackendHealth() {
  return getJSON("/health");
}

// =========================================================
// DRONE FLEET
// =========================================================

// Get all available drones
export async function getDroneFleet() {
  return getJSON("/api/drone/fleet");
}

export async function listMissions() {
  return getJSON("/api/missions");
}

export async function saveMission(payload) {
  return postJSON("/api/missions", payload);
}

// Get one drone's details
export async function getDroneDetails(droneId) {
  if (!droneId) {
    throw new Error("A drone ID is required.");
  }

  return getJSON(
    `/api/drone/fleet/${encodeURIComponent(droneId)}`
  );
}

// Recommend a drone for a mission
export async function recommendDrone(payload) {
  return postJSON("/api/drone/fleet/recommend", payload);
}

// =========================================================
// BATTERY AND PAYLOAD
// =========================================================

export async function analyzeBattery(payload) {
  return postJSON("/api/drone/battery-analysis", payload);
}

// =========================================================
// SENSOR FUSION AND GNSS
// =========================================================

// Pass the complete request body matching FusionRequest.
export async function runSensorFusion(payload) {
  return postJSON("/api/drone/sensor-fusion", payload);
}

// GNSS availability and fallback assessment
export async function getGnssStatus(payload) {
  return postJSON("/api/drone/gnss-status", payload);
}

// =========================================================
// WEATHER INTELLIGENCE
// =========================================================

export async function assessWeatherRisk(payload) {
  return postJSON("/api/drone/weather-risk", payload);
}

// =========================================================
// EMERGENCY MANAGEMENT
// =========================================================

export async function assessEmergency(payload) {
  return postJSON("/api/drone/emergency-assessment", payload);
}

export async function requestEmergencyRecovery(payload) {
  return postJSON("/api/drone/emergency-recovery", payload);
}

// =========================================================
// PRECISION LANDING
// =========================================================

export async function simulatePrecisionLanding(payload) {
  return postJSON("/api/drone/precision-landing", payload);
}

// =========================================================
// MISSION ASSESSMENT
// =========================================================

export async function assessMission(payload) {
  return postJSON("/api/drone/mission-assessment", payload);
}

// =========================================================
// DYNAMIC REROUTING
// =========================================================

export async function requestDynamicReroute(payload) {
  return postJSON("/api/drone/dynamic-rerouting", payload);
}

// =========================================================
// FLIGHT SAFETY
// =========================================================

export async function assessFlightSafety(payload) {
  return postJSON("/api/drone/flight-safety", payload);
}

// =========================================================
// ADAPTIVE GENETIC ALGORITHM
// =========================================================

export async function runAdaptiveGA(payload) {
  return postJSON("/api/drone/adaptive-ga", payload);
}

// =========================================================
// FLIGHT OPERATIONS
// =========================================================

// Mission monitoring
export async function monitorMission(payload) {
  return postJSON("/api/operations/mission-monitor", payload);
}

// Route analysis
export async function analyzeRoute(payload) {
  return postJSON("/api/operations/route-analysis", payload);
}

// Landing zone analysis
export async function analyzeLandingZones(payload) {
  return postJSON("/api/operations/landing-zones", payload);
}
