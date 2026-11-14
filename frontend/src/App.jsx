
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Radio,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudRain,
  Compass,
  Crosshair,
  Gauge,
  History,
  Layers3,
  Map as MapIcon,
  MapPin,
  Menu,
  Navigation,
  Plane,
  Play,
  Plus,
  RefreshCw,
  Route,
  Satellite,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Thermometer,
  Timer,
  Trash2,
  TrendingUp,
  Wind,
  X,
  Zap
} from "lucide-react";

import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import RouteOptimization from "./RouteOptimization";
import DroneFleet from "./components/DroneFleet";
import DroneIntelligence from "./components/DroneIntelligence";
import LiveFlightSimulation from "./components/LiveFlightSimulation";

import {
  checkBackendHealth,
  getCurrentWeather,
  getDemoNoFlyZones,
  getRouteWeather
} from "./api.js";

import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/* =========================================================
   NAVIGATION CONFIGURATION
========================================================= */

const NAV_GROUPS = [
  {
    title: "OPERATIONS",
    items: [
      ["Command Centre", Gauge],
      ["Drone Fleet", Plane],
      ["Mission Planner", MapIcon],
      ["AI Route Optimizer", Sparkles],
      ["Live Operations", Radio]
    ]
  },
  {
    title: "INTELLIGENCE",
    items: [
      ["Navigation & Landing", Crosshair],
      ["Safety & Airspace", ShieldCheck],
      ["Weather Intelligence", Cloud]
    ]
  },
  {
    title: "INSIGHTS",
    items: [
      ["Mission Analytics", TrendingUp],
      ["Mission History", History]
    ]
  },
  {
    title: "SYSTEM",
    items: [["Administration", Settings]]
  }
];

const PAGE_META = {
  "Command Centre": [
    "OPERATIONS OVERVIEW",
    "Command Centre",
    "Your operational picture, fleet readiness and mission activity at a glance."
  ],

  "Drone Fleet": [
    "FLEET MANAGEMENT",
    "Drone Fleet",
    "Select and manage aircraft available to your mission workspace."
  ],

  "Mission Planner": [
    "MISSION DESIGN",
    "Mission Planner",
    "Build a waypoint mission on the map and prepare it for optimization."
  ],

  "AI Route Optimizer": [
    "ROUTE INTELLIGENCE",
    "AI Route Optimizer",
    "Compare route strategies and inspect feasibility before simulation."
  ],

  "Live Operations": [
    "SIMULATION CONTROL",
    "Live Operations",
    "Run a simulated mission and monitor aircraft telemetry."
  ],

  "Navigation & Landing": [
    "NAVIGATION SYSTEMS",
    "Navigation & Landing",
    "Review GNSS availability, fallback concepts and landing assessments."
  ],

  "Safety & Airspace": [
    "FLIGHT SAFETY",
    "Safety & Airspace",
    "Review demonstration restrictions and official Indian airspace references."
  ],

  "Weather Intelligence": [
    "ENVIRONMENTAL INTELLIGENCE",
    "Weather Intelligence",
    "Inspect current and route-wise weather information from the connected provider."
  ],

  "Mission Analytics": [
    "PERFORMANCE INSIGHTS",
    "Mission Analytics",
    "Review this session's mission and simulation performance."
  ],

  "Mission History": [
    "MISSION RECORDS",
    "Mission History",
    "Review mission records saved in this browser session."
  ],

  "Administration": [
    "SYSTEM CONFIGURATION",
    "Administration",
    "Configure the local workspace and inspect service connectivity."
  ]
};

/* =========================================================
   MAP MARKERS
========================================================= */

const droneMarker = L.divIcon({
  className: "ar-drone-marker",
  html: '<div class="ar-drone-marker-core"><span></span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const waypointIcon = (number) =>
  L.divIcon({
    className: "ar-waypoint-marker",
    html: `<div class="ar-waypoint-marker-core">${number}</div>`,
    iconSize: [27, 27],
    iconAnchor: [13, 13]
  });

/* =========================================================
   MAP HELPERS
========================================================= */

function MapClickCapture({ onAdd }) {
  useMapEvents({
    click(event) {
      onAdd([event.latlng.lat, event.latlng.lng]);
    }
  });

  return null;
}

function FitRoute({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points?.length) return;

    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(points, {
        padding: [42, 42],
        maxZoom: 12
      });
    }
  }, [map, points]);

  return null;
}

function haversineKm(a, b) {
  const rad = (value) => (value * Math.PI) / 180;

  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);

  const lat1 = rad(a[0]);
  const lat2 = rad(b[0]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function routeDistance(points = []) {
  return points.slice(1).reduce((sum, point, index) => {
    return sum + haversineKm(points[index], point);
  }, 0);
}

function formatCoord(value) {
  return Number(value).toFixed(5);
}

function getWeatherValue(data, keys, fallback = "—") {
  for (const key of keys) {
    const value = key
      .split(".")
      .reduce((obj, part) => obj?.[part], data);

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return fallback;
}

/* =========================================================
   REUSABLE UI COMPONENTS
========================================================= */

function MetricCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  trend,
  tone = "cyan"
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={17} />
        </span>
      </div>

      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>

      <div className="metric-bottom">
        <span>{detail}</span>

        {trend && (
          <span className="metric-trend">
            <ArrowUpRight size={13} />
            {trend}
          </span>
        )}
      </div>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>

      {action}
    </div>
  );
}

function StatusPill({ children, tone = "green" }) {
  return (
    <span className={`status-pill status-${tone}`}>
      <i />
      {children}
    </span>
  );
}

