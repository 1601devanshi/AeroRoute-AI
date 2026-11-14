
import { useCallback, useEffect, useState } from "react";
import {
  Plane,
  BatteryCharging,
  Package,
  Gauge,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import "./DroneFleet.css";
import { getDroneFleet } from "../api.js";

export default function DroneFleet({
  selectedDrone,
  onSelectDrone,
  onFleetLoaded
}) {
  const [drones, setDrones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFleet = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getDroneFleet();

      if (!Array.isArray(data.drones)) {
        throw new Error("Invalid fleet response from backend.");
      }

      setDrones(data.drones);
      onFleetLoaded?.(data.drones);
    } catch (err) {
      setError(err.message || "Unable to connect to the fleet API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  return (
    <section className="drone-fleet">
      <div className="fleet-heading">
        <div>
          <span className="fleet-eyebrow">FLIGHT MANAGEMENT</span>
          <h2>Drone Fleet</h2>
          <p>Select a drone for your mission simulation.</p>
        </div>

        <button
          type="button"
          className="fleet-refresh"
          onClick={loadFleet}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? "fleet-spinning" : ""}
          />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="fleet-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button type="button" onClick={loadFleet}>
            Try again
          </button>
        </div>
      )}

      {loading && drones.length === 0 && (
        <div className="fleet-message" aria-live="polite">
          Loading drone fleet...
        </div>
      )}

      {!loading && !error && drones.length === 0 && (
        <div className="fleet-message">
          No drones available.
        </div>
      )}

      <div className="fleet-grid">
        {drones.map((drone) => {
          const selected = selectedDrone?.id === drone.id;

          return (
            <button
              key={drone.id}
              type="button"
              className={`fleet-card ${selected ? "selected" : ""}`}
              onClick={() => onSelectDrone?.(drone)}
              aria-pressed={selected}
            >
              <div className="fleet-card-top">
                <div className="fleet-icon">
                  <Plane size={23} />
                </div>

                {selected && (
                  <CheckCircle2
                    size={20}
                    className="fleet-selected-icon"
                  />
                )}
              </div>

              <span className="fleet-category">
                {drone.category || "General Purpose"}
              </span>

              <h3>{drone.name || drone.id}</h3>

              <p>
                {drone.description || "Available for mission simulation."}
              </p>

              <div className="fleet-specs">
                <div>
                  <BatteryCharging size={16} />
                  <span>
                    {drone.battery_capacity_wh ?? "—"} Wh
                  </span>
                </div>

                <div>
                  <Package size={16} />
                  <span>
                    {drone.maximum_payload_kg ?? "—"} kg payload
                  </span>
                </div>

                <div>
                  <Gauge size={16} />
                  <span>
                    {drone.maximum_range_km ?? "—"} km nominal range
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedDrone && (
        <div className="fleet-selection" aria-live="polite">
          Selected drone:{" "}
          <strong>{selectedDrone.name || selectedDrone.id}</strong>
        </div>
      )}
    </section>
  );
}
