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
  Eye
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
    handleDayChange,
    actionStatuses,
    updateActionStatus,
    events
  } = useContext(AppContext);

  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);

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
          onOpenEvidence={() => setEvidenceDrawerOpen(true)}
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

      <button 
        className="evidence-btn"
        onClick={onOpenEvidence}
        data-testid="open-evidence-btn"
      >
        <Radio size={16} />
        Evidence
      </button>
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
          <span className="hero-tile-badge blue">
            ±{dayData.prediction_ci_90pct_days}d CI
          </span>
        </div>
        <div className="hero-tile-value" style={{ fontSize: "1.5rem" }}>
          {dayData.predicted_end_date}
        </div>
        <div className="hero-tile-sub">
          {dayData.predicted_end_date_early} – {dayData.predicted_end_date_late}
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {dayData.predicted_remaining_days} days remaining
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
        <div className="output-total-box">
          <div style={{ color: "var(--text-muted)" }}>Expected Total Till End</div>
          <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem" }}>
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
    cumulative: Math.round(d.cumulative_output_tons / 1000),
    health: d.run_health_score
  }));

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
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              domain={[280, 380]}
            />
            <Tooltip 
              contentStyle={{ 
                background: "#FFFFFF", 
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
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
            <ReferenceLine x={currentDay} stroke="#1E293B" strokeDasharray="5 5" />
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
          <div className="fouling-metric-value">
            {Math.round(dayData.polymer_burden_kg_per_day)}
          </div>
          <div className="fouling-metric-label">Polymer Burden (kg/day)</div>
        </div>
        <div className="fouling-metric">
          <div className="fouling-metric-value">
            {dayData.filter_change_count_per_day.toFixed(1)}
          </div>
          <div className="fouling-metric-label">Filter Changes (/day)</div>
        </div>
      </div>
      
      {/* Mini trend chart */}
      <div style={{ height: 100, marginTop: "1rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeSeries.slice(-14)} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#64748B" }} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#64748B" }} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", fontSize: 11 }}
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
            <span className="moves-title">Today's Moves</span>
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
  
  const statusConfig = {
    "New": { bg: "var(--bg-card)", border: "var(--border)", icon: null },
    "Acknowledged": { bg: "#FEF3C7", border: "#F59E0B", icon: <Eye size={14} color="#F59E0B" /> },
    "Done": { bg: "#D1FAE5", border: "#10B981", icon: <Check size={14} color="#10B981" /> },
    "Not Feasible": { bg: "#FEE2E2", border: "#EF4444", icon: <XCircle size={14} color="#EF4444" /> }
  };

  const currentConfig = statusConfig[status] || statusConfig["New"];

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
      className="move-card" 
      data-testid={`move-card-${action.id}`}
      style={{ 
        background: currentConfig.bg,
        borderColor: currentConfig.border
      }}
    >
      <div className="move-card-header" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        <div className="move-priority" style={{ 
          background: status === "Done" ? "#10B981" : status === "Not Feasible" ? "#9CA3AF" : "var(--accent-blue)"
        }}>
          {status === "Done" ? <Check size={14} /> : priority}
        </div>
        <div className="move-title-section">
          <div className="move-title" style={{ 
            textDecoration: status === "Done" || status === "Not Feasible" ? "line-through" : "none",
            opacity: status === "Done" || status === "Not Feasible" ? 0.7 : 1
          }}>
            {action.title}
          </div>
          <div className="move-trigger">
            {action.metric} • {action.time_window}
            {status !== "New" && (
              <span className="status-badge" style={{ marginLeft: "0.5rem" }}>
                {currentConfig.icon}
                {status}
                {reasonCode && ` (${reasonCode.replace(/_/g, " ").toLowerCase()})`}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
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
            
            <div className="move-why-box">
              <strong style={{ color: "var(--text-primary)" }}>Why:</strong> {action.why}
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
                    {pipe.status}
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
