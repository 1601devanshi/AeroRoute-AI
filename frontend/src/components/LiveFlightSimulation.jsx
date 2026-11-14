
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  CircleMarker,
  useMap
} from "react-leaflet";
import {
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  BatteryCharging,
  Gauge,
  Navigation,
  Plane,
  Activity
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./LiveFlightSimulation.css";

function normalizePoint(point) {
  if (Array.isArray(point) && point.length >= 2) {
    return [Number(point[0]), Number(point[1])];
  }

  if (point && typeof point === "object") {
    const lat = Number(point.lat ?? point.latitude);
    const lon = Number(point.lon ?? point.lng ?? point.longitude);

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [lat, lon];
    }
  }

  return null;
}

function distanceBetween(a, b) {
  const rad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;

  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);

  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) *
      Math.cos(rad(b[0])) *
      Math.sin(dLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function getRouteDistance(points) {
  return points.slice(1).reduce(
    (total, point, index) =>
      total + distanceBetween(points[index], point),
    0
  );
}

function getPositionOnRoute(points, progress) {
  if (points.length === 0) return [26.9124, 75.7873];
  if (points.length === 1) return points[0];

  const totalDistance = getRouteDistance(points);
  if (totalDistance === 0) return points[0];

  let remainingDistance = totalDistance * progress;

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const segmentDistance = distanceBetween(start, end);

    if (remainingDistance <= segmentDistance) {
      const fraction =
        segmentDistance === 0 ? 0 : remainingDistance / segmentDistance;

      return [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction
      ];
    }

    remainingDistance -= segmentDistance;
  }

  return points[points.length - 1];
}

function RouteBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [45, 45] });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [map, points]);

  return null;
}

const droneIcon = L.divIcon({
  className: "simulation-drone-icon",
  html: '<div class="simulation-drone-marker">✈</div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19]
});

