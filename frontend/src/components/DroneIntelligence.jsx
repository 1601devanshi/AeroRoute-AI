
import { useState } from "react";
import {
  Activity,
  BatteryCharging,
  CloudSun,
  ShieldAlert,
  Satellite,
  RefreshCw,
  AlertCircle,
  Navigation
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function post(endpoint, body) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((item) => item.msg || "Invalid input").join(", ")
          : `Request failed (${response.status}).`;

    throw new Error(detail);
  }

  return data;
}

// Supports Leaflet coordinates and normal latitude/longitude objects.
function getPoint(point) {
  const lat = Number(
    Array.isArray(point) ? point[0] : point?.lat
  );

  const lon = Number(
    Array.isArray(point) ? point[1] : point?.lon ?? point?.lng
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    throw new Error(
      "One or more mission waypoints have invalid coordinates."
    );
  }

  return { lat, lon };
}

function ResultCard({ icon: Icon, title, value, result, detail }) {
  return (
    <div className="intelligence-card">
      <div className="intelligence-card-icon">
        <Icon size={19} />
      </div>

      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>

      {result && <small>{result}</small>}
    </div>
  );
}

export default function DroneIntelligence({
  selectedDrone,
  waypoints = []
}) {
  const [payload, setPayload] = useState("0");
  const [wind, setWind] = useState("8");
  const [battery, setBattery] = useState("80");
  const [gpsAvailable, setGpsAvailable] = useState(true);

  const [batteryResult, setBatteryResult] = useState(null);
  const [weatherResult, setWeatherResult] = useState(null);
  const [gnssResult, setGnssResult] = useState(null);
  const [fusionResult, setFusionResult] = useState(null);
  const [emergencyResult, setEmergencyResult] = useState(null);
  const [missionResult, setMissionResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAssessments() {
    if (!selectedDrone) {
      setError("Please select a drone first.");
      return;
    }

    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      setError("Add at least two mission waypoints first.");
      return;
    }

    const parsedPayload = Number(payload);
    const parsedWind = Number(wind);
    const parsedBattery = Number(battery);

    if (
      !Number.isFinite(parsedPayload) ||
      parsedPayload < 0 ||
      !Number.isFinite(parsedWind) ||
      parsedWind < 0 ||
      !Number.isFinite(parsedBattery) ||
      parsedBattery < 0 ||
      parsedBattery > 100
    ) {
      setError("Enter valid payload, wind and battery values.");
      return;
    }

    const maximumPayload = Number(
      selectedDrone.maximum_payload_kg ??
      selectedDrone.max_payload_kg
    );

    if (
      Number.isFinite(maximumPayload) &&
      parsedPayload > maximumPayload
    ) {
      setError(
        `Payload exceeds this drone's maximum capacity of ${maximumPayload} kg.`
      );
      return;
    }

    const droneId = selectedDrone.id ?? selectedDrone.drone_id;

    if (!droneId) {
      setError("The selected drone does not have a valid drone ID.");
      return;
    }

    let formattedWaypoints;

    try {
      formattedWaypoints = waypoints.map(getPoint);
    } catch (err) {
      setError(err.message);
      return;
    }

    const previousPosition = formattedWaypoints[0];
    const gpsPosition = formattedWaypoints[1];

    // Simulated IMU displacement between the first two waypoints.
    const imuDisplacement = {
      lat: gpsPosition.lat - previousPosition.lat,
      lon: gpsPosition.lon - previousPosition.lon
    };

    setLoading(true);
    setError("");

    setBatteryResult(null);
    setWeatherResult(null);
    setGnssResult(null);
    setFusionResult(null);
    setEmergencyResult(null);
    setMissionResult(null);

    try {
      // 1. Mission assessment
      const mission = await post(
        "/api/drone/mission-assessment",
        {
          waypoints: formattedWaypoints,
          drone_id: droneId,
          payload_kg: parsedPayload
        }
      );

      setMissionResult(mission);
      setBatteryResult(mission.battery_analysis || null);

      // 2. Weather, GNSS, sensor fusion and emergency assessment.
      const [
        weather,
        gnss,
        fusion,
        emergency
      ] = await Promise.all([
        post("/api/drone/weather-risk", {
          wind_speed_kmh: parsedWind,
          wind_gust_kmh: parsedWind * 1.4,
          precipitation_mm: 0,
          temperature_c: 28,
          humidity_percentage: 55
        }),

        post("/api/drone/gnss-status", {
          gps_available: gpsAvailable,
          gps_accuracy_m: gpsAvailable ? 3 : null,
          maximum_accuracy_m: 10,
          fallback_available: true
        }),

        post("/api/drone/sensor-fusion", {
          previous_position: previousPosition,
          gps_position: gpsPosition,
          imu_displacement: imuDisplacement,
          gps_valid: gpsAvailable,
          gps_weight: 0.85
        }),

        post("/api/drone/emergency-assessment", {
          drone_position: previousPosition,
          recovery_sites: [],
          battery_percentage: parsedBattery,
          wind_speed_kmh: parsedWind,
          wind_gust_kmh: parsedWind * 1.4,
          gps_available: gpsAvailable,
          obstacle_detected: false,
          maximum_recovery_distance_km: 10
        })
      ]);

      setWeatherResult(weather);
      setGnssResult(gnss);
      setFusionResult(fusion);
      setEmergencyResult(emergency);

    } catch (err) {
      setError(
        err.message || "Unable to complete mission assessment."
      );
    } finally {
      setLoading(false);
    }
  }

  const batteryPercentage =
    batteryResult?.battery_percentage_remaining ??
    batteryResult?.remaining_battery_percentage ??
    batteryResult?.battery_remaining_percentage;

  const batteryUsage =
    batteryResult?.estimated_energy_wh ??
    batteryResult?.total_energy_required_wh ??
    batteryResult?.energy_required_wh;

  const fusedPosition = fusionResult?.position;

  return (
    <section className="drone-intelligence">

      <div className="intelligence-heading">
        <div>
          <span>AI FLIGHT SYSTEMS</span>
          <h2>Drone Intelligence</h2>
          <p>
            Evaluate mission energy, weather, navigation and
            emergency conditions.
          </p>
        </div>

        <Activity size={24} />
      </div>

      {/* INPUT CONTROLS */}
    
<div
  className="intelligence-controls"
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    margin: "24px 0",
    padding: "20px",
    background: "#111d2b",
    border: "1px solid #26394d",
    borderRadius: "12px"
  }}
