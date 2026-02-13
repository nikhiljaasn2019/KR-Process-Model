import React, { useContext, useMemo } from "react";
import { AppContext } from "../App";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Activity,
  Gauge,
  Filter,
  Beaker,
  Clock,
  ChevronRight
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from "recharts";

export default function MissionControl() {
  const { 
    currentDay, 
    dayData, 
    runInfo, 
    timeSeries, 
    whatChanged,
    quickDays,
    loading, 
    handleDayChange 
  } = useContext(AppContext);

  if (loading || !dayData) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: "1rem" }}>Loading mission data...</p>
      </div>
    );
  }

  const progressPercent = (currentDay / 111) * 100;
  const projectedEndPercent = ((currentDay + dayData.predicted_remaining_days) / 111) * 100;

  return (
    <div className="page-content" data-testid="mission-control">
      <div className="main-area">
        {/* Day Controls */}
        <DayControls 
          currentDay={currentDay}
          dayData={dayData}
          quickDays={quickDays}
          onDayChange={handleDayChange}
        />

        {/* Hero KPI Tiles */}
        <HeroSection dayData={dayData} />

        {/* Golden Progress Bar */}
        <ProgressSection 
          currentDay={currentDay}
          dayData={dayData}
          progressPercent={progressPercent}
          projectedEndPercent={projectedEndPercent}
        />

        {/* Run Plan - Output Trajectory */}
        <RunPlanSection timeSeries={timeSeries} currentDay={currentDay} dayData={dayData} />

        {/* Two Column Layout: Drivers + Fouling */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <DriversSection drivers={dayData.drivers || []} />
          <FoulingSection dayData={dayData} timeSeries={timeSeries} />
        </div>

        {/* What Changed Timeline */}
        <WhatChangedSection changes={whatChanged} />
      </div>

      {/* Right Rail - Today's Moves */}
      <RightRail actions={dayData.actions || []} currentDay={currentDay} />
    </div>
  );
}