function EmptyPanel({
  icon: Icon = MapPin,
  title,
  detail
}) {
  return (
    <div className="empty-panel">
      <div className="empty-icon">
        <Icon size={22} />
      </div>

      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

/* =========================================================
   MISSION MAP
========================================================= */

function MissionMap({
  waypoints = [],
  onAdd,
  noFlyZones = [],
  dronePosition,
  compact = false
}) {
  const center = waypoints[0] || [22.9734, 78.6569];

  return (
    <div className={`map-frame ${compact ? "map-compact" : ""}`}>
      <MapContainer
        center={center}
        zoom={waypoints.length ? 9 : 5}
        scrollWheelZoom
        className="mission-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {!compact && onAdd && (
          <MapClickCapture onAdd={onAdd} />
        )}

        <FitRoute points={waypoints} />

        {waypoints.length > 1 && (
          <Polyline
            positions={waypoints}
            pathOptions={{
              color: "#43d9e8",
              weight: 4,
              opacity: 0.95
            }}
          />
        )}

        {waypoints.map((point, index) => (
          <Marker
            key={`${point[0]}-${point[1]}-${index}`}
            position={point}
            icon={waypointIcon(index + 1)}
          />
        ))}

        {dronePosition && (
          <Marker
            position={dronePosition}
            icon={droneMarker}
          />
        )}

        {noFlyZones.map((zone, index) => {
          const type = String(
            zone?.type || zone?.shape || ""
          ).toLowerCase();

          if (type !== "circle") return null;

          const centerPoint =
            zone.center || zone.coordinates;

          const latLng = Array.isArray(centerPoint)
            ? centerPoint
            : [
                centerPoint?.lat,
                centerPoint?.lon ?? centerPoint?.lng
              ];

          const radius =
            Number(zone.radius_km ?? zone.radius ?? 0) *
            1000;

          if (
            !Number.isFinite(latLng[0]) ||
            !Number.isFinite(latLng[1]) ||
            !radius
          ) {
            return null;
          }

          return (
            <Circle
              key={`zone-${index}`}
              center={latLng}
              radius={radius}
              pathOptions={{
                color: "#ff6478",
                fillColor: "#ff6478",
                fillOpacity: 0.13,
                weight: 2,
                dashArray: "5 5"
              }}
            />
          );
        })}
      </MapContainer>

      <div className="map-attribution-chip">
        <span className="map-live-dot" />
        INDIA OPERATIONS MAP
      </div>

      {!compact && (
        <div className="map-instruction">
          <MapPin size={13} />
          Click anywhere to add a waypoint
        </div>
      )}

      <div className="map-legend">
        <span>
          <i className="legend-route" />
          Planned route
        </span>

        <span>
          <i className="legend-zone" />
          Demo restricted zone
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   COMMAND CENTRE
========================================================= */

function CommandCentre({
  waypoints,
  onNavigate,
  backendOnline,
  selectedDrone,
  missionCount,
  weather
}) {
  const distance = routeDistance(waypoints);

  return (
    <div className="page-stack">
      <section className="welcome-banner">
        <div className="welcome-copy">
          <div className="welcome-kicker">
            <span className="pulse-dot" />
            AEROROUTE INTELLIGENCE PLATFORM
          </div>

          <h2>
            Mission clarity.
            <br />
            <em>Operational confidence.</em>
          </h2>

          <p>
            Plan, evaluate and simulate UAV missions
            from one connected operations workspace.
          </p>

          <div className="welcome-actions">
            <button
              className="btn-primary"
              onClick={() => onNavigate("Mission Planner")}
            >
              <Plus size={16} />
              Create mission
            </button>

            <button
              className="btn-ghost"
              onClick={() => onNavigate("Live Operations")}
            >
              <Play size={15} />
              Open simulator
            </button>
          </div>
        </div>

        <div className="welcome-visual" aria-hidden="true">
          <div className="radar-ring ring-a" />
          <div className="radar-ring ring-b" />
          <div className="radar-ring ring-c" />
          <div className="radar-cross horizontal" />
          <div className="radar-cross vertical" />
          <div className="radar-sweep" />
          <div className="radar-aircraft">
            <Plane size={34} />
          </div>
          <span className="radar-caption">
            UAV / COMMAND LINK
          </span>
          <span className="radar-coordinate">
            26°54' N · 75°47' E
          </span>
        </div>
      </section>

      <div className="metric-grid">
        <MetricCard
          label="FLEET ASSETS"
          value="06"
          detail="Sample fleet overview"
          icon={Plane}
          tone="cyan"
        />

        <MetricCard
          label="MISSIONS IN SESSION"
          value={String(missionCount).padStart(2, "0")}
          detail="Browser session records"
          icon={Route}
          tone="blue"
        />

        <MetricCard
          label="PLANNED DISTANCE"
          value={distance.toFixed(1)}
          unit=" km"
          detail="Current waypoint route"
          icon={Navigation}
          tone="violet"
        />

        <MetricCard
          label="BACKEND LINK"
          value={backendOnline ? "Online" : "Offline"}
          detail={
            backendOnline
              ? "API health check passed"
              : "Check FastAPI service"
          }
          icon={Activity}
          tone={backendOnline ? "green" : "amber"}
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel panel-map">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                GEOSPATIAL OVERVIEW
              </span>
              <h3>Mission workspace</h3>
            </div>

            <button
              className="text-action"
              onClick={() => onNavigate("Mission Planner")}
            >
              Open map
              <ChevronRight size={15} />
            </button>
          </div>

          <MissionMap
            waypoints={waypoints}
            compact
          />

          <div className="map-summary-row">
            <div>
              <span>ACTIVE WAYPOINTS</span>
              <strong>{waypoints.length}</strong>
            </div>

            <div>
              <span>ROUTE DISTANCE</span>
              <strong>{distance.toFixed(2)} km</strong>
            </div>

            <div>
              <span>SELECTED AIRCRAFT</span>
              <strong>
                {selectedDrone?.name || "Not selected"}
              </strong>
            </div>
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                SYSTEM MONITOR
              </span>
              <h3>Operational status</h3>
            </div>

            <span className="panel-live">
              <i />
              LIVE
            </span>
          </div>

          <div className="system-status-list">
            <div className="system-status-item">
              <span className="system-status-icon">
                <Activity size={16} />
              </span>

              <div>
                <strong>API gateway</strong>
                <small>FastAPI service</small>
              </div>

              <StatusPill
                tone={backendOnline ? "green" : "amber"}
              >
                {backendOnline ? "Connected" : "Offline"}
              </StatusPill>
            </div>

            <div className="system-status-item">
              <span className="system-status-icon">
                <Cloud size={16} />
              </span>

              <div>
                <strong>Weather provider</strong>
                <small>
                  {weather
                    ? "Latest response received"
                    : "Awaiting request"}
                </small>
              </div>

              <StatusPill tone={weather ? "green" : "slate"}>
                {weather ? "Available" : "Standby"}
              </StatusPill>
            </div>

            <div className="system-status-item">
              <span className="system-status-icon">
                <Satellite size={16} />
              </span>

              <div>
                <strong>Navigation layer</strong>
                <small>Simulation interface</small>
              </div>

              <StatusPill tone="blue">Ready</StatusPill>
            </div>

            <div className="system-status-item">
              <span className="system-status-icon">
                <Shield size={16} />
              </span>

              <div>
                <strong>Airspace overlay</strong>
                <small>Demo zones only</small>
              </div>

              <StatusPill tone="amber">Verify</StatusPill>
            </div>
          </div>

          <div className="panel-divider" />

          <div className="quick-actions-title">
            QUICK ACCESS
          </div>

          <div className="quick-actions">
            <button onClick={() => onNavigate("Drone Fleet")}>
              <Plane size={16} />
              <span>Fleet</span>
              <ChevronRight size={14} />
            </button>

            <button onClick={() => onNavigate("AI Route Optimizer")}>
              <Sparkles size={16} />
              <span>Optimize route</span>
              <ChevronRight size={14} />
            </button>

            <button onClick={() => onNavigate("Weather Intelligence")}>
              <Wind size={16} />
              <span>Weather check</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </section>
      </div>

      <div className="lower-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                MISSION READINESS
              </span>
              <h3>Pre-flight workflow</h3>
            </div>

            <StatusPill tone="blue">Planning</StatusPill>
          </div>

          <div className="readiness-steps">
            {[
              [
                "01",
                "Select aircraft",
                "Choose a suitable fleet asset",
                "Drone Fleet"
              ],
              [
                "02",
                "Define route",
                "Add take-off, waypoints and destination",
                "Mission Planner"
              ],
              [
                "03",
                "Evaluate mission",
                "Run optimization and safety checks",
                "AI Route Optimizer"
              ],
              [
                "04",
                "Simulate flight",
                "Review telemetry and recovery events",
                "Live Operations"
              ]
            ].map(([number, title, detail, page], index) => {
              const done =
                (index === 0 && selectedDrone) ||
                (index === 1 && waypoints.length >= 2);

              return (
                <button
                  className="readiness-step"
                  key={number}
                  onClick={() => onNavigate(page)}
                >
                  <span className="step-number">
                    {number}
                  </span>

                  <span className="step-copy">
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>

                  <span className={`step-state ${done ? "done" : ""}`}>
                    {done
                      ? <Check size={14} />
                      : <ChevronRight size={15} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel weather-mini-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ENVIRONMENT</span>
              <h3>Weather snapshot</h3>
            </div>

            <button
              className="icon-button"
              onClick={() => onNavigate("Weather Intelligence")}
              aria-label="Open weather"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="weather-snapshot">
            <div className="weather-big-icon">
              <Cloud size={30} />
            </div>

            <div>
              <strong>
                {getWeatherValue(
                  weather,
                  [
                    "current.temperature_2m",
                    "temperature",
                    "current.temperature"
                  ],
                  "—"
                )}
                <small>{weather ? "°C" : ""}</small>
              </strong>

              <span>
                {weather
                  ? "Latest provider reading"
                  : "Fetch weather to populate"}
              </span>
            </div>
          </div>

          <div className="weather-mini-stats">
            <div>
              <Wind size={15} />
              <span>Wind</span>
              <strong>
                {getWeatherValue(
                  weather,
                  [
                    "current.wind_speed_10m",
                    "wind_speed_kmh",
                    "wind_speed"
                  ]
                )}
              </strong>
            </div>

            <div>
              <CloudRain size={15} />
              <span>Rain</span>
              <strong>
                {getWeatherValue(
                  weather,
                  ["current.precipitation", "precipitation"]
                )}
              </strong>
            </div>
          </div>

          <button
            className="btn-outline full-width"
            onClick={() => onNavigate("Weather Intelligence")}
          >
            View weather intelligence
            <ChevronRight size={15} />
          </button>
        </section>
      </div>
    </div>
  );
}

/* =========================================================
   MISSION PLANNER
========================================================= */

function MissionPlanner({
  waypoints,
  setWaypoints,
  noFlyZones,
  onNavigate
}) {
  const [coordinate, setCoordinate] = useState("");
  const [missionName, setMissionName] = useState(
    "Jaipur Survey Mission"
  );

  const distance = routeDistance(waypoints);

  const addCoordinate = () => {
    const values = coordinate
      .split(/[,\s]+/)
      .map(Number);

    if (
      values.length !== 2 ||
      !values.every(Number.isFinite) ||
      Math.abs(values[0]) > 90 ||
      Math.abs(values[1]) > 180
    ) {
      return;
    }

    setWaypoints((old) => [...old, values]);
    setCoordinate("");
  };

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="GEOSPATIAL MISSION DESIGN"
        title="Mission Planner"
        description="Build a waypoint-based route using the interactive India map. Select the map to add coordinates."
        action={
          <button
            className="btn-primary"
            onClick={() => onNavigate("AI Route Optimizer")}
            disabled={waypoints.length < 2}
          >
            <Sparkles size={16} />
            Optimize mission
          </button>
        }
      />

      <div className="planner-layout">
        <section className="panel planner-map-panel">
          <div className="map-toolbar">
            <div className="map-toolbar-left">
              <span className="map-toolbar-dot" />
              MAP WORKSPACE
              <span className="toolbar-divider" />
              OpenStreetMap
            </div>

            <div className="map-toolbar-right">
              <span className="map-layer-chip">
                <Layers3 size={13} />
                Standard
              </span>

              <span className="map-layer-chip">
                <Crosshair size={13} />
                India
              </span>
            </div>
          </div>

          <MissionMap
            waypoints={waypoints}
            onAdd={(point) =>
              setWaypoints((old) => [...old, point])
            }
            noFlyZones={noFlyZones}
          />

          <div className="map-footer">
            <span>
              <MapPin size={13} />
              {waypoints.length} waypoints plotted
            </span>

            <span>
              Map data © OpenStreetMap contributors
            </span>
          </div>
        </section>

        <aside className="panel mission-side-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                MISSION CONFIGURATION
              </span>
              <h3>Flight plan</h3>
            </div>

            <span className="config-icon">
              <SlidersHorizontal size={17} />
            </span>
          </div>

          <label className="field-label">
            MISSION NAME
          </label>

          <input
            className="field-input"
            value={missionName}
            onChange={(event) =>
              setMissionName(event.target.value)
            }
            placeholder="Enter mission name"
          />

          <div className="field-label field-label-spaced">
            ADD COORDINATE
          </div>

          <div className="coordinate-entry">
            <input
              className="field-input"
              value={coordinate}
              onChange={(event) =>
                setCoordinate(event.target.value)
              }
              onKeyDown={(event) =>
                event.key === "Enter" && addCoordinate()
              }
              placeholder="26.9124, 75.7873"
            />

            <button
              className="square-add"
              onClick={addCoordinate}
              aria-label="Add coordinate"
            >
              <Plus size={17} />
            </button>
          </div>

          <div className="waypoint-heading">
            <span>ROUTE WAYPOINTS</span>

            <button
              className="text-action danger-text"
              onClick={() => setWaypoints([])}
              disabled={!waypoints.length}
            >
              <Trash2 size={13} />
              Clear all
            </button>
          </div>

          <div className="waypoint-list">
            {waypoints.length === 0 ? (
              <EmptyPanel
                icon={MapPin}
                title="No waypoints yet"
                detail="Click on the map or enter coordinates to start your route."
              />
            ) : (
              waypoints.map((point, index) => (
                <div
                  className="waypoint-row"
                  key={`${point[0]}-${point[1]}-${index}`}
                >
                  <span className="waypoint-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div>
                    <strong>
                      {index === 0
                        ? "Take-off point"
                        : index === waypoints.length - 1
                          ? "Current destination"
                          : `Waypoint ${index + 1}`}
                    </strong>

                    <small>
                      {formatCoord(point[0])},{" "}
                      {formatCoord(point[1])}
                    </small>
                  </div>

                  <button
                    className="icon-button tiny"
                    onClick={() =>
                      setWaypoints((old) =>
                        old.filter((_, i) => i !== index)
                      )
                    }
                    aria-label={`Remove waypoint ${index + 1}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="route-summary">
            <div>
              <span>TOTAL DISTANCE</span>
              <strong>
                {distance.toFixed(2)}
                <small> km</small>
              </strong>
            </div>

            <div>
              <span>WAYPOINTS</span>
              <strong>{waypoints.length}</strong>
            </div>
          </div>

          <button
            className="btn-primary full-width"
            disabled={waypoints.length < 2}
            onClick={() => onNavigate("AI Route Optimizer")}
          >
            <Sparkles size={16} />
            Continue to optimization
          </button>

          <p className="field-hint">
            Mission name: {missionName || "Unnamed mission"}.
            Route distance is calculated using great-circle
            (Haversine) distance and is a planning estimate.
          </p>
        </aside>
      </div>
    </div>
  );
}

/* =========================================================
   WEATHER INTELLIGENCE
========================================================= */

function WeatherIntelligence({
  waypoints,
  weather,
  setWeather
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [routeWeather, setRouteWeather] = useState(null);
  const [location, setLocation] = useState("Jaipur");
  const [coords, setCoords] = useState([
    26.9124,
    75.7873
  ]);

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getCurrentWeather(
        coords[0],
        coords[1]
      );

      setWeather(result);

      if (waypoints.length >= 2) {
        try {
          const routeResult = await getRouteWeather(waypoints);
          setRouteWeather(routeResult);
        } catch {
          setRouteWeather(null);
        }
      } else {
        setRouteWeather(null);
      }
    } catch (err) {
      setError(
        err.message || "Weather service is unavailable."
      );
    } finally {
      setLoading(false);
    }
  };

  const temp = getWeatherValue(
    weather,
    [
      "current.temperature_2m",
      "temperature",
      "current.temperature"
    ]
  );

  const wind = getWeatherValue(
    weather,
    [
      "current.wind_speed_10m",
      "wind_speed_kmh",
      "wind_speed"
    ]
  );

  const direction = getWeatherValue(
    weather,
    [
      "current.wind_direction_10m",
      "wind_direction"
    ]
  );

  const rain = getWeatherValue(
    weather,
    [
      "current.precipitation",
      "precipitation"
    ]
  );

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="ENVIRONMENTAL INTELLIGENCE"
        title="Weather Intelligence"
        description="Current conditions and route checkpoints from the configured weather provider."
        action={
          <button
            className="btn-primary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              className={loading ? "spin" : ""}
            />
            {loading ? "Refreshing…" : "Refresh weather"}
          </button>
        }
      />

      <section className="panel weather-query-panel">
        <div>
          <span className="eyebrow">LOCATION QUERY</span>
          <h3>Weather observation point</h3>
          <p>
            Default location: Jaipur, Rajasthan.
            You can change the coordinates below.
          </p>
        </div>

        <div className="weather-query-controls">
          <input
            className="field-input"
            value={location}
            onChange={(event) =>
              setLocation(event.target.value)
            }
            aria-label="Weather location label"
          />

          <input
            className="field-input coord-field"
            value={`${coords[0]}, ${coords[1]}`}
            onChange={(event) => {
              const values = event.target.value
                .split(",")
                .map(Number);

              if (
                values.length === 2 &&
                values.every(Number.isFinite) &&
                Math.abs(values[0]) <= 90 &&
                Math.abs(values[1]) <= 180
              ) {
                setCoords(values);
              }
            }}
            aria-label="Weather coordinates"
          />
        </div>
      </section>

      {error && (
        <div className="inline-alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="weather-dashboard">
        <section className="panel weather-current-card">
          <div className="weather-current-head">
            <span className="eyebrow">
              CURRENT CONDITIONS
            </span>

            <StatusPill tone={weather ? "green" : "slate"}>
              {weather ? "Provider response" : "No data loaded"}
            </StatusPill>
          </div>

          <div className="weather-current-main">
            <div className="weather-cloud-icon">
              <Cloud size={42} />
            </div>

            <div>
              <strong>
                {temp}
                {weather ? "°" : ""}
              </strong>

              <span>
                {location} ·{" "}
                {weather
                  ? "Latest observation"
                  : "Press refresh to load"}
              </span>
            </div>
          </div>

          <div className="weather-current-meta">
            <span>
              <Wind size={16} />
              Wind {wind}
            </span>

            <span>
              <Compass size={16} />
              Direction {direction}
            </span>

            <span>
              <CloudRain size={16} />
              Precipitation {rain}
            </span>
          </div>

          <p className="source-note">
            Source: connected Open-Meteo service where
            configured. General weather data is not certified
            aviation meteorology.
          </p>
        </section>

        <div className="weather-stat-grid">
          <MetricCard
            label="TEMPERATURE"
            value={temp}
            unit={weather ? "°C" : ""}
            detail="Current provider value"
            icon={Thermometer}
          />

          <MetricCard
            label="WIND SPEED"
            value={wind}
            unit={weather ? " km/h" : ""}
            detail="Environmental input"
            icon={Wind}
            tone="blue"
          />

          <MetricCard
            label="WIND DIRECTION"
            value={direction}
            detail="Provider response"
            icon={Compass}
            tone="violet"
          />

          <MetricCard
            label="PRECIPITATION"
            value={rain}
            detail="Current response"
            icon={CloudRain}
            tone="amber"
          />
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ROUTE ENVIRONMENT</span>
            <h3>Mission weather checkpoints</h3>
          </div>

          <span className="subtle-count">
            {waypoints.length} WAYPOINTS
          </span>
        </div>

        {routeWeather ? (
          <pre className="response-preview">
            {JSON.stringify(routeWeather, null, 2)}
          </pre>
        ) : (
          <EmptyPanel
            icon={Wind}
            title="No route weather loaded"
            detail="Add at least two mission waypoints, then refresh weather to request route checkpoints."
          />
        )}
      </section>
    </div>
  );
}

/* =========================================================
   SAFETY & AIRSPACE
========================================================= */

function SafetyAirspace({
  noFlyZones,
  onRefreshZones,
  zonesLoading
}) {
  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="AIRSPACE AWARENESS"
        title="Safety & Airspace"
        description="Review demonstration restriction overlays and verify legal airspace status through official sources."
        action={
          <button
            className="btn-outline"
            onClick={onRefreshZones}
            disabled={zonesLoading}
          >
            <RefreshCw
              size={15}
              className={zonesLoading ? "spin" : ""}
            />
            Refresh demo zones
          </button>
        }
      />

      <div className="safety-warning">
        <ShieldAlert size={19} />

        <div>
          <strong>
            Planning aid — not regulatory clearance
          </strong>

          <p>
            Demo zones displayed by this application are not
            official DigitalSky airspace data. Always verify
            the intended operation on the current official
            portal and obtain required permissions.
          </p>
        </div>
      </div>

      <div className="metric-grid safety-metrics">
        <MetricCard
          label="DEMO ZONES"
          value={noFlyZones.length}
          detail="Returned by local backend"
          icon={Shield}
          tone="amber"
        />

        <MetricCard
          label="OFFICIAL CLEARANCE"
          value="Not checked"
          detail="Must be verified on DigitalSky"
          icon={ShieldCheck}
          tone="blue"
        />

        <MetricCard
          label="PREFLIGHT STATUS"
          value="Pending"
          detail="Operator verification required"
          icon={Check}
          tone="violet"
        />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              RESTRICTION OVERLAYS
            </span>
            <h3>Loaded demonstration zones</h3>
          </div>

          <StatusPill tone="amber">
            DEMO DATA
          </StatusPill>
        </div>

        {noFlyZones.length ? (
          <div className="zone-list">
            {noFlyZones.map((zone, index) => (
              <div
                className="zone-row"
                key={zone.id || index}
              >
                <span className="zone-icon">
                  <ShieldAlert size={17} />
                </span>

                <div>
                  <strong>
                    {zone.name ||
                      zone.label ||
                      `Demo zone ${index + 1}`}
                  </strong>

                  <small>
                    {zone.type ||
                      zone.shape ||
                      "Restricted-area geometry"}{" "}
                    · Demo dataset
                  </small>
                </div>

                <StatusPill tone="amber">
                  Reference only
                </StatusPill>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel
            icon={Shield}
            title="No demo zones loaded"
            detail="Refresh to request the demonstration zones from your backend."
          />
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              OFFICIAL REFERENCE DESK
            </span>
            <h3>Indian aviation & geospatial sources</h3>
          </div>
        </div>

        <div className="reference-grid">
          <a
            href="https://digitalsky.dgca.gov.in/"
            target="_blank"
            rel="noreferrer"
          >
            <span className="reference-icon">
              <ShieldCheck size={18} />
            </span>

            <span>
              <strong>DigitalSky — DGCA</strong>
              <small>
                Official drone airspace and regulatory portal
              </small>
            </span>

            <ChevronRight size={16} />
          </a>

          <a
            href="https://www.dgca.gov.in/"
            target="_blank"
            rel="noreferrer"
          >
            <span className="reference-icon">
              <Plane size={18} />
            </span>

            <span>
              <strong>
                Directorate General of Civil Aviation
              </strong>
              <small>
                Regulations, circulars and official notices
              </small>
            </span>

            <ChevronRight size={16} />
          </a>

          <a
            href="https://bhuvan.nrsc.gov.in/"
            target="_blank"
            rel="noreferrer"
          >
            <span className="reference-icon">
              <MapIcon size={18} />
            </span>

            <span>
              <strong>ISRO Bhuvan</strong>
              <small>
                Geospatial mapping and documented services
              </small>
            </span>

            <ChevronRight size={16} />
          </a>

          <a
            href="https://onlinemaps.surveyofindia.gov.in/"
            target="_blank"
            rel="noreferrer"
          >
            <span className="reference-icon">
              <Layers3 size={18} />
            </span>

            <span>
              <strong>Survey of India</strong>
              <small>
                National mapping portal and map products
              </small>
            </span>

            <ChevronRight size={16} />
          </a>
        </div>
      </section>

      <p className="source-note">
        No live DigitalSky API connection is claimed.
        Zone data is demonstration data until a verified,
        authorized official dataset is integrated.
      </p>
    </div>
  );
}

/* =========================================================
   MISSION ANALYTICS
========================================================= */

function AnalyticsPage({
  waypoints,
  simulation,
  missionCount
}) {
  const distance = routeDistance(waypoints);

  const bars = [
    38, 54, 43, 68, 57, 82,
    64, 92, 71, 84, 61, 96
  ];

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="MISSION PERFORMANCE"
        title="Mission Analytics"
        description="Session-level indicators. Persistent analytics will be connected when the backend database is implemented."
      />

      <div className="metric-grid">
        <MetricCard
          label="MISSIONS RECORDED"
          value={missionCount}
          detail="Browser session"
          icon={History}
        />

        <MetricCard
          label="CURRENT ROUTE"
          value={distance.toFixed(2)}
          unit=" km"
          detail="Haversine route estimate"
          icon={Route}
          tone="blue"
        />

        <MetricCard
          label="SIMULATION STATE"
          value={simulation}
          detail="App simulation state"
          icon={Activity}
          tone="violet"
        />

        <MetricCard
          label="WAYPOINT COUNT"
          value={waypoints.length}
          detail="Current mission plan"
          icon={MapPin}
          tone="amber"
        />
      </div>

      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">VISUAL TREND</span>
              <h3>Illustrative activity profile</h3>
            </div>

            <span className="subtle-count">
              SAMPLE VISUAL
            </span>
          </div>

          <div className="bar-chart">
            {bars.map((value, index) => (
              <div className="bar-column" key={index}>
                <i style={{ height: `${value}%` }} />

                <span>
                  {[
                    "M", "T", "W", "T", "F", "S",
                    "S", "M", "T", "W", "T", "F"
                  ][index]}
                </span>
              </div>
            ))}
          </div>

          <p className="source-note">
            Illustrative chart styling only. These bars
            are not actual historical flight measurements.
          </p>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                PERFORMANCE BREAKDOWN
              </span>
              <h3>Current mission metrics</h3>
            </div>
          </div>

          <div className="performance-rows">
            <div>
              <span>Route distance</span>
              <strong>{distance.toFixed(2)} km</strong>
            </div>

            <div>
              <span>Waypoints</span>
              <strong>{waypoints.length}</strong>
            </div>

            <div>
              <span>Mission simulation</span>
              <strong>{simulation}</strong>
            </div>

            <div>
              <span>Persistence</span>
              <strong>Session only</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* =========================================================
   MISSION HISTORY
========================================================= */

function MissionHistory({ records, onSave }) {
  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="MISSION RECORDS"
        title="Mission History"
        description="Mission snapshots saved in this browser session. Backend persistence is a later phase."
        action={
          <button
            className="btn-primary"
            onClick={onSave}
          >
            <Plus size={15} />
            Save current mission
          </button>
        }
      />

      {records.length ? (
        <section className="panel history-list">
          {records.map((record) => (
            <div
              className="history-row"
              key={record.id}
            >
              <div className="history-icon">
                <Route size={18} />
              </div>

              <div className="history-copy">
                <strong>{record.name}</strong>
                <small>
                  {record.date} · {record.waypoints} waypoints
                </small>
              </div>

              <div className="history-distance">
                <strong>
                  {record.distance.toFixed(2)} km
                </strong>
                <small>Route estimate</small>
              </div>

              <StatusPill tone="blue">
                Session record
              </StatusPill>
            </div>
          ))}
        </section>
      ) : (
        <section className="panel">
          <EmptyPanel
            icon={History}
            title="No mission records yet"
            detail="Save your current mission plan to create a local session record."
          />
        </section>
      )}
    </div>
  );
}

/* =========================================================
   ADMINISTRATION
========================================================= */

function Administration({
  backendOnline,
  onHealthCheck
}) {
  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="PLATFORM SETTINGS"
        title="Administration"
        description="Workspace preferences and integration status."
        action={
          <button
            className="btn-outline"
            onClick={onHealthCheck}
          >
            <RefreshCw size={15} />
            Test backend
          </button>
        }
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              SERVICE CONNECTIVITY
            </span>
            <h3>Integration health</h3>
          </div>
        </div>

        <div className="integration-list">
          <div>
            <span className="integration-logo">
              <Activity size={18} />
            </span>

            <div>
              <strong>FastAPI backend</strong>
              <small>{API_BASE}</small>
            </div>

            <StatusPill
              tone={backendOnline ? "green" : "amber"}
            >
              {backendOnline ? "Connected" : "Not reachable"}
            </StatusPill>
          </div>

          <div>
            <span className="integration-logo">
              <MapIcon size={18} />
            </span>

            <div>
              <strong>OpenStreetMap tiles</strong>
              <small>
                External tile service · internet required
              </small>
            </div>

            <StatusPill tone="blue">
              Configured
            </StatusPill>
          </div>

          <div>
            <span className="integration-logo">
              <Cloud size={18} />
            </span>

            <div>
              <strong>Open-Meteo weather</strong>
              <small>
                Access through backend weather endpoints
              </small>
            </div>

            <StatusPill tone="blue">
              Configured
            </StatusPill>
          </div>
        </div>
      </section>

      <section className="panel config-note">
        <span className="eyebrow">
          IMPLEMENTATION NOTE
        </span>

        <h3>Frontend phase configuration</h3>

        <p>
          This frontend uses the existing API module and
          existing route, fleet and intelligence components.
          Database persistence, WebSocket telemetry,
          authenticated administration and live regulatory
          data are not claimed as implemented in this
          frontend batch.
        </p>
      </section>
    </div>
  );
}

/* =========================================================
   MAIN APPLICATION
========================================================= */

export default function App() {
  const [activePage, setActivePage] = useState(
    "Command Centre"
  );

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  const [waypoints, setWaypoints] = useState([]);

  const [selectedDrone, setSelectedDrone] =
    useState(null);

  const [noFlyZones, setNoFlyZones] = useState([]);

  const [zonesLoading, setZonesLoading] =
    useState(false);

  const [backendOnline, setBackendOnline] =
    useState(false);

  const [weather, setWeather] = useState(null);

  const [simulation, setSimulation] =
    useState("idle");

  const [records, setRecords] = useState([]);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const pageMeta =
    PAGE_META[activePage] ||
    PAGE_META["Command Centre"];

  const missionDistance = useMemo(
    () => routeDistance(waypoints),
    [waypoints]
  );

  /* ---------------- NAVIGATION ---------------- */

  const navigate = useCallback((page) => {
    setActivePage(page);
    setMobileSidebarOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }, []);

  /* ---------------- BACKEND HEALTH ---------------- */

  const checkHealth = useCallback(async () => {
    try {
      await checkBackendHealth();
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  /* ---------------- DEMO NO-FLY ZONES ---------------- */

  const refreshZones = useCallback(async () => {
    setZonesLoading(true);

    try {
      const data = await getDemoNoFlyZones();

      setNoFlyZones(
        Array.isArray(data?.zones)
          ? data.zones
          : Array.isArray(data)
            ? data
            : []
      );
    } catch (error) {
      console.error("Could not load demo zones:", error);
      setNoFlyZones([]);
    } finally {
      setZonesLoading(false);
    }
  }, []);

  /* ---------------- INITIAL LOAD ---------------- */

  useEffect(() => {
    checkHealth();
    refreshZones();
  }, [checkHealth, refreshZones]);

  /* ---------------- SAVE MISSION ---------------- */

  const saveMission = useCallback(() => {
    if (waypoints.length < 2) return;

    const record = {
      id: `${Date.now()}`,
      name: `Mission ${String(records.length + 1).padStart(2, "0")}`,
      date: new Date().toLocaleString(),
      waypoints: waypoints.length,
      distance: missionDistance
    };

    setRecords((old) => [record, ...old]);
  }, [
    waypoints,
    records.length,
    missionDistance
  ]);

  /* =====================================================
     PAGE ROUTER
  ===================================================== */

  const renderPage = () => {
    switch (activePage) {
      case "Drone Fleet":
        return (
          <div className="page-stack">
            <SectionHeading
              eyebrow="FLEET MANAGEMENT"
              title="Drone Fleet"
              description="Load aircraft profiles from your existing FastAPI fleet endpoint. Select an aircraft for mission assessments."
            />

            <DroneFleet
              selectedDrone={selectedDrone}
              onSelectDrone={setSelectedDrone}
            />
          </div>
        );

      case "Mission Planner":
        return (
          <MissionPlanner
            waypoints={waypoints}
            setWaypoints={setWaypoints}
            noFlyZones={noFlyZones}
            onNavigate={navigate}
          />
        );

      case "AI Route Optimizer":
        return (
          <div className="page-stack">
            <SectionHeading
              eyebrow="INTELLIGENT PATH PLANNING"
              title="AI Route Optimizer"
              description="Run the existing backend optimization pipeline and compare its route results."
            />

            <RouteOptimization
              waypoints={waypoints}
              settings={{
                populationSize: 80,
                generations: 250,
                batteryCapacity:
                  selectedDrone?.battery_capacity_wh || 150,
                energyPerKm: 25,
                batteryReserve: 20,
                avoidNoFlyZones: true,
                safetyMargin: 1
              }}
              noFlyZones={noFlyZones}
              onUseRoute={(route) => {
                if (Array.isArray(route)) {
                  setWaypoints(route);
                }

                navigate("Live Operations");
              }}
            />
          </div>
        );

      /* ================================================
         UPDATED LIVE OPERATIONS PAGE
      ================================================ */

      case "Live Operations":
        return (
          <div className="page-stack">
            <LiveFlightSimulation
              waypoints={waypoints}
              selectedDrone={selectedDrone}
            />
          </div>
        );

      case "Navigation & Landing":
        return (
          <div className="page-stack">
            <SectionHeading
              eyebrow="NAVIGATION INTELLIGENCE"
              title="Navigation & Landing"
              description="Run the existing GNSS, battery, weather-risk and emergency assessment services."
            />

            <DroneIntelligence
              selectedDrone={selectedDrone}
              waypoints={waypoints}
            />

            <section className="panel landing-concept">
              <div className="landing-concept-icon">
                <Crosshair size={23} />
              </div>

              <div>
                <span className="eyebrow">
                  LANDING MODULE ROADMAP
                </span>

                <h3>Precision landing simulation</h3>

                <p>
                  Optical-flow corrections, landing-zone
                  hazard injection, hover/abort and retry
                  controls need a dedicated shared
                  simulation service. They are not
                  represented as completed controls in
                  this frontend phase.
                </p>
              </div>

              <StatusPill tone="amber">
                Backend phase
              </StatusPill>
            </section>
          </div>
        );

      case "Safety & Airspace":
        return (
          <SafetyAirspace
            noFlyZones={noFlyZones}
            onRefreshZones={refreshZones}
            zonesLoading={zonesLoading}
          />
        );

      case "Weather Intelligence":
        return (
          <WeatherIntelligence
            waypoints={waypoints}
            weather={weather}
            setWeather={setWeather}
          />
        );

      case "Mission Analytics":
        return (
          <AnalyticsPage
            waypoints={waypoints}
            simulation={simulation}
            missionCount={records.length}
          />
        );

      case "Mission History":
        return (
          <MissionHistory
            records={records}
            onSave={saveMission}
          />
        );

      case "Administration":
        return (
          <Administration
            backendOnline={backendOnline}
            onHealthCheck={checkHealth}
          />
        );

      default:
        return (
          <CommandCentre
            waypoints={waypoints}
            onNavigate={navigate}
            backendOnline={backendOnline}
            selectedDrone={selectedDrone}
            missionCount={records.length}
            weather={weather}
          />
        );
    }
  };

  /* =====================================================
     MAIN APP LAYOUT
  ===================================================== */

  return (
    <div
      className={`app-shell ${
        sidebarCollapsed ? "sidebar-is-collapsed" : ""
      }`}
    >
      {mobileSidebarOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`sidebar ${
          mobileSidebarOpen ? "mobile-open" : ""
        }`}
      >
        <div className="brand-row">
          <div className="brand-mark">
            <Plane size={21} />
          </div>

          {!sidebarCollapsed && (
            <div className="brand-name">
              <strong>
                AERO<span>ROUTE</span>
              </strong>
              <small>INTELLIGENCE SYSTEMS</small>
            </div>
          )}

          <button
            className="sidebar-collapse"
            onClick={() =>
              setSidebarCollapsed((value) => !value)
            }
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="sidebar-system">
          <span className="system-orbit">
            <i />
          </span>

          {!sidebarCollapsed && (
            <div>
              <strong>GROUND CONTROL</strong>
              <small>OPS ENVIRONMENT / 01</small>
            </div>
          )}
        </div>

        <nav className="side-navigation">
          {NAV_GROUPS.map((group) => (
            <div
              className="nav-group"
              key={group.title}
            >
              <div className="nav-group-label">
                {!sidebarCollapsed && group.title}
              </div>

              {group.items.map(([label, Icon]) => (
                <button
                  key={label}
                  className={`nav-item ${
                    activePage === label ? "active" : ""
                  }`}
                  onClick={() => navigate(label)}
                  title={
                    sidebarCollapsed ? label : undefined
                  }
                >
                  <Icon size={18} />

                  <span>{label}</span>

                  {activePage === label && (
                    <i className="nav-active-indicator" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="sidebar-bottom-card">
            <div className="sidebar-bottom-icon">
              <Zap size={17} />
            </div>

            <strong>Mission workspace</strong>

            <p>
              Build a route, evaluate it and launch
              a virtual mission.
            </p>

            <button
              onClick={() => navigate("Mission Planner")}
            >
              Open planner
              <ChevronRight size={13} />
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          <div className="avatar">AR</div>

          {!sidebarCollapsed && (
            <div>
              <strong>Operator workspace</strong>
              <small>Local development</small>
            </div>
          )}

          <button
            className="more-button"
            onClick={() => navigate("Administration")}
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main-area">
        {/* TOPBAR */}

        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <div className="breadcrumb">
              <span>WORKSPACE</span>
              <ChevronRight size={13} />
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div
              className={`connection-indicator ${
                backendOnline
                  ? "connected"
                  : "disconnected"
              }`}
            >
              <i />
              <span>
                {backendOnline
                  ? "API CONNECTED"
                  : "API OFFLINE"}
              </span>
            </div>

            <button
              className="topbar-icon"
              onClick={() =>
                setSearchOpen((value) => !value)
              }
              aria-label="Search"
            >
              <Search size={18} />
            </button>

            <button
              className="topbar-icon notification-button"
              onClick={() =>
                setNotificationsOpen((value) => !value)
              }
              aria-label="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>

            <div className="topbar-profile">
              <div className="avatar small-avatar">
                AR
              </div>

              <div>
                <strong>Operator</strong>
                <small>Administrator</small>
              </div>

              <ChevronDown size={14} />
            </div>
          </div>
        </header>

        {/* SEARCH */}

        {searchOpen && (
          <div className="quick-search">
            <Search size={16} />

            <input
              autoFocus
              placeholder="Search modules…"
              onKeyDown={(event) => {
                const query = event.target.value
                  .trim()
                  .toLowerCase();

                const match = NAV_GROUPS
                  .flatMap((group) => group.items)
                  .find(([name]) =>
                    name.toLowerCase().includes(query)
                  );

                if (event.key === "Enter" && match) {
                  navigate(match[0]);
                  setSearchOpen(false);
                }
              }}
            />

            <button
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* NOTIFICATIONS */}

        {notificationsOpen && (
          <div className="notification-popover">
            <strong>System notifications</strong>

            <p>
              <span className="notice-dot amber" />
              Demo airspace zones require official verification.
            </p>

            <p>
              <span className="notice-dot blue" />
              Telemetry is currently simulation-only.
            </p>

            <p>
              <span className="notice-dot green" />
              Frontend workspace initialized.
            </p>
          </div>
        )}

        {/* PAGE CONTENT */}

        <div className="content-area">
          <div className="page-title-row">
            <div>
              <div className="eyebrow">
                {pageMeta[0]}
              </div>

              <h1>{pageMeta[1]}</h1>

              <p>{pageMeta[2]}</p>
            </div>

            <div className="page-title-actions">
              <div className="date-chip">
                <Timer size={14} />
                {new Date().toLocaleDateString(
                  undefined,
                  {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                  }
                )}
              </div>

              <button
                className="icon-button help-button"
                title="Help and documentation"
                onClick={() => navigate("Administration")}
              >
                <CircleHelp size={17} />
              </button>
            </div>
          </div>

          {renderPage()}

          {/* FOOTER */}

          <footer className="app-footer">
            <span>
              © 2026 AEROROUTE AI
              <i />
              INTELLIGENT UAV OPERATIONS
            </span>

            <span>
              PLANNING & SIMULATION PLATFORM
              <b>·</b>
              NOT A FLIGHT AUTHORIZATION SYSTEM
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