export default function LiveFlightSimulation({
  waypoints = [],
  selectedDrone = null
}) {
  const [progress, setProgress] = useState(0);
  const [battery, setBattery] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("READY");
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  const routePoints = useMemo(
    () => waypoints.map(normalizePoint).filter(Boolean),
    [waypoints]
  );

  const totalDistance = useMemo(
    () => getRouteDistance(routePoints),
    [routePoints]
  );

  const dronePosition = useMemo(
    () => getPositionOnRoute(routePoints, progress),
    [routePoints, progress]
  );

  const coveredDistance = totalDistance * progress;
  const remainingDistance = Math.max(0, totalDistance - coveredDistance);

  const droneName =
    selectedDrone?.name ||
    selectedDrone?.model ||
    selectedDrone?.drone_name ||
    "Selected Drone";

  useEffect(() => {
    if (!isRunning) return undefined;

    const timer = setInterval(() => {
      setProgress((current) => {
        const next = Math.min(1, current + 0.002 * speedMultiplier);

        if (next >= 1) {
          setIsRunning(false);
          setStatus("COMPLETED");
        }

        return next;
      });

      setBattery((current) => Math.max(0, current - 0.025 * speedMultiplier));
    }, 250);

    return () => clearInterval(timer);
  }, [isRunning, speedMultiplier]);

  useEffect(() => {
    if (battery <= 0 && isRunning) {
      setIsRunning(false);
      setStatus("BATTERY DEPLETED");
    }
  }, [battery, isRunning]);

  function startSimulation() {
    if (routePoints.length < 2) {
      setStatus("ADD WAYPOINTS");
      return;
    }

    if (battery <= 0) {
      setStatus("RESET REQUIRED");
      return;
    }

    if (progress >= 1) {
      setProgress(0);
      setBattery(100);
    }

    setStatus("IN FLIGHT");
    setIsRunning(true);
  }

  function pauseSimulation() {
    setIsRunning(false);
    setStatus("PAUSED");
  }

  function stopSimulation() {
    setIsRunning(false);
    setStatus("EMERGENCY STOP");
  }

  function resetSimulation() {
    setIsRunning(false);
    setProgress(0);
    setBattery(100);
    setStatus("READY");
  }

  return (
    <section className="live-simulation">
      <div className="simulation-heading">
        <div>
          <span className="simulation-eyebrow">FLIGHT OPERATIONS</span>
          <h2>Live Flight Simulation</h2>
          <p>Simulated drone movement and mission telemetry</p>
        </div>

        <span className={`simulation-status ${status.toLowerCase().replaceAll(" ", "-")}`}>
          <span className="status-dot" />
          {status}
        </span>
      </div>

      <div className="simulation-metrics">
        <div className="simulation-metric">
          <span><BatteryCharging size={17} /> Battery</span>
          <strong>{Math.round(battery)}%</strong>
          <div className="metric-progress">
            <div
              style={{ width: `${battery}%` }}
              className={battery < 25 ? "battery-low" : ""}
            />
          </div>
        </div>

        <div className="simulation-metric">
          <span><Gauge size={17} /> Simulated speed</span>
          <strong>{isRunning ? 28 * speedMultiplier : 0} km/h</strong>
          <small>{isRunning ? "Drone moving" : "Drone stationary"}</small>
        </div>

        <div className="simulation-metric">
          <span><Navigation size={17} /> Distance covered</span>
          <strong>{coveredDistance.toFixed(2)} km</strong>
          <small>{remainingDistance.toFixed(2)} km remaining</small>
        </div>

        <div className="simulation-metric">
          <span><Activity size={17} /> Route progress</span>
          <strong>{Math.round(progress * 100)}%</strong>
          <small>{routePoints.length} waypoints loaded</small>
        </div>
      </div>

      <div className="simulation-main">
        <div className="simulation-map-panel">
          <div className="simulation-map-heading">
            <div>
              <strong>Mission Route</strong>
              <small>{droneName}</small>
            </div>
            <span className="map-live-label">
              <span className="status-dot" /> SIMULATION
            </span>
          </div>

          <div className="simulation-map">
            <MapContainer
              center={routePoints[0] || [26.9124, 75.7873]}
              zoom={6}
              scrollWheelZoom
              className="simulation-leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <RouteBounds points={routePoints} />

              {routePoints.length > 1 && (
                <>
                  <Polyline
                    positions={routePoints}
                    pathOptions={{
                      color: "#64748b",
                      weight: 4,
                      dashArray: "8 8"
                    }}
                  />
                  <Polyline
                    positions={[
                      ...routePoints.slice(
                        0,
                        Math.max(1, Math.ceil(progress * (routePoints.length - 1)) + 1)
                      ),
                      dronePosition
                    ]}
                    pathOptions={{
                      color: "#22d3ee",
                      weight: 5
                    }}
                  />
                </>
              )}

              {routePoints.map((point, index) => (
                <CircleMarker
                  key={`${point[0]}-${point[1]}-${index}`}
                  center={point}
                  radius={7}
                  pathOptions={{
                    color: "#0f172a",
                    fillColor: "#38bdf8",
                    fillOpacity: 1,
                    weight: 2
                  }}
                />
              ))}

              {routePoints.length > 0 && (
                <Marker position={dronePosition} icon={droneIcon} />
              )}
            </MapContainer>
          </div>

          {routePoints.length < 2 && (
            <div className="simulation-map-empty">
              Add at least two waypoints in Mission Planner to start the simulation.
            </div>
          )}
        </div>

        <aside className="simulation-control-panel">
          <div className="simulation-control-title">
            <Plane size={19} />
            <strong>Flight Controls</strong>
          </div>

          <div className="simulation-drone-info">
            <span>ACTIVE DRONE</span>
            <strong>{droneName}</strong>
            <small>{routePoints.length} route waypoints</small>
          </div>

          <label className="simulation-speed-label" htmlFor="simulation-speed">
            Simulation speed
          </label>

          <select
            id="simulation-speed"
            value={speedMultiplier}
            onChange={(event) => setSpeedMultiplier(Number(event.target.value))}
            disabled={isRunning}
          >
            <option value={0.5}>0.5x — Slow</option>
            <option value={1}>1x — Normal</option>
            <option value={2}>2x — Fast</option>
            <option value={4}>4x — Very fast</option>
          </select>

          <div className="simulation-buttons">
            {!isRunning ? (
              <button
                type="button"
                className="simulation-button simulation-start"
                onClick={startSimulation}
                disabled={routePoints.length < 2 || battery <= 0}
              >
                <Play size={17} /> Start Flight
              </button>
            ) : (
              <button
                type="button"
                className="simulation-button simulation-pause"
                onClick={pauseSimulation}
              >
                <Pause size={17} /> Pause Flight
              </button>
            )}

            <button
              type="button"
              className="simulation-button simulation-reset"
              onClick={resetSimulation}
            >
              <RotateCcw size={17} /> Reset
            </button>

            <button
              type="button"
              className="simulation-button simulation-emergency"
              onClick={stopSimulation}
              disabled={!isRunning}
            >
              <ShieldAlert size={17} /> Emergency Stop
            </button>
          </div>

          <div className="simulation-warning">
            <ShieldAlert size={17} />
            <p>
              This is a software simulation. It does not control a physical drone
              or provide real-time aircraft telemetry.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