function DayControls({ currentDay, dayData, quickDays, onDayChange }) {
  return (
    <div className="day-controls" data-testid="day-controls">
      <div>
        <div className="day-label">Run Day</div>
        <div className="day-display">Day {currentDay} of 111</div>
        <div className="day-date">{dayData.current_date_display}</div>
      </div>
      
      <div className="day-slider" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        const day = Math.max(1, Math.min(111, Math.round(percent * 111)));
        onDayChange(day);
      }}>
        <div className="day-slider-fill" style={{ width: `${(currentDay / 111) * 100}%` }}>
          <div className="day-slider-thumb" style={{ left: "100%" }}></div>
        </div>
      </div>
      
      <div className="quick-days">
        {quickDays.map((item) => (
          <button
            key={item.day}
            className={`quick-day-btn ${currentDay === item.day ? "active" : ""}`}
            onClick={() => onDayChange(item.day)}
            data-testid={`quick-day-${item.day}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HeroSection({ dayData }) {
  const healthColor = dayData.run_health_score >= 80 ? "#10B981" : 
                      dayData.run_health_score >= 60 ? "#F59E0B" : "#EF4444";
  
  const circumference = 2 * Math.PI * 35;
  const offset = circumference - (dayData.run_health_score / 100) * circumference;
  
  const predictabilityBands = dayData.predictability_score === "High" ? 5 : 
                               dayData.predictability_score === "Medium" ? 3 : 1;

  return (
    <div className="hero-grid" data-testid="hero-section">
      {/* Health Score Gauge */}
      <div className="hero-tile">
        <div className="hero-tile-header">
          <span className="hero-tile-label">Run Health Score</span>
        </div>
        <div className="health-gauge">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle className="health-gauge-bg" cx="40" cy="40" r="35" />
            <circle 
              className="health-gauge-fill"
              cx="40" cy="40" r="35"
              stroke={healthColor}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="health-gauge-value" style={{ color: healthColor }}>
            {Math.round(dayData.run_health_score)}
          </div>
        </div>
        <div className="hero-tile-sub" style={{ textAlign: "center" }}>
          {dayData.run_health_score >= 80 ? "Healthy" : 
           dayData.run_health_score >= 60 ? "Watch" : "At Risk"}
        </div>
      </div>

      {/* Predicted Run End */}
      <div className="hero-tile">
        <div className="hero-tile-header">
          <span className="hero-tile-label">Predicted Run End</span>
          <span className="hero-tile-badge" style={{ 
            background: "rgba(59, 130, 246, 0.2)", 
            color: "#3B82F6" 
          }}>
            ±{dayData.prediction_ci_90pct_days}d CI
          </span>
        </div>
        <div className="hero-tile-value" style={{ fontSize: "1.5rem" }}>
          {dayData.predicted_end_date}
        </div>
        <div className="hero-tile-sub">
          {dayData.predicted_end_date_early} – {dayData.predicted_end_date_late}
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#94A3B8" }}>
          {dayData.predicted_remaining_days} days remaining
        </div>
      </div>

      {/* Predictability */}
      <div className="hero-tile">
        <div className="hero-tile-header">
          <span className="hero-tile-label">Predictability</span>
          <span className="hero-tile-badge" style={{ 
            background: dayData.predictability_score === "High" ? "rgba(16, 185, 129, 0.2)" :
                       dayData.predictability_score === "Medium" ? "rgba(245, 158, 11, 0.2)" :
                       "rgba(239, 68, 68, 0.2)",
            color: dayData.predictability_score === "High" ? "#10B981" :
                   dayData.predictability_score === "Medium" ? "#F59E0B" : "#EF4444"
          }}>
            {dayData.predictability_score}
          </span>
        </div>
        <div className="hero-tile-value" style={{ fontSize: "1.5rem" }}>
          {dayData.predictability_score}
        </div>
        <div className="predictability-bands">
          {[1, 2, 3, 4, 5].map((i) => (
            <div 
              key={i} 
              className={`pred-band ${i <= predictabilityBands ? "active" : ""} ${dayData.predictability_score === "Medium" && i <= predictabilityBands ? "medium" : ""}`}
            ></div>
          ))}
        </div>
        <div className="hero-tile-sub" style={{ textAlign: "center", marginTop: "0.5rem" }}>
          Confidence band tightening
        </div>
      </div>

      {/* Output Today */}
      <div className="hero-tile">
        <div className="hero-tile-header">
          <span className="hero-tile-label">Output Today</span>
        </div>
        <div className="hero-tile-value">
          {Math.round(dayData.eaa_output_tpd)} <span style={{ fontSize: "1rem", fontWeight: 500 }}>TPD</span>
        </div>
        <div className="hero-tile-sub">
          Band: {dayData.eaa_output_band_min}–{dayData.eaa_output_band_max} TPD
        </div>
        <div style={{ 
          marginTop: "0.75rem", 
          padding: "0.5rem 0.75rem", 
          background: "rgba(59, 130, 246, 0.1)", 
          borderRadius: "6px",
          fontSize: "0.75rem"
        }}>
          <div style={{ color: "#94A3B8" }}>Expected Total Till End</div>
          <div style={{ fontWeight: 700, color: "#F8FAFC", fontSize: "1rem" }}>
            {dayData.expected_total_output_tons?.toLocaleString()} tons
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressSection({ currentDay, dayData, progressPercent, projectedEndPercent }) {
  return (
    <div className="progress-section" data-testid="progress-section">
      <div className="progress-header">
        <span className="progress-title">Golden Run Progress</span>
        <span className="golden-info">
          Golden Run Candidate: 02-Dec-2024 → 23-Mar-2025 (~111 days)
        </span>
      </div>
      
      <div className="golden-progress-bar">
        {/* Current progress fill */}
        <div className="progress-fill" style={{ width: `${progressPercent}%` }}>
          <div className="progress-marker">
            <span className="progress-marker-label">Day {currentDay}</span>
          </div>
        </div>
        
        {/* Projection overlay */}
        {projectedEndPercent > progressPercent && (
          <div 
            className="projection-overlay"
            style={{ 
              left: `${progressPercent}%`,
              width: `${Math.min(100, projectedEndPercent) - progressPercent}%`
            }}
          >
            <span className="projection-label">
              Projected: {dayData.predicted_end_date_early} – {dayData.predicted_end_date_late}
            </span>
          </div>
        )}
        
        {/* Golden target marker */}
        <div className="golden-target-marker">
          <span className="golden-target-label">Golden: 111 days</span>
        </div>
      </div>
      
      <div className="progress-labels">
        <span>Day 1 (02-Dec-2024)</span>
        <span>Day 111 (23-Mar-2025)</span>
      </div>
    </div>
  );
}

function RunPlanSection({ timeSeries, currentDay, dayData }) {
  const chartData = timeSeries.map(d => ({
    day: d.day,
    output: Math.round(d.eaa_output_tpd),
    cumulative: Math.round(d.cumulative_output_tons / 1000), // In thousands
    health: d.run_health_score
  }));

  // Forecast data (simple projection)
  const forecastData = [];
  const lastOutput = dayData.eaa_output_tpd;
  for (let i = 1; i <= dayData.predicted_remaining_days && currentDay + i <= 111; i++) {
    const decay = 1 - (i / dayData.predicted_remaining_days) * 0.1;
    forecastData.push({
      day: currentDay + i,
      output: Math.round(lastOutput * decay),
      forecast: true
    });
  }

  const showIntervention = dayData.fouling_risk_index > 4;
  const interventionStart = currentDay + 5;
  const interventionEnd = currentDay + 12;

  return (
    <div className="run-plan-section" data-testid="run-plan">
      <div className="section-header">
        <span className="section-title">
          <TrendingUp size={16} />
          Run Plan: Output Trajectory
        </span>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[...chartData, ...forecastData]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3548" />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#2A3548" }}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#2A3548" }}
              domain={[280, 380]}
            />
            <Tooltip 
              contentStyle={{ 
                background: "#1A2234", 
                border: "1px solid #2A3548",
                borderRadius: 8,
                fontSize: 12
              }}
              formatter={(value, name) => [value, name === "output" ? "Output (TPD)" : name]}
            />
            <Area 
              type="monotone" 
              dataKey="output" 
              stroke="#3B82F6" 
              strokeWidth={2}
              fill="url(#outputGradient)"
            />
            <ReferenceLine x={currentDay} stroke="#F8FAFC" strokeDasharray="5 5" />
            {showIntervention && (
              <ReferenceLine 
                x={interventionStart} 
                stroke="#F59E0B" 
                strokeDasharray="3 3"
                label={{ value: "Window Start", fill: "#F59E0B", fontSize: 10 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {showIntervention && (
        <div className="intervention-window">
          <AlertTriangle size={18} className="intervention-icon" />
          <div className="intervention-content">
            <div className="intervention-title">
              Recommended Intervention Window: Day {interventionStart}–{interventionEnd}
            </div>
            <div className="intervention-detail">
              Proactive cleaning during this window reduces unplanned termination risk by ~25% (simulated)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriversSection({ drivers }) {
  if (drivers.length === 0) {
    return (
      <div className="drivers-section">
        <div className="section-header">
          <span className="section-title">
            <AlertTriangle size={16} />
            Top 5 Drivers
          </span>
        </div>
        <div style={{ padding: "2rem", textAlign: "center", color: "#64748B" }}>
          <CheckCircle size={24} style={{ color: "#10B981", marginBottom: "0.5rem" }} />
          <div>All metrics within baseline bands</div>
        </div>
      </div>
    );
  }

  return (
    <div className="drivers-section" data-testid="drivers-section">
      <div className="section-header">
        <span className="section-title">
          <AlertTriangle size={16} />
          Top 5 Drivers (Why At Risk?)
        </span>
      </div>
      <div className="drivers-list">
        {drivers.map((driver, idx) => (
          <div key={idx} className={`driver-item ${driver.severity}`}>
            <div className="driver-info">
              <div className="driver-metric">
                <span className="driver-direction">{driver.direction}</span>
                {driver.metric}
              </div>
              <div className="driver-values">
                Current: {driver.current_value} • Baseline: {driver.baseline}
              </div>
            </div>
            <div className="driver-sparkline">
              <svg viewBox="0 0 60 24" width="60" height="24">
                <polyline
                  fill="none"
                  stroke={driver.severity === "high" ? "#EF4444" : "#F59E0B"}
                  strokeWidth="2"
                  points={driver.trend_data?.map((v, i) => 
                    `${i * 8},${24 - (v / Math.max(...driver.trend_data)) * 20}`
                  ).join(" ") || "0,12 60,12"}
                />
              </svg>
            </div>
            <div className="driver-since">Since Day {driver.since_day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FoulingSection({ dayData, timeSeries }) {
  const polymerColor = dayData.polymer_build_index > 70 ? "#EF4444" : 
                       dayData.polymer_build_index > 40 ? "#F59E0B" : "#10B981";

  return (
    <div className="fouling-section" data-testid="fouling-section">
      <div className="section-header">
        <span className="section-title">
          <Beaker size={16} />
          Fouling & Polymer Build
        </span>
      </div>
      
      <div className="fouling-metrics">
        <div className="fouling-metric">
          <div className="fouling-metric-value" style={{ color: polymerColor }}>
            {dayData.polymer_build_index}
          </div>
          <div className="fouling-metric-label">Polymer Build Index (0-100)</div>
        </div>
        <div className="fouling-metric">
          <div className="fouling-metric-value" style={{ color: "#F8FAFC" }}>
            {Math.round(dayData.polymer_burden_kg_per_day)}
          </div>
          <div className="fouling-metric-label">Polymer Burden (kg/day)</div>
        </div>
        <div className="fouling-metric">
          <div className="fouling-metric-value" style={{ color: "#F8FAFC" }}>
            {dayData.filter_change_count_per_day.toFixed(1)}
          </div>
          <div className="fouling-metric-label">Filter Changes (/day)</div>
        </div>
      </div>
      
      {/* Mini trend chart */}
      <div style={{ height: 100, marginTop: "1rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeSeries.slice(-14)} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3548" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#64748B" }} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#64748B" }} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: "#1A2234", border: "1px solid #2A3548", fontSize: 11 }}
            />
            <Line type="monotone" dataKey="polymer_burden_kg_per_day" stroke="#F59E0B" strokeWidth={2} dot={false} name="Polymer (kg/d)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WhatChangedSection({ changes }) {
  return (
    <div className="what-changed-section" data-testid="what-changed">
      <div className="section-header">
        <span className="section-title">
          <Clock size={16} />
          What Changed (Last 7 Days)
        </span>
      </div>
      <div className="timeline-items">
        {changes.slice().reverse().map((change) => (
          <div 
            key={change.day} 
            className={`timeline-item ${change.has_event ? "has-event" : ""}`}
          >
            <div className="timeline-day">
              Day {change.day}
              <div style={{ fontSize: "0.5625rem", color: "#64748B" }}>{change.date}</div>
            </div>
            <div className="timeline-content">
              <div className="timeline-metrics">
                <div className="timeline-metric">
                  <span className="timeline-metric-label">Health:</span>
                  <span className="timeline-metric-value">{change.health_score}</span>
                  {change.health_delta !== 0 && (
                    <span className={`timeline-delta ${change.health_delta > 0 ? "positive" : "negative"}`}>
                      {change.health_delta > 0 ? "+" : ""}{change.health_delta.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="timeline-metric">
                  <span className="timeline-metric-label">Remaining:</span>
                  <span className="timeline-metric-value">{change.remaining_days}d</span>
                </div>
                <div className="timeline-metric">
                  <span className="timeline-metric-label">Output:</span>
                  <span className="timeline-metric-value">{change.output_tpd}</span>
                </div>
              </div>
              {change.has_event && change.events.map((evt, i) => (
                <div key={i} style={{ 
                  marginTop: "0.5rem", 
                  padding: "0.375rem 0.5rem",
                  background: "#242E42",
                  borderRadius: "4px",
                  fontSize: "0.6875rem",
                  color: "#F59E0B"
                }}>
                  <strong>{evt.type}</strong>: {evt.operator_note?.slice(0, 60)}...
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RightRail({ actions, currentDay }) {
  return (
    <div className="right-rail">
      <div className="moves-panel" data-testid="moves-panel">
        <div className="moves-header">
          <span className="moves-title">Today's 3 Moves</span>
          <span className="moves-count">{actions.length}</span>
        </div>
        <div className="moves-list">
          {actions.map((action, idx) => (
            <ActionCard key={action.id} action={action} priority={idx + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action, priority }) {
  const [expanded, setExpanded] = React.useState(priority === 1);
  
  return (
    <div className="move-card" data-testid={`move-card-${action.id}`}>
      <div className="move-card-header" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        <div className="move-priority">{priority}</div>
        <div className="move-title-section">
          <div className="move-title">{action.title}</div>
          <div className="move-trigger">
            {action.metric} • {action.time_window}
          </div>
        </div>
        <ChevronRight size={16} style={{ 
          color: "#64748B", 
          transform: expanded ? "rotate(90deg)" : "none",
          transition: "transform 0.2s"
        }} />
      </div>
      
      {expanded && (
        <>
          <div className="move-card-body">
            <div className="move-metric-row">
              <span className="move-metric-label">Current</span>
              <span className="move-metric-value warning">{action.current_value}</span>
            </div>
            <div className="move-metric-row">
              <span className="move-metric-label">Baseline</span>
              <span className="move-metric-value">{action.baseline}</span>
            </div>
            <div className="move-metric-row">
              <span className="move-metric-label">Assets</span>
              <span className="move-metric-value" style={{ fontSize: "0.6875rem" }}>
                {action.where?.join(", ")}
              </span>
            </div>
            
            <div style={{ 
              margin: "0.75rem 0", 
              padding: "0.5rem 0.625rem",
              background: "#242E42",
              borderRadius: "6px",
              fontSize: "0.6875rem",
              color: "#94A3B8"
            }}>
              <strong style={{ color: "#F8FAFC" }}>Why:</strong> {action.why}
            </div>
            
            <div className="move-checklist">
              <div className="move-checklist-title">Action Checklist</div>
              <div className="move-checklist-items">
                {action.checklist?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="move-checklist-item">
                    <span className="move-checklist-bullet"></span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="move-expected">
              <CheckCircle size={14} />
              <span>{action.expected_effect}</span>
            </div>
          </div>
          
          <div className="move-card-footer">
            <button className="move-btn">Acknowledge</button>
            <button className="move-btn primary">Done</button>
            <button className="move-btn">Not Feasible</button>
          </div>
        </>
      )}
    </div>
  );
}
