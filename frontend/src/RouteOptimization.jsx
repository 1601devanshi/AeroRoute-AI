import { getDemoNoFlyZones, optimizeRoute } from "./api.js";
import { useEffect, useMemo, useState } from "react";



import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  Play,
  Route,
  ShieldCheck,
  Zap,
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Polygon,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import "./RouteOptimization.css";

// --------------------------------------------------
// ALGORITHM INFORMATION
// --------------------------------------------------

const algorithmInfo = {
  genetic_algorithm: {
    name: "Genetic Algorithm",
    shortName: "GA",
    description:
      "Uses evolutionary optimization to find a short waypoint sequence.",
  },

  dijkstra: {
    name: "Dijkstra",
    shortName: "Dijkstra",
    description:
      "Finds the shortest waypoint-visiting route using exact search.",
  },

  a_star: {
    name: "A* Search",
    shortName: "A*",
    description:
      "Uses a heuristic-guided search to find a waypoint-visiting route.",
  },
};

// --------------------------------------------------
// MAP MARKER
// --------------------------------------------------

const droneIcon = L.divIcon({
  className: "aeroroute-marker",
  html: '<div class="aeroroute-marker-inner"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// --------------------------------------------------
// MAP AUTO FIT
// --------------------------------------------------

function MapAutoFit({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (!positions || positions.length === 0) return;

    if (positions.length === 1) {
      map.setView(positions[0], 8);
      return;
    }

    map.fitBounds(positions, {
      padding: [45, 45],
      maxZoom: 10,
    });
  }, [map, positions]);

  return null;
}

// --------------------------------------------------
// UTILITY FUNCTIONS
// --------------------------------------------------

function formatNumber(value, digits = 2) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(digits)
    : "—";
}

function getStatusLabel(status) {
  const labels = {
    feasible: "Mission feasible",
    airspace_blocked: "Airspace blocked",
    battery_insufficient: "Battery insufficient",
    airspace_and_battery_infeasible:
      "Airspace & battery issue",
    clear: "Clear",
    blocked: "Blocked",
    no_feasible_route: "No feasible detour",
    not_requested: "Not requested",
  };

  return labels[status] || status || "Not available";
}

function getStatusClass(status) {
  if (status === "feasible" || status === "clear") {
    return "success";
  }

  if (status === "not_requested") {
    return "neutral";
  }

  return "danger";
}

function getAlgorithmResult(results, algorithm) {
  return results?.[algorithm] || null;
}

// --------------------------------------------------
// MAIN ROUTE OPTIMIZATION COMPONENT
// --------------------------------------------------

