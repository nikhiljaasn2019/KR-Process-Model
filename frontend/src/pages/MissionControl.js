import React, { useContext, useState } from "react";
import { AppContext } from "../App";
import { 
  TrendingUp, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Activity,
  Beaker,
  Clock,
  ChevronRight,
  ChevronDown,
  X,
  Radio,
  Filter,
  ThermometerSun,
  FileText,
  Database,
  AlertCircle,
  Check,
  XCircle,
  Eye,
  Zap,
  Shield,
  TrendingDown,
  Calendar,
  Package,
  ArrowRight,
  ToggleLeft,
  ToggleRight
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
  ReferenceLine,
  ReferenceDot,
  ComposedChart,
  Bar
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
    handleDayChange,
    actionStatuses,
    updateActionStatus,
    events,
    scenarioComparison
  } = useContext(AppContext);

  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);

  if (loading || !dayData) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: "1rem" }}>Loading decision data...</p>
      </div>
    );
  }

  const progressPercent = (currentDay / 111) * 100;

  return (
    <div className="page-content" data-testid="mission-control">
      <div className="main-area">
        {/* Day Controls */}
        <DayControls 
          currentDay={currentDay}
          dayData={dayData}
          quickDays={quickDays}
          onDayChange={handleDayChange}
          onOpenEvidence={() => setEvidenceDrawerOpen(true)}
        />

        {/* Side-by-Side Scenario Comparison */}
        <ScenarioComparison 
          dayData={dayData}
          comparison={scenarioComparison}
        />

        {/* Hero KPI Row */}
        <HeroSection dayData={dayData} />

        {/* Benchmark Progress Bar */}
        <ProgressSection 
          currentDay={currentDay}
          dayData={dayData}
          comparison={scenarioComparison}
        />

        {/* Run Plan - Output Trajectory with Events */}
        <RunPlanSection 
          timeSeries={timeSeries} 
          currentDay={currentDay} 
          dayData={dayData}
          events={events}
        />

        {/* Two Column Layout: Drivers + Fouling */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <DriversSection drivers={dayData.drivers || []} />
          <FoulingSection dayData={dayData} timeSeries={timeSeries} events={events} />
        </div>

        {/* What Changed Timeline */}
        <WhatChangedSection changes={whatChanged} events={events} />
      </div>

      {/* Right Rail - Actions */}
      <RightRail 
        actions={dayData.actions || []} 
        currentDay={currentDay}
        actionStatuses={actionStatuses}
        updateActionStatus={updateActionStatus}
      />

      {/* Evidence Drawer */}
      {evidenceDrawerOpen && (
        <EvidenceDrawer 
          events={events}
          onClose={() => setEvidenceDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function DayControls({ currentDay, dayData, quickDays, onDayChange, onOpenEvidence }) {
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
        <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginRight: "0.5rem" }}>Jump to:</span>
        {quickDays.map((item) => (
          <button
            key={item.day}
            className={`quick-day-btn ${currentDay === item.day ? "active" : ""}`}
            onClick={() => onDayChange(item.day)}
            data-testid={`quick-day-${item.day}`}
            title={item.moment}
          >
            {item.day}
          </button>
        ))}
      </div>

      <button 
        className="evidence-btn"
        onClick={onOpenEvidence}
        data-testid="open-evidence-btn"
      >
        <Radio size={14} />
        Evidence
      </button>
    </div>
  );
}

function ScenarioToggle({ mode, setMode, comparison }) {
  if (!comparison) return null;

  const delta = comparison.deltas;

  return (
    <div className="scenario-toggle-bar" data-testid="scenario-toggle">
      <div className="scenario-toggle-label">
        <Zap size={14} />
        <span>Scenario View</span>
      </div>
      
      <div className="scenario-toggle-options">
        <button 
          className={`scenario-btn ${mode === "do_nothing" ? "active" : ""}`}
          onClick={() => setMode("do_nothing")}
        >
          <TrendingDown size={14} />
          If we do nothing
        </button>
        <button 
          className={`scenario-btn ${mode === "execute_moves" ? "active green" : ""}`}
          onClick={() => setMode("execute_moves")}
        >
          <CheckCircle size={14} />
          If we execute Today's Moves
          {delta && delta.remaining_days > 0 && (
            <span className="scenario-delta">+{delta.remaining_days}d</span>
          )}
        </button>
      </div>

      <div className="prototype-label">
        <AlertCircle size={10} />
        Prototype / Simulated
      </div>
    </div>
  );
}

function GoldenGapTile({ dayData, activeScenario, scenarioMode }) {
  const goldenTarget = 111;
  const forecastEndDay = activeScenario?.forecast_end_day || dayData.forecast_end_day_p50;
  const gap = forecastEndDay - goldenTarget;
  const isOnTrack = gap >= 0;

  return (
    <div className={`decision-tile golden-gap ${isOnTrack ? "on-track" : "behind"}`} data-testid="golden-gap">
      <div className="decision-tile-header">
        <div className="decision-tile-icon">
          <Target size={18} />
        </div>
        <span className="decision-tile-title">Golden Gap</span>
        {scenarioMode === "execute_moves" && (
          <span className="simulated-badge">Simulated</span>
        )}
      </div>
      
      <div className="golden-gap-content">
        <div className="golden-gap-main">
          <div className={`golden-gap-value ${isOnTrack ? "positive" : "negative"}`}>
            {gap >= 0 ? "+" : ""}{gap}
          </div>
          <div className="golden-gap-unit">days vs Golden</div>
        </div>
        
        <div className="golden-gap-details">
          <div className="detail-row">
            <span className="detail-label">Golden Target</span>
            <span className="detail-value">{goldenTarget} days</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Forecast (P50)</span>
            <span className="detail-value">{activeScenario?.predicted_end_date_p50 || dayData.predicted_end_date_p50}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Forecast (P90)</span>
            <span className="detail-value">{activeScenario?.predicted_end_date_p90 || dayData.predicted_end_date_p90}</span>
          </div>
        </div>
      </div>
      
      <div className={`golden-gap-status ${isOnTrack ? "on-track" : "behind"}`}>
        {isOnTrack ? (
          <>
            <CheckCircle size={14} />
            <span>On track to beat Golden</span>
          </>
        ) : (
          <>
            <AlertTriangle size={14} />
            <span>{Math.abs(gap)} days behind Golden target</span>
          </>
        )}
      </div>
    </div>
  );
}

function CommitmentView({ dayData, activeScenario, scenarioMode }) {
  const p90 = activeScenario?.output_p90_tons || dayData.output_p90_tons;
  const p50 = activeScenario?.output_p50_tons || dayData.output_p50_tons;
  const p10 = activeScenario?.output_p10_tons || dayData.output_p10_tons;
  const shutdownStart = activeScenario?.shutdown_window_start || dayData.shutdown_window_start;
  const shutdownEnd = activeScenario?.shutdown_window_end || dayData.shutdown_window_end;

  return (
    <div className="decision-tile commitment-view" data-testid="commitment-view">
      <div className="decision-tile-header">
        <div className="decision-tile-icon">
          <Package size={18} />
        </div>
        <span className="decision-tile-title">Commitment View (for ED)</span>
        {scenarioMode === "execute_moves" && (
          <span className="simulated-badge">Simulated</span>
        )}
      </div>
      
      <div className="commitment-content">
        <div className="commitment-row committed">
          <div className="commitment-label">
            <span className="commitment-tag">P90</span>
            Committed Output
          </div>
          <div className="commitment-value">
            {p90.toLocaleString()} <span className="unit">tons</span>
          </div>
        </div>
        
        <div className="commitment-row expected">
          <div className="commitment-label">
            <span className="commitment-tag blue">P50</span>
            Expected Output
          </div>
          <div className="commitment-value">
            {p50.toLocaleString()} <span className="unit">tons</span>
          </div>
        </div>
        
        <div className="commitment-row upside">
          <div className="commitment-label">
            <span className="commitment-tag green">P10</span>
            Upside Output
          </div>
          <div className="commitment-value">
            {p10.toLocaleString()} <span className="unit">tons</span>
          </div>
        </div>
        
        <div className="commitment-shutdown">
          <div className="shutdown-label">
            <Calendar size={14} />
            Shutdown Window (P90)
          </div>
          <div className="shutdown-dates">
            {shutdownStart} → {shutdownEnd}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection({ dayData, activeScenario, scenarioMode }) {
  const healthScore = activeScenario?.run_health_score || dayData.run_health_score;
  const healthColor = healthScore >= 80 ? "#10B981" : healthScore >= 60 ? "#F59E0B" : "#EF4444";
  
  const circumference = 2 * Math.PI * 35;
  const offset = circumference - (healthScore / 100) * circumference;
  
  const predictabilityBands = dayData.predictability_score === "High" ? 5 : 
                               dayData.predictability_score === "Medium" ? 3 : 1;

  return (
    <div className="hero-grid" data-testid="hero-section">
      {/* Health Score Gauge */}
      <div className="hero-tile">
        <div className="hero-tile-header">
          <span className="hero-tile-label">Run Health</span>
          {scenarioMode === "execute_moves" && <span className="simulated-mini">SIM</span>}
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
            {Math.round(healthScore)}
          </div>
        </div>
        <div className="hero-tile-sub" style={{ textAlign: "center" }}>
          {healthScore >= 80 ? "Healthy" : healthScore >= 60 ? "Watch" : "At Risk"}
        </div>
      </div>

      {/* Remaining Days */}
      <div className="hero-tile">
        <div className="hero-tile-header">
          <span className="hero-tile-label">Days Remaining</span>
        </div>
        <div className="hero-tile-value" style={{ fontSize: "2rem" }}>
          {activeScenario?.predicted_remaining_days || dayData.predicted_remaining_days}
        </div>
        <div className="hero-tile-sub">
          ±{dayData.prediction_ci_90pct_days}d CI (90%)
        </div>
      </div>

      {/* Predictability */}
      <div className="hero-tile">
        <div className="hero-tile-header">
          <span className="hero-tile-label">Predictability</span>
          <span className={`hero-tile-badge ${dayData.predictability_score === "High" ? "green" : dayData.predictability_score === "Medium" ? "yellow" : "red"}`}>
            {dayData.predictability_score}
          </span>
        </div>
        <div className="predictability-bands" style={{ margin: "1rem 0" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div 
              key={i} 
              className={`pred-band ${i <= predictabilityBands ? "active" : ""} ${dayData.predictability_score === "Medium" && i <= predictabilityBands ? "medium" : ""}`}
            ></div>
          ))}
        </div>
        <div className="hero-tile-sub" style={{ textAlign: "center" }}>
          Confidence: {dayData.predictability_score === "High" ? "Tight" : dayData.predictability_score === "Medium" ? "Moderate" : "Wide"}
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
      </div>
    </div>
  );
}

function ProgressSection({ currentDay, dayData, activeScenario, scenarioMode }) {
  const progressPercent = (currentDay / 111) * 100;
  const forecastEndDay = activeScenario?.forecast_end_day || dayData.forecast_end_day_p50;
  const projectedEndPercent = (forecastEndDay / 111) * 100;
  const ci = dayData.prediction_ci_90pct_days;

  return (
    <div className="progress-section" data-testid="progress-section">
      <div className="progress-header">
        <span className="progress-title">Golden Run Progress</span>
        <span className="golden-info">
          Golden Candidate: 02-Dec-2024 → 23-Mar-2025 (111 days)
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
            className={`projection-overlay ${scenarioMode === "execute_moves" ? "simulated" : ""}`}
            style={{ 
              left: `${progressPercent}%`,
              width: `${Math.min(100, projectedEndPercent) - progressPercent}%`
            }}
          >
            <span className="projection-label">
              P50: {activeScenario?.predicted_end_date_p50 || dayData.predicted_end_date_p50}
            </span>
          </div>
        )}
        
        {/* Golden target marker */}
        <div className="golden-target-marker">
          <span className="golden-target-label">Golden: 111d</span>
        </div>
      </div>
      
      <div className="progress-labels">
        <span>Day 1</span>
        <span>Day 111 (Golden)</span>
      </div>
    </div>
  );
}

function RunPlanSection({ timeSeries, currentDay, dayData, events }) {
  // Add event markers to chart data
  const chartData = timeSeries.map(d => {
    const dayEvents = events?.events?.filter(e => e.day === d.day) || [];
    return {
      day: d.day,
      output: Math.round(d.eaa_output_tpd),
      polymer: Math.round(d.polymer_burden_kg_per_day),
      health: d.run_health_score,
      hasEvent: dayEvents.length > 0,
      eventType: dayEvents[0]?.type,
      eventSeverity: dayEvents[0]?.severity
    };
  });

  // Find events for markers
  const eventMarkers = events?.events?.filter(e => e.day <= currentDay) || [];

  return (
    <div className="run-plan-section" data-testid="run-plan">
      <div className="section-header">
        <span className="section-title">
          <TrendingUp size={16} />
          Output Trajectory
        </span>
        <div style={{ display: "flex", gap: "1rem", fontSize: "0.6875rem" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ width: 8, height: 8, background: "#3B82F6", borderRadius: "50%" }}></span>
            Output (TPD)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ width: 8, height: 8, background: "#F59E0B", borderRadius: "50%" }}></span>
            Polymer (kg/day)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ width: 8, height: 2, background: "#EF4444" }}></span>
            Events
          </span>
        </div>
      </div>
      
      <div className="chart-container" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
            />
            <YAxis 
              yAxisId="output"
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              domain={[280, 380]}
              orientation="left"
            />
            <YAxis 
              yAxisId="polymer"
              tick={{ fontSize: 10, fill: "#F59E0B" }}
              axisLine={{ stroke: "#F59E0B" }}
              domain={[0, 1200]}
              orientation="right"
            />
            <Tooltip 
              contentStyle={{ 
                background: "#FFFFFF", 
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
              }}
              formatter={(value, name) => {
                if (name === "output") return [value + " TPD", "Output"];
                if (name === "polymer") return [value + " kg/day", "Polymer"];
                return [value, name];
              }}
            />
            <Area 
              yAxisId="output"
              type="monotone" 
              dataKey="output" 
              stroke="#3B82F6" 
              strokeWidth={2}
              fill="url(#outputGradient)"
            />
            <Line
              yAxisId="polymer"
              type="monotone"
              dataKey="polymer"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={false}
            />
            <ReferenceLine yAxisId="output" x={currentDay} stroke="#1E293B" strokeDasharray="5 5" />
            
            {/* Event markers */}
            {eventMarkers.map((event, idx) => (
              <ReferenceLine 
                key={idx}
                yAxisId="output"
                x={event.day} 
                stroke={event.severity === "high" ? "#EF4444" : event.severity === "medium" ? "#F59E0B" : "#3B82F6"}
                strokeWidth={2}
                strokeDasharray="3 3"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Event legend */}
      <div className="event-markers-legend">
        {eventMarkers.slice(-3).map((event, idx) => (
          <div key={idx} className={`event-marker-item ${event.severity}`}>
            <span className="event-marker-day">Day {event.day}</span>
            <span className="event-marker-type">{event.type.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
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
            Top Drivers
          </span>
        </div>
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
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
          Top Drivers (Why At Risk?)
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

function FoulingSection({ dayData, timeSeries, events }) {
  const polymerColor = dayData.polymer_build_index > 70 ? "#EF4444" : 
                       dayData.polymer_build_index > 40 ? "#F59E0B" : "#10B981";

  // Get recent filter cleaning events
  const filterEvents = events?.events?.filter(e => 
    e.type === "FILTER_CLEANING_SPIKE" && e.day <= dayData.day
  ).slice(-2) || [];

  return (
    <div className="fouling-section" data-testid="fouling-section">
      <div className="section-header">
        <span className="section-title">
          <Beaker size={16} />
          Fouling & Polymer
        </span>
      </div>
      
      <div className="fouling-metrics">
        <div className="fouling-metric">
          <div className="fouling-metric-value" style={{ color: polymerColor }}>
            {dayData.polymer_build_index}
          </div>
          <div className="fouling-metric-label">Polymer Index (0-100)</div>
        </div>
        <div className="fouling-metric">
          <div className="fouling-metric-value">
            {Math.round(dayData.polymer_burden_kg_per_day)}
          </div>
          <div className="fouling-metric-label">Burden (kg/day)</div>
        </div>
        <div className="fouling-metric">
          <div className="fouling-metric-value">
            {dayData.filter_change_count_per_day.toFixed(1)}
          </div>
          <div className="fouling-metric-label">Filter Δ (/day)</div>
        </div>
      </div>
      
      {/* Recent filter events */}
      {filterEvents.length > 0 && (
        <div className="filter-events">
          {filterEvents.map((evt, idx) => (
            <div key={idx} className={`filter-event ${evt.severity}`}>
              <span className="filter-event-day">Day {evt.day}</span>
              <span className="filter-event-note">{evt.operator_note?.slice(0, 50)}...</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Mini trend chart */}
      <div style={{ height: 80, marginTop: "0.75rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeSeries.slice(-14)} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#64748B" }} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#64748B" }} axisLine={false} />
            <Line type="monotone" dataKey="polymer_burden_kg_per_day" stroke="#F59E0B" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WhatChangedSection({ changes, events }) {
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
              <div style={{ fontSize: "0.5625rem", color: "var(--text-muted)" }}>{change.date}</div>
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
                <div key={i} className="timeline-event-note">
                  <strong>{evt.type.replace(/_/g, " ")}</strong>: {evt.operator_note?.slice(0, 60)}...
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RightRail({ actions, currentDay, actionStatuses, updateActionStatus }) {
  // Calculate completion stats
  const completedCount = actions.filter(a => 
    actionStatuses[a.id]?.status === "Done"
  ).length;
  const acknowledgedCount = actions.filter(a => 
    actionStatuses[a.id]?.status === "Acknowledged"
  ).length;

  return (
    <div className="right-rail">
      <div className="moves-panel" data-testid="moves-panel">
        <div className="moves-header">
          <div>
            <span className="moves-title">Actions to be taken today</span>
            <div className="moves-subtitle">
              {completedCount}/{actions.length} done • {acknowledgedCount} acknowledged
            </div>
          </div>
          <span className="moves-count">{actions.length}</span>
        </div>
        <div className="moves-list">
          {actions.map((action, idx) => (
            <ActionCard 
              key={action.id} 
              action={action} 
              priority={idx + 1}
              status={actionStatuses[action.id]?.status || "New"}
              reasonCode={actionStatuses[action.id]?.reason_code}
              onUpdateStatus={updateActionStatus}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action, priority, status, reasonCode, onUpdateStatus }) {
  const [expanded, setExpanded] = useState(priority === 1 && status === "New");
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  
  // Only apply status styling if this specific action was marked (not inherited from other days)
  const isActuallyMarked = status === "Done" || status === "Not Feasible";
  
  const urgencyConfig = {
    "critical": { bg: "#FEE2E2", border: "#EF4444", label: "CRITICAL", color: "#EF4444" },
    "high": { bg: "#FEF3C7", border: "#F59E0B", label: "HIGH", color: "#F59E0B" },
    "medium": { bg: "#E0E7FF", border: "#6366F1", label: "MEDIUM", color: "#6366F1" },
    "routine": { bg: "#F1F5F9", border: "#94A3B8", label: "ROUTINE", color: "#94A3B8" }
  };
  
  const statusConfig = {
    "New": { bg: "var(--bg-card)", border: "var(--border)", icon: null },
    "Acknowledged": { bg: "#FEF3C7", border: "#F59E0B", icon: <Eye size={14} color="#F59E0B" /> },
    "Done": { bg: "#D1FAE5", border: "#10B981", icon: <Check size={14} color="#10B981" /> },
    "Not Feasible": { bg: "#FEE2E2", border: "#EF4444", icon: <XCircle size={14} color="#EF4444" /> }
  };

  const urgency = urgencyConfig[action.urgency] || urgencyConfig["medium"];
  const currentStatus = statusConfig[status] || statusConfig["New"];
  const trigger = action.trigger || {};
  const expectedEffect = action.expected_effect || {};
  const impact = action.impact_on_done || {};

  const reasonCodes = [
    { code: "UTILITY_CONSTRAINT", label: "Utility constraint" },
    { code: "EQUIPMENT_ISSUE", label: "Equipment not available" },
    { code: "PERSONNEL_UNAVAILABLE", label: "Personnel unavailable" },
    { code: "ALREADY_ADDRESSED", label: "Already addressed by previous shift" },
    { code: "OUT_OF_SCOPE", label: "Out of scope for this run phase" },
    { code: "OTHER", label: "Other (see note)" }
  ];
  
  const handleNotFeasible = (code) => {
    onUpdateStatus(action.id, "Not Feasible", code);
    setShowReasonDialog(false);
  };

  return (
    <div 
      className={`move-card ${action.urgency}`}
      data-testid={`move-card-${action.id}`}
      style={{ 
        background: isActuallyMarked ? currentStatus.bg : urgency.bg,
        borderColor: isActuallyMarked ? currentStatus.border : urgency.border
      }}
    >
      <div className="move-card-header" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        <div className="move-priority" style={{ 
          background: status === "Done" ? "#10B981" : status === "Not Feasible" ? "#9CA3AF" : urgency.color
        }}>
          {status === "Done" ? <Check size={14} /> : priority}
        </div>
        <div className="move-title-section">
          <div className="move-title-row">
            <div className="move-title">
              {action.title}
            </div>
            <span className={`urgency-badge ${action.urgency}`}>{urgency.label}</span>
          </div>
          <div className="move-protects">
            <Shield size={12} />
            Protects: {action.protects}
            {isActuallyMarked && (
              <span className="action-status-inline">
                {currentStatus.icon}
                {status}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
      </div>
      
      {expanded && (
        <>
          <div className="move-card-body">
            {/* Trigger section */}
            <div className="trigger-section">
              <div className="trigger-header">TRIGGER</div>
              <div className="trigger-grid">
                <div className="trigger-item">
                  <span className="trigger-label">Metric</span>
                  <span className="trigger-value">{trigger.metric}</span>
                </div>
                <div className="trigger-item">
                  <span className="trigger-label">Current</span>
                  <span className="trigger-value warning">{trigger.current}</span>
                </div>
                <div className="trigger-item">
                  <span className="trigger-label">Baseline</span>
                  <span className="trigger-value">{trigger.baseline}</span>
                </div>
                <div className="trigger-item">
                  <span className="trigger-label">Deviation</span>
                  <span className="trigger-value critical">{trigger.deviation}</span>
                </div>
              </div>
              <div className="trigger-timewindow">
                <Clock size={12} />
                {trigger.time_window}
              </div>
            </div>

            {/* Assets */}
            <div className="assets-section">
              <span className="assets-label">Assets:</span>
              <div className="assets-tags">
                {action.where?.map((tag, i) => (
                  <span key={i} className="asset-tag">{tag}</span>
                ))}
              </div>
            </div>
            
            <div className="move-why-box">
              <strong>Why:</strong> {action.why}
            </div>
            
            <div className="move-checklist">
              <div className="move-checklist-title">Action Checklist</div>
              <div className="move-checklist-items">
                {action.checklist?.map((item, idx) => (
                  <div key={idx} className="move-checklist-item">
                    <span className="move-checklist-bullet">{idx + 1}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Expected Effect */}
            <div className="expected-effect-section">
              <div className="expected-effect-header">
                <TrendingUp size={14} />
                Expected Effect (Simulated)
              </div>
              <div className="expected-effect-grid">
                {expectedEffect.run_length && (
                  <div className="effect-item">
                    <span className="effect-label">Run Length</span>
                    <span className="effect-value positive">{expectedEffect.run_length}</span>
                  </div>
                )}
                {expectedEffect.polymer_slope && (
                  <div className="effect-item">
                    <span className="effect-label">Polymer</span>
                    <span className="effect-value">{expectedEffect.polymer_slope}</span>
                  </div>
                )}
                {expectedEffect.productivity && (
                  <div className="effect-item">
                    <span className="effect-label">Productivity</span>
                    <span className="effect-value">{expectedEffect.productivity}</span>
                  </div>
                )}
              </div>
              {impact.remaining_days_delta > 0 && (
                <div className="impact-preview">
                  <Zap size={12} />
                  Marking Done will add +{impact.remaining_days_delta} days to forecast
                </div>
              )}
            </div>
          </div>
          
          {status === "New" && (
            <div className="move-card-footer">
              <button 
                className="move-btn"
                onClick={() => onUpdateStatus(action.id, "Acknowledged")}
                data-testid={`acknowledge-${action.id}`}
              >
                <Eye size={14} />
                Acknowledge
              </button>
              <button 
                className="move-btn primary"
                onClick={() => onUpdateStatus(action.id, "Done")}
                data-testid={`done-${action.id}`}
              >
                <Check size={14} />
                Done
              </button>
              <button 
                className="move-btn danger"
                onClick={() => setShowReasonDialog(true)}
                data-testid={`not-feasible-${action.id}`}
              >
                <XCircle size={14} />
                Not Feasible
              </button>
            </div>
          )}

          {status === "Acknowledged" && (
            <div className="move-card-footer">
              <button 
                className="move-btn primary"
                onClick={() => onUpdateStatus(action.id, "Done")}
              >
                <Check size={14} />
                Mark Done
              </button>
              <button 
                className="move-btn danger"
                onClick={() => setShowReasonDialog(true)}
              >
                <XCircle size={14} />
                Not Feasible
              </button>
            </div>
          )}
          
          {status === "Done" && impact.remaining_days_delta > 0 && (
            <div className="done-impact-bar">
              <CheckCircle size={14} />
              <span>Impact applied: +{impact.remaining_days_delta} days, +{impact.health_score_delta} health</span>
            </div>
          )}
        </>
      )}

      {/* Reason Code Dialog */}
      {showReasonDialog && (
        <div className="reason-dialog-overlay" onClick={() => setShowReasonDialog(false)}>
          <div className="reason-dialog" onClick={e => e.stopPropagation()}>
            <div className="reason-dialog-header">
              <span>Select Reason</span>
              <button onClick={() => setShowReasonDialog(false)} className="reason-dialog-close">
                <X size={16} />
              </button>
            </div>
            <div className="reason-dialog-body">
              {reasonCodes.map(rc => (
                <button
                  key={rc.code}
                  className="reason-option"
                  onClick={() => handleNotFeasible(rc.code)}
                >
                  {rc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceDrawer({ events, onClose }) {
  const [activeFilter, setActiveFilter] = useState("all");

  if (!events) return null;

  const filterOptions = [
    { id: "all", label: "All Events" },
    { id: "FILTER_CLEANING_SPIKE", label: "Polymer/Filters" },
    { id: "TEMP_EXCURSION", label: "Temperature" },
    { id: "FOULING_RISK_CLUSTER", label: "Fouling Risk" },
    { id: "RUN_RESCUE_MODE", label: "Rescue Mode" },
    { id: "PREDICTED_END_SHIFT", label: "Prediction Shifts" }
  ];

  const filteredEvents = activeFilter === "all" 
    ? events.events 
    : events.events.filter(e => e.type === activeFilter);

  const getEventIcon = (type) => {
    switch (type) {
      case "FILTER_CLEANING_SPIKE": return <Filter size={14} />;
      case "TEMP_EXCURSION": return <ThermometerSun size={14} />;
      case "FOULING_RISK_CLUSTER": return <AlertTriangle size={14} />;
      case "RUN_RESCUE_MODE": return <Activity size={14} />;
      case "PREDICTED_END_SHIFT": return <Clock size={14} />;
      default: return <AlertCircle size={14} />;
    }
  };

  return (
    <div className="evidence-drawer-overlay" onClick={onClose}>
      <div className="evidence-drawer" onClick={e => e.stopPropagation()} data-testid="evidence-drawer">
        <div className="evidence-drawer-header">
          <div className="section-title">
            <Radio size={18} />
            Evidence & Event Timeline
          </div>
          <button className="drawer-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="evidence-drawer-content">
          {/* Filters */}
          <div className="evidence-filters">
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                className={`filter-chip ${activeFilter === opt.id ? "active" : ""}`}
                onClick={() => setActiveFilter(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Event List */}
          <div className="evidence-events-list">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event, idx) => (
                <div key={idx} className="evidence-event-card">
                  <div className="evidence-event-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {getEventIcon(event.type)}
                      <span className="evidence-event-type">{event.type.replace(/_/g, " ")}</span>
                    </div>
                    <span className={`evidence-event-severity ${event.severity}`}>
                      {event.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="evidence-event-day">Day {event.day}</div>
                  <div className="evidence-event-assets">
                    {event.asset_tags?.map((tag, i) => (
                      <span key={i} className="evidence-asset-tag">{tag}</span>
                    ))}
                  </div>
                  <div className="evidence-event-note">"{event.operator_note}"</div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                No events matching filter
              </div>
            )}
          </div>

          {/* Sidebar Info */}
          <div className="evidence-sidebar-section">
            <h4><FileText size={14} /> Recent Shift Logs</h4>
            {events.shift_logs.slice(0, 2).map((log, idx) => (
              <div key={idx} className="evidence-shift-log">
                <div className="evidence-shift-header">
                  <span>Day {log.day} - Shift {log.shift}</span>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    {log.flags?.map((flag, i) => (
                      <span key={i} className={`evidence-flag ${flag === "HIGH_RISK" ? "high" : ""}`}>
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="evidence-shift-summary">{log.summary}</div>
              </div>
            ))}
          </div>

          <div className="evidence-sidebar-section">
            <h4><Database size={14} /> Data Pipeline Status</h4>
            {events.pipeline_status.map((pipe, idx) => (
              <div key={idx} className="evidence-pipeline-item">
                <span>{pipe.source.replace(/_/g, " ")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
                    {pipe.last_seen_hours_ago}h ago
                  </span>
                  <span className={`evidence-pipeline-status ${pipe.status.toLowerCase()}`}>
                    {pipe.status === "BROKEN" ? "Feed broken" : pipe.status === "LATE" ? "Feed late" : pipe.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
