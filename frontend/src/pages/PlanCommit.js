import React, { useContext, useState } from "react";
import { AppContext } from "../App";
import { 
  Target,
  Shield,
  AlertTriangle,
  Settings,
  Calendar,
  Package,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  CheckCircle
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart
} from "recharts";

export default function PlanCommit() {
  const { 
    currentDay, 
    dayData, 
    fullSeries,
    scenarioComparison,
    loading
  } = useContext(AppContext);

  const [selectedScenario, setSelectedScenario] = useState("proactive");
  const [customLevers, setCustomLevers] = useState({
    cleaning_cadence: 0,
    inhibitor_dose: 1.0,
    flush_frequency: 0,
    intervention_discipline: "medium"
  });

  if (loading || !dayData) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: "1rem" }}>Loading planning data...</p>
      </div>
    );
  }

  // Define scenarios with their impacts
  const scenarios = {
    baseline: {
      name: "Baseline Discipline",
      description: "Continue current operating practices with standard monitoring",
      icon: Target,
      effort: "Low",
      impacts: {
        remaining_days_delta: 0,
        ci_delta: 0,
        output_delta: 0,
        polymer_reduction: 0
      }
    },
    proactive: {
      name: "Proactive Protection",
      description: "Enhanced monitoring + preemptive maintenance before drift occurs",
      icon: Shield,
      effort: "Medium",
      impacts: {
        remaining_days_delta: 8,
        ci_delta: -2,
        output_delta: 2800,
        polymer_reduction: 15
      }
    },
    rescue: {
      name: "Run Rescue",
      description: "Aggressive intervention to recover from elevated risk state",
      icon: AlertTriangle,
      effort: "High",
      impacts: {
        remaining_days_delta: 14,
        ci_delta: -3,
        output_delta: 4500,
        polymer_reduction: 25
      }
    },
    custom: {
      name: "Custom",
      description: "Configure specific operating levers to model your scenario",
      icon: Settings,
      effort: "Variable",
      impacts: calculateCustomImpacts(customLevers)
    }
  };

  function calculateCustomImpacts(levers) {
    let days = 0;
    let ci = 0;
    let output = 0;
    let polymer = 0;

    // Cleaning cadence
    days += levers.cleaning_cadence * 3;
    polymer += levers.cleaning_cadence * 8;

    // Inhibitor dose
    if (levers.inhibitor_dose > 1.0) {
      days += Math.floor((levers.inhibitor_dose - 1.0) * 10);
      polymer += Math.floor((levers.inhibitor_dose - 1.0) * 20);
    }

    // Flush frequency
    days += levers.flush_frequency * 2;
    polymer += levers.flush_frequency * 5;

    // Intervention discipline
    if (levers.intervention_discipline === "high") {
      days += 5;
      ci -= 2;
    } else if (levers.intervention_discipline === "medium") {
      days += 2;
      ci -= 1;
    }

    output = days * 320; // Approximate output gain

    return {
      remaining_days_delta: days,
      ci_delta: ci,
      output_delta: output,
      polymer_reduction: polymer
    };
  }

  const activeScenario = scenarios[selectedScenario];
  const impacts = activeScenario.impacts;

  // Calculate scenario results
  const baseRemaining = dayData.predicted_remaining_days;
  const baseOutput = dayData.output_p50_tons;
  const baseCI = dayData.prediction_ci_90pct_days;
  
  const scenarioRemaining = baseRemaining + impacts.remaining_days_delta;
  const scenarioOutput = baseOutput + impacts.output_delta;
  const scenarioCI = Math.max(2, baseCI + impacts.ci_delta);

  // Calculate dates
  const baseEndDate = new Date(dayData.predicted_end_date_p50);
  const scenarioEndDate = new Date(baseEndDate);
  scenarioEndDate.setDate(scenarioEndDate.getDate() + impacts.remaining_days_delta);

  // Generate intervention windows
  const interventionWindows = [
    { start: currentDay + 3, end: currentDay + 10, type: "Recommended", reason: "Pre-drift maintenance window" },
    { start: currentDay + 25, end: currentDay + 32, type: "Optional", reason: "Mid-cycle optimization" }
  ];

  return (
    <div className="plan-commit" data-testid="plan-commit">
      {/* Header */}
      <div className="plan-header">
        <div className="plan-header-left">
          <h1 className="plan-title">Plan & Commit</h1>
          <span className="plan-subtitle">Scenario planning for run lifecycle decisions</span>
        </div>
        <span className="plan-demo-tag">Simulated / Demo</span>
      </div>

      {/* Scenario Cards */}
      <div className="scenario-cards">
        {Object.entries(scenarios).map(([key, scenario]) => (
          <ScenarioCard
            key={key}
            scenarioKey={key}
            scenario={scenario}
            isSelected={selectedScenario === key}
            onSelect={() => setSelectedScenario(key)}
            baseData={dayData}
          />
        ))}
      </div>

      {/* Custom Levers (only show when custom is selected) */}
      {selectedScenario === "custom" && (
        <CustomLeversPanel 
          levers={customLevers}
          setLevers={setCustomLevers}
        />
      )}

      {/* Scenario Results */}
      <div className="scenario-results">
        <div className="results-header">
          <span className="results-title">Scenario: {activeScenario.name}</span>
          <span className="results-effort">Effort: {activeScenario.effort}</span>
        </div>

        <div className="results-comparison">
          <div className="results-column baseline">
            <span className="column-title">Current Trajectory</span>
            <div className="result-item">
              <span className="result-label">Forecast End (P50)</span>
              <span className="result-value">{dayData.predicted_end_date_p50}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Days Remaining</span>
              <span className="result-value">{baseRemaining}d</span>
            </div>
            <div className="result-item">
              <span className="result-label">Expected Output (P50)</span>
              <span className="result-value">{baseOutput.toLocaleString()} t</span>
            </div>
            <div className="result-item">
              <span className="result-label">Confidence Interval</span>
              <span className="result-value">±{baseCI}d</span>
            </div>
          </div>

          <div className="results-arrow">
            <TrendingUp size={24} />
            {impacts.remaining_days_delta > 0 && (
              <span className="delta-badge positive">+{impacts.remaining_days_delta}d</span>
            )}
          </div>

          <div className="results-column scenario">
            <span className="column-title">With {activeScenario.name}</span>
            <div className="result-item">
              <span className="result-label">Forecast End (P50)</span>
              <span className="result-value highlight">{scenarioEndDate.toISOString().slice(0, 10)}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Days Remaining</span>
              <span className="result-value highlight">{scenarioRemaining}d</span>
            </div>
            <div className="result-item">
              <span className="result-label">Expected Output (P50)</span>
              <span className="result-value highlight">{scenarioOutput.toLocaleString()} t</span>
            </div>
            <div className="result-item">
              <span className="result-label">Confidence Interval</span>
              <span className="result-value highlight">±{scenarioCI}d</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline with Intervention Windows */}
      <div className="intervention-timeline">
        <div className="timeline-header">
          <Calendar size={16} />
          <span className="timeline-title">Intervention Windows & Output Delivery</span>
        </div>
        
        <div className="timeline-chart">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart 
              data={generateTimelineData(currentDay, dayData, impacts)}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 10, fill: "#64748B" }}
                tickFormatter={(v) => `D${v}`}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: "#64748B" }}
                tickFormatter={(v) => `${Math.round(v/1000)}k`}
              />
              <Tooltip 
                contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [`${v.toLocaleString()} t`, "Output"]}
              />
              <Area
                type="monotone"
                dataKey="baseline"
                stroke="#94A3B8"
                fill="#94A3B8"
                fillOpacity={0.1}
                strokeDasharray="4 4"
                name="Baseline"
              />
              <Area
                type="monotone"
                dataKey="scenario"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.2}
                name="With Scenario"
              />
              <ReferenceLine x={currentDay} stroke="#1E293B" strokeDasharray="3 3" label={{ value: "Today", fontSize: 10 }} />
              {/* Intervention windows */}
              {interventionWindows.map((w, idx) => (
                <ReferenceLine 
                  key={idx}
                  x={w.start} 
                  stroke={w.type === "Recommended" ? "#3B82F6" : "#94A3B8"}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="intervention-windows-list">
          {interventionWindows.map((w, idx) => (
            <div key={idx} className={`intervention-window ${w.type.toLowerCase()}`}>
              <span className="window-type">{w.type}</span>
              <span className="window-range">Day {w.start} – {w.end}</span>
              <span className="window-reason">{w.reason}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ scenarioKey, scenario, isSelected, onSelect, baseData }) {
  const Icon = scenario.icon;
  const impacts = scenario.impacts;
  
  const baseRemaining = baseData.predicted_remaining_days;
  const scenarioRemaining = baseRemaining + impacts.remaining_days_delta;
  
  const baseEndDate = new Date(baseData.predicted_end_date_p50);
  const scenarioEndDate = new Date(baseEndDate);
  scenarioEndDate.setDate(scenarioEndDate.getDate() + impacts.remaining_days_delta);

  return (
    <div 
      className={`scenario-card ${isSelected ? "selected" : ""} ${scenarioKey}`}
      onClick={onSelect}
      data-testid={`scenario-${scenarioKey}`}
    >
      <div className="scenario-card-header">
        <div className="scenario-icon">
          <Icon size={20} />
        </div>
        <div className="scenario-info">
          <span className="scenario-name">{scenario.name}</span>
          <span className="scenario-effort">Effort: {scenario.effort}</span>
        </div>
        {isSelected && <CheckCircle size={20} className="selected-check" />}
      </div>
      
      <p className="scenario-description">{scenario.description}</p>
      
      <div className="scenario-metrics">
        <div className="scenario-metric">
          <span className="metric-label">Forecast End (P50)</span>
          <span className="metric-value">{scenarioEndDate.toISOString().slice(0, 10)}</span>
        </div>
        <div className="scenario-metric">
          <span className="metric-label">Output (P90)</span>
          <span className="metric-value">{(baseData.output_p90_tons + impacts.output_delta * 0.9).toLocaleString()} t</span>
        </div>
        <div className="scenario-metric">
          <span className="metric-label">Shutdown (P90)</span>
          <span className="metric-value">{baseData.shutdown_window_start}</span>
        </div>
      </div>
      
      {impacts.remaining_days_delta > 0 && (
        <div className="scenario-delta">
          <span className="delta-positive">+{impacts.remaining_days_delta} days</span>
          <span className="delta-label">vs baseline</span>
        </div>
      )}
    </div>
  );
}

function CustomLeversPanel({ levers, setLevers }) {
  return (
    <div className="custom-levers-panel">
      <div className="levers-header">
        <Settings size={16} />
        <span>Configure Operating Levers</span>
      </div>
      
      <div className="levers-grid">
        <div className="lever-item">
          <label>Cleaning Cadence</label>
          <div className="lever-options">
            {[0, 1, 2].map(v => (
              <button
                key={v}
                className={`lever-option ${levers.cleaning_cadence === v ? "active" : ""}`}
                onClick={() => setLevers({...levers, cleaning_cadence: v})}
              >
                {v === 0 ? "Baseline" : `+${v}/wk`}
              </button>
            ))}
          </div>
        </div>
        
        <div className="lever-item">
          <label>Inhibitor Dose Index</label>
          <div className="lever-slider">
            <input
              type="range"
              min="0.9"
              max="1.3"
              step="0.05"
              value={levers.inhibitor_dose}
              onChange={(e) => setLevers({...levers, inhibitor_dose: parseFloat(e.target.value)})}
            />
            <span className="lever-value">{levers.inhibitor_dose.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="lever-item">
          <label>Flush Frequency</label>
          <div className="lever-options">
            {[0, 1, 2].map(v => (
              <button
                key={v}
                className={`lever-option ${levers.flush_frequency === v ? "active" : ""}`}
                onClick={() => setLevers({...levers, flush_frequency: v})}
              >
                {v === 0 ? "Baseline" : `+${v}/day`}
              </button>
            ))}
          </div>
        </div>
        
        <div className="lever-item">
          <label>Intervention Discipline</label>
          <div className="lever-options">
            {["low", "medium", "high"].map(v => (
              <button
                key={v}
                className={`lever-option ${levers.intervention_discipline === v ? "active" : ""}`}
                onClick={() => setLevers({...levers, intervention_discipline: v})}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function generateTimelineData(currentDay, dayData, impacts) {
  const data = [];
  let baselineCumulative = dayData.cumulative_output_tons || currentDay * 340;
  let scenarioCumulative = baselineCumulative;
  
  const baselineRate = dayData.eaa_output_tpd * 0.95;
  const scenarioRate = baselineRate * (1 + impacts.remaining_days_delta / 100);
  
  for (let day = currentDay; day <= 111; day++) {
    baselineCumulative += baselineRate;
    scenarioCumulative += scenarioRate;
    
    data.push({
      day,
      baseline: Math.round(baselineCumulative),
      scenario: Math.round(scenarioCumulative)
    });
  }
  
  return data;
}
