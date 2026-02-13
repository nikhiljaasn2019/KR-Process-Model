import React, { useContext, useState, useEffect } from "react";
import { AppContext, api } from "../App";
import { 
  FlaskConical,
  TrendingUp,
  Activity,
  Target,
  Gauge,
  ArrowRight,
  Info
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

export default function Simulator() {
  const { currentDay, dayData, timeSeries, loading } = useContext(AppContext);
  
  const [cleaningCadence, setCleaningCadence] = useState(0);
  const [inhibitorDose, setInhibitorDose] = useState(1.0);
  const [flushFrequency, setFlushFrequency] = useState(0);
  const [interventionDiscipline, setInterventionDiscipline] = useState("medium");
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    runSimulation();
  }, [cleaningCadence, inhibitorDose, flushFrequency, interventionDiscipline, currentDay]);

  const runSimulation = async () => {
    setSimulating(true);
    try {
      const response = await api.post("/simulate", {
        day: currentDay,
        cleaning_cadence: cleaningCadence,
        inhibitor_dose_index: inhibitorDose,
        flush_frequency: flushFrequency,
        intervention_discipline: interventionDiscipline
      });
      setSimulationResult(response.data);
    } catch (error) {
      console.error("Simulation error:", error);
    } finally {
      setSimulating(false);
    }
  };

  if (loading || !dayData) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: "1rem" }}>Loading simulator...</p>
      </div>
    );
  }

  return (
    <div className="simulator-page" data-testid="simulator">
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div className="section-title">
          <FlaskConical size={20} />
          What-If Simulator
        </div>
        <div className="simulated-label">
          <Info size={12} />
          Prototype / Simulated — Not plant-validated
        </div>
      </div>

      <div className="simulator-grid">
        {/* Controls */}
        <div className="simulator-controls" data-testid="sim-controls">
          <h3 style={{ fontSize: "1rem", marginBottom: "1.5rem", color: "#F8FAFC" }}>
            Adjust Operating Levers
          </h3>
          
          {/* Cleaning Cadence */}
          <div className="control-group">
            <label className="control-label">Cleaning Cadence</label>
            <div className="control-description">
              How often to schedule preventive cleaning cycles
            </div>
            <div className="control-options">
              {[
                { value: 0, label: "Baseline" },
                { value: 1, label: "+1 cycle/wk" },
                { value: 2, label: "+2 cycles/wk" }
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`control-option ${cleaningCadence === opt.value ? "active" : ""}`}
                  onClick={() => setCleaningCadence(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Inhibitor Dose */}
          <div className="control-group">
            <label className="control-label">Inhibitor Dose Index</label>
            <div className="control-description">
              Adjustment to inhibitor dosing rate (0.9–1.3 of baseline)
            </div>
            <input
              type="range"
              min="0.9"
              max="1.3"
              step="0.05"
              value={inhibitorDose}
              onChange={(e) => setInhibitorDose(parseFloat(e.target.value))}
              className="control-slider"
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748B" }}>
              <span>0.9</span>
              <span style={{ color: "#F8FAFC", fontWeight: 600 }}>{inhibitorDose.toFixed(2)}</span>
              <span>1.3</span>
            </div>
          </div>
          
          {/* Flush Frequency */}
          <div className="control-group">
            <label className="control-label">Flush Frequency</label>
            <div className="control-description">
              Additional flush cycles per day
            </div>
            <div className="control-options">
              {[
                { value: 0, label: "Baseline" },
                { value: 1, label: "+1 flush/day" }
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`control-option ${flushFrequency === opt.value ? "active" : ""}`}
                  onClick={() => setFlushFrequency(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Intervention Discipline */}
          <div className="control-group">
            <label className="control-label">Early Intervention Discipline</label>
            <div className="control-description">
              How aggressively the team responds to early warnings
            </div>
            <div className="control-options">
              {[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" }
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`control-option ${interventionDiscipline === opt.value ? "active" : ""}`}
                  onClick={() => setInterventionDiscipline(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="simulator-results" data-testid="sim-results">
          <h3 style={{ fontSize: "1rem", marginBottom: "1.5rem", color: "#F8FAFC" }}>
            Simulated Outcomes
          </h3>
          
          {simulating ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
              <p style={{ marginTop: "1rem", color: "#64748B" }}>Simulating...</p>
            </div>
          ) : simulationResult ? (
            <>
              <div className="result-comparison">
                {/* Before */}
                <div className="result-column">
                  <div className="result-column-title">Before (Current)</div>
                  <div className="result-item">
                    <span className="result-label">Health Score</span>
                    <span className="result-value">
                      {Math.round(simulationResult.baseline.run_health_score)}
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Remaining Days</span>
                    <span className="result-value">
                      {simulationResult.baseline.predicted_remaining_days}
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Output (TPD)</span>
                    <span className="result-value">
                      {Math.round(simulationResult.baseline.eaa_output_tpd)}
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Total Output</span>
                    <span className="result-value">
                      {simulationResult.baseline.expected_total_output_tons?.toLocaleString()}t
                    </span>
                  </div>
                </div>
                
                {/* After */}
                <div className="result-column after">
                  <div className="result-column-title">After (Simulated)</div>
                  <div className="result-item">
                    <span className="result-label">Health Score</span>
                    <span className="result-value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {Math.round(simulationResult.simulated.run_health_score)}
                      {simulationResult.deltas.health_score !== 0 && (
                        <span className={`delta-badge ${simulationResult.deltas.health_score > 0 ? "positive" : "negative"}`}>
                          {simulationResult.deltas.health_score > 0 ? "+" : ""}
                          {simulationResult.deltas.health_score.toFixed(1)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Remaining Days</span>
                    <span className="result-value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {simulationResult.simulated.predicted_remaining_days}
                      {simulationResult.deltas.remaining_days !== 0 && (
                        <span className={`delta-badge ${simulationResult.deltas.remaining_days > 0 ? "positive" : "negative"}`}>
                          {simulationResult.deltas.remaining_days > 0 ? "+" : ""}
                          {simulationResult.deltas.remaining_days}d
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Output (TPD)</span>
                    <span className="result-value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {Math.round(simulationResult.simulated.eaa_output_tpd)}
                      {simulationResult.deltas.output_tpd !== 0 && (
                        <span className={`delta-badge ${simulationResult.deltas.output_tpd > 0 ? "positive" : "negative"}`}>
                          {simulationResult.deltas.output_tpd > 0 ? "+" : ""}
                          {simulationResult.deltas.output_tpd.toFixed(0)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Total Output</span>
                    <span className="result-value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {simulationResult.simulated.expected_total_output_tons?.toLocaleString()}t
                      {simulationResult.deltas.total_output !== 0 && (
                        <span className={`delta-badge ${simulationResult.deltas.total_output > 0 ? "positive" : "negative"}`}>
                          {simulationResult.deltas.total_output > 0 ? "+" : ""}
                          {simulationResult.deltas.total_output?.toLocaleString()}t
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Key Insight */}
              <div style={{ 
                padding: "1rem",
                background: "rgba(59, 130, 246, 0.1)",
                borderRadius: "8px",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                marginTop: "1rem"
              }}>
                <div style={{ fontSize: "0.75rem", color: "#3B82F6", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Key Insight
                </div>
                <div style={{ fontSize: "0.8125rem", color: "#94A3B8", lineHeight: 1.5 }}>
                  {simulationResult.deltas.remaining_days > 5 
                    ? `With these adjustments, the run could extend by ${simulationResult.deltas.remaining_days} days, yielding an additional ${simulationResult.deltas.total_output?.toLocaleString()} tons of output.`
                    : simulationResult.deltas.remaining_days > 0
                    ? `Moderate improvement expected: +${simulationResult.deltas.remaining_days} days run extension.`
                    : "Current settings close to optimal for this run phase."
                  }
                </div>
                <div className="simulated-label" style={{ marginTop: "0.75rem" }}>
                  <Info size={10} />
                  Results are illustrative only — not plant-validated predictions
                </div>
              </div>
              
              {/* Predicted End Date */}
              <div style={{ 
                marginTop: "1rem",
                padding: "1rem",
                background: "#242E42",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <div style={{ fontSize: "0.6875rem", color: "#64748B", textTransform: "uppercase" }}>
                    Simulated End Date
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#F8FAFC" }}>
                    {simulationResult.simulated.predicted_end_date}
                  </div>
                </div>
                <ArrowRight size={20} style={{ color: "#64748B" }} />
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.6875rem", color: "#64748B", textTransform: "uppercase" }}>
                    vs Baseline
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 600, color: "#64748B" }}>
                    {simulationResult.baseline.predicted_end_date}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