export default function RouteOptimization({
  waypoints = [],
  settings = {},
  noFlyZones: suppliedZones,
  onUseRoute,
}) {
  // ------------------------------------------------
  // STATES
  // ------------------------------------------------

  const [zones, setZones] = useState(
    Array.isArray(suppliedZones) ? suppliedZones : []
  );

  const [results, setResults] = useState(null);

  const [selectedAlgorithm, setSelectedAlgorithm] =
    useState("genetic_algorithm");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zonesLoading, setZonesLoading] = useState(false);

  // ------------------------------------------------
  // VALIDATE WAYPOINTS
  // ------------------------------------------------

  const validWaypoints = useMemo(() => {
    return Array.isArray(waypoints)
      ? waypoints.filter(
          (point) =>
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(Number(point[0])) &&
            Number.isFinite(Number(point[1])) &&
            Number(point[0]) >= -90 &&
            Number(point[0]) <= 90 &&
            Number(point[1]) >= -180 &&
            Number(point[1]) <= 180
        )
      : [];
  }, [waypoints]);

  // ------------------------------------------------
  // LOAD SUPPLIED NO-FLY ZONES
  // ------------------------------------------------

  useEffect(() => {
    if (Array.isArray(suppliedZones)) {
      setZones(suppliedZones);
    }
  }, [suppliedZones]);

  // ------------------------------------------------
  // FETCH DEMO NO-FLY ZONES
  // ------------------------------------------------

  useEffect(() => {
    if (Array.isArray(suppliedZones)) return;

    let cancelled = false;

    async function loadZones() {
      setZonesLoading(true);

      try {
        const response = await getDemoNoFlyZones();

        if (!cancelled) {
          setZones(
            Array.isArray(response?.zones)
              ? response.zones
              : []
          );
        }
      } catch (err) {
        if (!cancelled) {
          setZones([]);
          console.error("Unable to load no-fly zones:", err);
        }
      } finally {
        if (!cancelled) {
          setZonesLoading(false);
        }
      }
    }

    loadZones();

    return () => {
      cancelled = true;
    };
  }, [suppliedZones]);

  // ------------------------------------------------
  // SELECTED ALGORITHM DATA
  // ------------------------------------------------

  const selectedResult = getAlgorithmResult(
    results,
    selectedAlgorithm
  );

  const selectedRoute = selectedResult?.route || [];

  // ------------------------------------------------
  // ROUTE COORDINATES
  // ------------------------------------------------

  const routePositions = useMemo(() => {
    return selectedRoute
      .filter(
        (point) =>
          Number.isFinite(Number(point.lat)) &&
          Number.isFinite(Number(point.lon))
      )
      .map((point) => [
        Number(point.lat),
        Number(point.lon),
      ]);
  }, [selectedRoute]);

  const originalPositions = useMemo(() => {
    return validWaypoints.map(([lat, lon]) => [
      Number(lat),
      Number(lon),
    ]);
  }, [validWaypoints]);

  // ------------------------------------------------
  // DETOUR DATA
  // ------------------------------------------------

  const selectedDetour = selectedResult?.detour;

  const detourRoute = selectedDetour?.route || [];

  const detourPositions = useMemo(() => {
    return detourRoute
      .filter(
        (point) =>
          Number.isFinite(Number(point.lat)) &&
          Number.isFinite(Number(point.lon))
      )
      .map((point) => [
        Number(point.lat),
        Number(point.lon),
      ]);
  }, [detourRoute]);

  const displayPositions =
    detourPositions.length > 0 &&
    selectedDetour?.status === "clear"
      ? detourPositions
      : routePositions;

  const mapPositions =
    displayPositions.length > 0
      ? displayPositions
      : originalPositions;

  // ------------------------------------------------
  // BATTERY AND MISSION DATA
  // ------------------------------------------------

  const battery = selectedResult?.battery_analysis;

  const mission = selectedResult?.mission_assessment;

  const comparison = results?.comparison;

  // ------------------------------------------------
  // RUN OPTIMIZATION
  // ------------------------------------------------

  async function handleOptimize() {
    setError("");

    if (validWaypoints.length < 2) {
      setError(
        "Add at least two valid waypoints in Mission Planner before optimizing."
      );
      return;
    }

    if (zonesLoading) {
      setError(
        "Please wait until restricted zones finish loading."
      );
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const response = await optimizeRoute(
        validWaypoints,
        {
          populationSize:
            settings.populationSize ?? 80,

          generations:
            settings.generations ?? 250,

          batteryCapacity:
            settings.batteryCapacity ?? 150,

          energyPerKm:
            settings.energyPerKm ?? 25,

          batteryReserve:
            settings.batteryReserve ?? 20,

          avoidNoFlyZones:
            settings.avoidNoFlyZones ?? true,

          safetyMargin:
            settings.safetyMargin ?? 1,
        },
        zones
      );

      if (response?.status !== "success") {
        throw new Error(
          "The backend did not return a successful optimization result."
        );
      }

      setResults(response);

      setSelectedAlgorithm("genetic_algorithm");
    } catch (err) {
      console.error("Route optimization error:", err);

      setError(
        err?.message ||
          "Unable to optimize the route. Check whether the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------
  // SEND ROUTE BACK TO MISSION PLANNER
  // ------------------------------------------------

  function handleUseRoute() {
    if (!selectedRoute.length) return;

    if (typeof onUseRoute === "function") {
      onUseRoute(
        selectedRoute.map((point) => [
          Number(point.lat),
          Number(point.lon),
        ])
      );
    }
  }

  // ------------------------------------------------
  // MAIN UI
  // ------------------------------------------------

  return (
    <div className="route-optimization-page">

      {/* PAGE HEADER */}

      <div className="ro-heading">
        <div>
          <div className="ro-eyebrow">
            <Activity size={15} />
            FLIGHT INTELLIGENCE
          </div>

          <h1>Route Optimization</h1>

          <p>
            Compare intelligent routing algorithms and evaluate
            mission efficiency, airspace safety and battery feasibility.
          </p>
        </div>

        <button
          className="ro-optimize-btn"
          onClick={handleOptimize}
          disabled={
            loading ||
            zonesLoading ||
            validWaypoints.length < 2
          }
        >
          {loading ? (
            <>
              <span className="ro-spinner" />
              Optimizing...
            </>
          ) : (
            <>
              <Play size={17} />
              Run Optimization
            </>
          )}
        </button>
      </div>

      {/* INPUT SUMMARY */}

      <div className="ro-input-summary">

        <div className="ro-summary-item">
          <MapPin size={18} />

          <div>
            <span>Mission waypoints</span>
            <strong>{validWaypoints.length}</strong>
          </div>
        </div>

        <div className="ro-summary-item">
          <ShieldCheck size={18} />

          <div>
            <span>Restricted zones</span>

            <strong>
              {zonesLoading
                ? "Loading..."
                : zones.length}
            </strong>
          </div>
        </div>

        <div className="ro-summary-item">
          <BatteryCharging size={18} />

          <div>
            <span>Battery capacity</span>

            <strong>
              {settings.batteryCapacity ?? 150} Wh
            </strong>
          </div>
        </div>

        <div className="ro-summary-item">
          <Zap size={18} />

          <div>
            <span>Energy consumption</span>

            <strong>
              {settings.energyPerKm ?? 25} Wh/km
            </strong>
          </div>
        </div>

      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="ro-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* EMPTY STATE */}

      {!results && !loading && (
        <div className="ro-empty-state">

          <div className="ro-empty-icon">
            <Route size={30} />
          </div>

          <h2>Ready to optimize your mission?</h2>

          <p>
            Add your waypoints in Mission Planner, then run
            optimization to compare GA, Dijkstra and A*.
          </p>

          <button
            className="ro-secondary-btn"
            onClick={handleOptimize}
            disabled={
              validWaypoints.length < 2 ||
              zonesLoading
            }
          >
            <Play size={16} />
            Start Route Optimization
          </button>

          {validWaypoints.length < 2 && (
            <span className="ro-hint">
              At least two waypoints are required.
            </span>
          )}

        </div>
      )}

      {/* LOADING STATE */}

      {loading && (
        <div className="ro-loading-panel">

          <div className="ro-large-spinner" />

          <h3>Analyzing flight routes</h3>

          <p>
            Running Genetic Algorithm, Dijkstra and A*
            and evaluating battery and airspace conditions.
          </p>

        </div>
      )}

      {/* OPTIMIZATION RESULTS */}

      {results && (
        <>

          {/* ALGORITHM COMPARISON */}

          <div className="ro-section-heading">

            <div>
              <h2>Algorithm comparison</h2>

              <p>
                Compare the results returned by your backend.
              </p>
            </div>

            <span className="ro-live-label">
              <span />
              ANALYSIS COMPLETE
            </span>

          </div>

          <div className="ro-algorithm-grid">

            {Object.keys(algorithmInfo).map((algorithm) => {
              const result = results[algorithm];

              const info = algorithmInfo[algorithm];

              const active =
                selectedAlgorithm === algorithm;

              return (
                <button
                  type="button"
                  key={algorithm}
                  className={`ro-algorithm-card ${
                    active ? "active" : ""
                  }`}
                  onClick={() =>
                    setSelectedAlgorithm(algorithm)
                  }
                >

                  <div className="ro-algorithm-top">

                    <span className="ro-algorithm-icon">
                      {info.shortName}
                    </span>

                    {active && (
                      <CheckCircle2
                        size={18}
                        className="ro-selected-icon"
                      />
                    )}

                  </div>

                  <h3>{info.name}</h3>

                  <p>{info.description}</p>

                  <div className="ro-algorithm-metrics">

                    <div>
                      <span>Distance</span>

                      <strong>
                        {formatNumber(
                          result?.distance_km
                        )} km
                      </strong>
                    </div>

                    <div>
                      <span>Execution</span>

                      <strong>
                        {formatNumber(
                          result?.execution_time_ms
                        )} ms
                      </strong>
                    </div>

                  </div>

                  <div className="ro-card-status">

                    <span
                      className={`ro-status-dot ${
                        result?.route_status === "clear"
                          ? "green"
                          : "red"
                      }`}
                    />

                    {result?.route_status === "clear"
                      ? "Airspace clear"
                      : "Airspace violation"}

                  </div>

                </button>
              );
            })}

          </div>

          {/* MAP HEADING */}

          <div className="ro-section-heading ro-map-heading">

            <div>
              <h2>Optimized flight path</h2>

              <p>
                Selected algorithm:{" "}
                <strong>
                  {algorithmInfo[selectedAlgorithm].name}
                </strong>
              </p>
            </div>

            <span className="ro-map-legend">
              <span className="ro-legend-line" />
              Optimized route
            </span>

          </div>

          {/* MAP */}

          <div className="ro-map-panel">

            {mapPositions.length > 0 ? (

              <MapContainer
                center={mapPositions[0]}
                zoom={6}
                scrollWheelZoom
                className="ro-leaflet-map"
              >

                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapAutoFit positions={mapPositions} />

                {/* RESTRICTED ZONES */}

                {zones.map((zone, index) => {

                  if (
                    zone.type === "circle" &&
                    zone.center
                  ) {
                    return (
                      <Circle
                        key={`zone-${index}`}
                        center={[
                          Number(zone.center.lat),
                          Number(zone.center.lon),
                        ]}
                        radius={
                          Number(zone.radius_km) * 1000
                        }
                        pathOptions={{
                          color: "#ff626f",
                          fillColor: "#ff626f",
                          fillOpacity: 0.14,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          {zone.name || "Restricted zone"}
                          <br />
                          Demonstration zone
                        </Popup>
                      </Circle>
                    );
                  }

                  if (
                    zone.type === "polygon" &&
                    Array.isArray(zone.vertices)
                  ) {
                    return (
                      <Polygon
                        key={`zone-${index}`}
                        positions={zone.vertices.map(
                          (point) => [
                            Number(point.lat),
                            Number(point.lon),
                          ]
                        )}
                        pathOptions={{
                          color: "#ff626f",
                          fillColor: "#ff626f",
                          fillOpacity: 0.14,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          {zone.name || "Restricted zone"}
                          <br />
                          Demonstration zone
                        </Popup>
                      </Polygon>
                    );
                  }

                  return null;
                })}

                {/* ORIGINAL WAYPOINTS */}

                {originalPositions.map(
                  (position, index) => (
                    <Marker
                      key={`waypoint-${index}`}
                      position={position}
                      icon={droneIcon}
                    >
                      <Popup>
                        Mission waypoint {index + 1}
                      </Popup>
                    </Marker>
                  )
                )}

                {/* ORIGINAL ALGORITHM ROUTE */}

                {routePositions.length > 1 && (
                  <Polyline
                    positions={routePositions}
                    pathOptions={{
                      color: "#f4b84b",
                      weight: 3,
                      opacity: 0.8,
                      dashArray: "7 7",
                    }}
                  />
                )}

                {/* GENERATED DETOUR */}

                {detourPositions.length > 1 &&
                  selectedDetour?.status === "clear" && (
                    <Polyline
                      positions={detourPositions}
                      pathOptions={{
                        color: "#35d6c2",
                        weight: 5,
                        opacity: 0.95,
                      }}
                    />
                  )}

              </MapContainer>

            ) : (

              <div className="ro-map-empty">
                No route coordinates available.
              </div>

            )}

          </div>

          {/* MAP LEGEND */}

          <div className="ro-map-caption">

            <span>
              <span className="ro-caption-dot original" />
              Original algorithm route
            </span>

            <span>
              <span className="ro-caption-dot detour" />
              Generated detour, when available
            </span>

            <span>
              <span className="ro-caption-dot zone" />
              Restricted zone
            </span>

          </div>

          {/* MISSION ASSESSMENT */}

          <div className="ro-section-heading">

            <div>
              <h2>Mission assessment</h2>

              <p>
                Safety and energy assessment for the selected algorithm.
              </p>
            </div>

          </div>

          <div className="ro-assessment-grid">

            {/* MISSION STATUS */}

            <div className="ro-assessment-card">

              <div className="ro-assessment-title">
                <ShieldCheck size={19} />
                <span>Mission status</span>
              </div>

              <strong
                className={`ro-assessment-value ${
                  getStatusClass(mission?.status)
                }`}
              >
                {getStatusLabel(mission?.status)}
              </strong>

              <p>
                {mission?.note ||
                  "Mission feasibility assessment is unavailable."}
              </p>

            </div>

            {/* BATTERY */}

            <div className="ro-assessment-card">

              <div className="ro-assessment-title">
                <BatteryCharging size={19} />
                <span>Battery feasibility</span>
              </div>

              <strong
                className={`ro-assessment-value ${
                  battery?.battery_feasible
                    ? "success"
                    : "danger"
                }`}
              >
                {battery?.battery_feasible === true
                  ? "Sufficient"
                  : battery?.battery_feasible === false
                    ? "Insufficient"
                    : "Not available"}
              </strong>

              <p>
                Estimated energy:{" "}
                {formatNumber(
                  battery?.total_energy_required_wh
                )} Wh
              </p>

              <p>
                Remaining energy:{" "}
                {formatNumber(
                  battery?.projected_remaining_energy_wh
                )} Wh
              </p>

            </div>

            {/* AIRSPACE */}

            <div className="ro-assessment-card">

              <div className="ro-assessment-title">
                <Navigation size={19} />
                <span>Airspace validation</span>
              </div>

              <strong
                className={`ro-assessment-value ${
                  selectedResult?.airspace?.is_clear === true
                    ? "success"
                    : "danger"
                }`}
              >
                {selectedResult?.airspace?.is_clear === true
                  ? "Clear"
                  : selectedResult?.airspace?.is_clear === false
                    ? "Violations found"
                    : "Not available"}
              </strong>

              <p>
                Zones checked:{" "}
                {results.airspace_summary?.zones_checked ?? 0}
              </p>

              <p>
                Violations:{" "}
                {selectedResult?.airspace?.violation_count ?? 0}
              </p>

            </div>

            {/* DETOUR */}

            <div className="ro-assessment-card">

              <div className="ro-assessment-title">
                <Route size={19} />
                <span>Automatic detour</span>
              </div>

              <strong
                className={`ro-assessment-value ${
                  getStatusClass(selectedDetour?.status)
                }`}
              >
                {getStatusLabel(selectedDetour?.status)}
              </strong>

              <p>
                Detour distance:{" "}
                {formatNumber(
                  selectedDetour?.distance_km
                )} km
              </p>

              <p>
                Additional waypoints:{" "}
                {selectedDetour?.detour_waypoint_count ?? 0}
              </p>

            </div>

          </div>

          {/* PERFORMANCE DETAILS */}

          <div className="ro-section-heading">

            <div>
              <h2>Performance details</h2>

              <p>
                Detailed metrics for the selected route.
              </p>
            </div>

          </div>

          <div className="ro-performance-grid">

            <div className="ro-performance-card">
              <span>Total route distance</span>

              <strong>
                {formatNumber(
                  selectedResult?.distance_km
                )} km
              </strong>
            </div>

            <div className="ro-performance-card">
              <span>Execution time</span>

              <strong>
                {formatNumber(
                  selectedResult?.execution_time_ms
                )} ms
              </strong>
            </div>

            <div className="ro-performance-card">
              <span>Waypoints visited</span>

              <strong>
                {selectedResult?.waypoints_visited ?? "—"}
              </strong>
            </div>

            <div className="ro-performance-card">
              <span>Battery remaining</span>

              <strong>
                {formatNumber(
                  battery?.remaining_battery_percentage
                )}%
              </strong>
            </div>

          </div>

          {/* OVERALL COMPARISON */}

          <div className="ro-comparison-panel">

            <div className="ro-comparison-heading">

              <div>
                <h3>Overall comparison</h3>

                <p>
                  Summary across all three algorithms.
                </p>
              </div>

              <Clock3 size={20} />

            </div>

            <div className="ro-comparison-row">
              <span>Shortest distance</span>

              <strong>
                {formatNumber(
                  comparison?.shortest_distance_km
                )} km
              </strong>
            </div>

            <div className="ro-comparison-row">
              <span>Fastest algorithm</span>

              <strong>
                {algorithmInfo[
                  comparison?.fastest_algorithm
                ]?.name ||
                  comparison?.fastest_algorithm ||
                  "—"}
              </strong>
            </div>

            <div className="ro-comparison-row">
              <span>
                All algorithms visit all waypoints
              </span>

              <strong>
                {comparison?.all_algorithms_visit_all_waypoints === true
                  ? "Yes"
                  : comparison?.all_algorithms_visit_all_waypoints === false
                    ? "No"
                    : "—"}
              </strong>
            </div>

            <div className="ro-comparison-row">
              <span>
                All original routes airspace clear
              </span>

              <strong>
                {comparison?.all_routes_airspace_clear === true
                  ? "Yes"
                  : comparison?.all_routes_airspace_clear === false
                    ? "No"
                    : "—"}
              </strong>
            </div>

            <div className="ro-comparison-row">
              <span>
                All original missions feasible
              </span>

              <strong>
                {comparison?.all_original_missions_battery_and_airspace_feasible === true
                  ? "Yes"
                  : comparison?.all_original_missions_battery_and_airspace_feasible === false
                    ? "No"
                    : "—"}
              </strong>
            </div>

            <div className="ro-comparison-row">
              <span>
                All generated detours clear
              </span>

              <strong>
                {comparison?.all_detours_geometrically_clear === true
                  ? "Yes"
                  : comparison?.all_detours_geometrically_clear === false
                    ? "No"
                    : "—"}
              </strong>
            </div>

          </div>

          {/* DISCLAIMER */}

          <div className="ro-disclaimer">

            <AlertTriangle size={18} />

            <p>
              <strong>
                Simulation and safety disclaimer:
              </strong>{" "}
              Battery estimates use the configured Wh/km model.
              Airspace and detour checks use approximate geometry.
              Demo restricted zones are simulated examples, not
              official aviation restrictions or flight authorization.
            </p>

          </div>

          {/* USE SELECTED ROUTE */}

          {typeof onUseRoute === "function" && (

            <div className="ro-use-route">

              <div>
                <h3>Use selected route</h3>

                <p>
                  Send the selected algorithm route back to the
                  Mission Planner.
                </p>
              </div>

              <button
                className="ro-optimize-btn"
                onClick={handleUseRoute}
                disabled={!selectedRoute.length}
              >
                <Navigation size={16} />
                Use This Route
              </button>

            </div>

          )}

        </>
      )}

    </div>
  );
}