>
  <label style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
    Selected drone
    <strong>{selectedDrone?.name || "No drone selected"}</strong>
  </label>

  <label style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
    Payload (kg)
    <input type="number" min="0" step="0.1" value={payload}
      onChange={(e) => setPayload(e.target.value)} />
  </label>

  <label style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
    Wind speed (km/h)
    <input type="number" min="0" step="0.5" value={wind}
      onChange={(e) => setWind(e.target.value)} />
  </label>

  <label style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
    Battery remaining (%)
    <input type="number" min="0" max="100" value={battery}
      onChange={(e) => setBattery(e.target.value)} />
  </label>

  <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "12px" }}>
    GNSS available
    <input type="checkbox" checked={gpsAvailable}
      onChange={(e) => setGpsAvailable(e.target.checked)} />
  </label>


        <label>
          Selected drone
          <strong>
            {selectedDrone?.name || "No drone selected"}
          </strong>
        </label>

        <label>
          Payload (kg)
          <input
            type="number"
            min="0"
            step="0.1"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
        </label>

        <label>
          Wind speed (km/h)
          <input
            type="number"
            min="0"
            step="0.5"
            value={wind}
            onChange={(e) => setWind(e.target.value)}
          />
        </label>

        <label>
          Battery remaining (%)
          <input
            type="number"
            min="0"
            max="100"
            value={battery}
            onChange={(e) => setBattery(e.target.value)}
          />
        </label>

        <label className="intelligence-toggle">
          GNSS available
          <input
            type="checkbox"
            checked={gpsAvailable}
            onChange={(e) => setGpsAvailable(e.target.checked)}
          />
        </label>

      </div>

      {/* RUN ASSESSMENT */}
      <button
        type="button"
        className="intelligence-run"
        onClick={runAssessments}
        disabled={loading}
      >
        <RefreshCw
          size={16}
          className={loading ? "intelligence-spin" : ""}
        />

        {loading
          ? "Analysing mission..."
          : "Run Intelligence Assessment"}
      </button>

      {/* ERROR */}
      {error && (
        <div className="intelligence-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* RESULTS */}
      <div className="intelligence-results">

        <ResultCard
          icon={BatteryCharging}
          title="Battery Intelligence"
          value={
            batteryPercentage != null
              ? `${batteryPercentage}%`
              : "--"
          }
          result={
            batteryResult?.status ||
            (missionResult ? "Assessment received" : null)
          }
          detail={
            batteryUsage != null
              ? `${batteryUsage} Wh estimated usage`
              : "Waiting for assessment"
          }
        />

        <ResultCard
          icon={CloudSun}
          title="Weather Risk"
          value={weatherResult?.risk_level || "--"}
          result={
            weatherResult
              ? `Risk score: ${weatherResult.risk_score ?? "N/A"}/100`
              : null
          }
          detail={
            Array.isArray(weatherResult?.reasons)
              ? weatherResult.reasons.join(", ")
              : weatherResult?.warning || "Waiting for assessment"
          }
        />

        <ResultCard
          icon={Satellite}
          title="GNSS Navigation"
          value={
            gnssResult?.status ||
            (gnssResult?.gps_available === true
              ? "Available"
              : "--")
          }
          result={gnssResult?.navigation_mode}
          detail={
            gnssResult?.warning || "Waiting for assessment"
          }
        />

        <ResultCard
          icon={Navigation}
          title="Sensor Fusion"
          value={
            fusionResult?.navigation_mode || "--"
          }
          result={
            fusionResult
              ? `Sources: ${
                  fusionResult.sensor_sources?.join(" + ") || "N/A"
                }`
              : null
          }
          detail={
            fusedPosition
              ? `Position: ${Number(fusedPosition.lat).toFixed(5)}, ${Number(fusedPosition.lon).toFixed(5)}`
              : "Waiting for assessment"
          }
        />

        <ResultCard
          icon={ShieldAlert}
          title="Emergency Assessment"
          value={emergencyResult?.emergency_level || "--"}
          result={emergencyResult?.recommended_action}
          detail={
            Array.isArray(emergencyResult?.reasons)
              ? emergencyResult.reasons.join(", ")
              : emergencyResult?.warning || "Waiting for assessment"
          }
        />

      </div>

      {/* MISSION STATUS */}
      {missionResult && (
        <div className="intelligence-mission-status">
          <span>MISSION ASSESSMENT</span>

          <strong>
            {missionResult.status ||
              (missionResult.mission_feasible === true
                ? "Feasible"
                : missionResult.mission_feasible === false
                  ? "Not feasible"
                  : "Assessment received")}
          </strong>
        </div>
      )}

      <p className="intelligence-disclaimer">
        Simulation only. Results are estimates based on configured
        assumptions and simulated sensor data. They are not certified
        flight instructions or official flight authorization.
      </p>

    </section>
  );
}
