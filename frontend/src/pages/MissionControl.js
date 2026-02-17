import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../App";
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Package,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Filter,
  ArrowRight,
  Clock
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
  ComposedChart,
  ReferenceLine,
  ReferenceDot
} from "recharts";

export default function MissionControl() {
  const { 
    currentDay, 
    dayData, 
    fullSeries,
    loading, 
    events,
    scenarioComparison
  } = useContext(AppContext);

  if (loading || !dayData) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: "1rem" }}>Loading mission data...</p>
      </div>
    );
  }

  return (
    <div className="mission-control" data-testid="mission-control">
      {/* ZONE A: Hero Triptych */}
      <div className="hero-triptych">
        <RunEndChart 
          dayData={dayData} 
          fullSeries={fullSeries} 
          currentDay={currentDay}
          scenarioComparison={scenarioComparison}
        />
        <OutputChart 
          dayData={dayData} 
          fullSeries={fullSeries} 
          currentDay={currentDay}
          scenarioComparison={scenarioComparison}
        />
        <PolymerChart 
          dayData={dayData} 
          fullSeries={fullSeries} 
          currentDay={currentDay}
          events={events}
        />
      </div>

      {/* ZONE B: Commitment Box */}
      <CommitmentBox dayData={dayData} scenarioComparison={scenarioComparison} />

      {/* ZONE C: Priority Actions Preview */}
      <PriorityActionsPreview actions={dayData.actions || []} />
    </div>
  );
}

function RunEndChart({ dayData, fullSeries, currentDay, scenarioComparison }) {
  const benchmarkEndDay = 111;
  const forecastEndDay = dayData.forecast_end_day_p50;
  const deviation = forecastEndDay - benchmarkEndDay;
  const isAhead = deviation >= 0;

  // Generate chart data with benchmark, actual, and forecast
  const chartData = [];
  
  // Actual data up to current day
  fullSeries.slice(0, currentDay).forEach(d => {
    chartData.push({
      day: d.day,
      benchmark: 111 - d.day, // Benchmark: linear path to day 111
      actual: d.predicted_remaining_days + d.day, // Convert to end day
      actualRemaining: d.predicted_remaining_days
    });
  });

  // Forecast data from current day
  const ci = dayData.prediction_ci_90pct_days;
  for (let i = currentDay; i <= 111; i++) {
    const daysFromNow = i - currentDay;
    const decay = Math.max(0, dayData.predicted_remaining_days - daysFromNow);
    chartData.push({
      day: i,
      benchmark: 111 - i,
      forecast: decay,
      forecastP10: Math.max(0, decay + ci * 0.5),
      forecastP90: Math.max(0, decay - ci * 0.5)
    });
  }

  return (
    <div className="triptych-card">
      <div className="triptych-header">
        <div className="triptych-title">
          <Calendar size={16} />
          Run End Path
        </div>
        <div className="triptych-metrics">
          <div className="metric-block">
            <span className="metric-label">Forecast End (P50)</span>
            <span className="metric-value">{dayData.predicted_end_date_p50}</span>
          </div>
          <div className="metric-block">
            <span className="metric-label">Window (P90)</span>
            <span className="metric-value small">{dayData.predicted_end_date_p90} – {dayData.predicted_end_date_p10}</span>
          </div>
        </div>
        <div className={`deviation-badge ${isAhead ? "ahead" : "behind"}`}>
          {isAhead ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{isAhead ? "+" : ""}{deviation}d vs Best</span>
        </div>
      </div>
      
      <div className="triptych-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickFormatter={(v) => v % 20 === 0 ? `D${v}` : ""}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              label={{ value: 'Days Remaining', angle: -90, position: 'insideLeft', fontSize: 10, fill: "#64748B" }}
            />
            <Tooltip 
              contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 11 }}
              formatter={(value, name) => [Math.round(value), name]}
            />
            {/* Benchmark (dotted) */}
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke="#94A3B8" 
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              name="Best Run"
            />
            {/* Actual (solid) */}
            <Line 
              type="monotone" 
              dataKey="actualRemaining" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={false}
              name="Actual"
            />
            {/* Forecast cone */}
            <Area
              type="monotone"
              dataKey="forecastP10"
              stroke="none"
              fill="#3B82F6"
              fillOpacity={0.1}
              name="P10"
            />
            <Area
              type="monotone"
              dataKey="forecastP90"
              stroke="none"
              fill="#fff"
              fillOpacity={1}
            />
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke="#3B82F6" 
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              name="Forecast"
            />
            <ReferenceLine x={currentDay} stroke="#1E293B" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="triptych-legend">
        <span className="legend-item"><span className="legend-line dotted"></span>Best Run</span>
        <span className="legend-item"><span className="legend-line solid blue"></span>Actual</span>
        <span className="legend-item"><span className="legend-line dashed blue"></span>Forecast</span>
        <span className="legend-item"><span className="legend-area blue"></span>P10-P90</span>
      </div>
    </div>
  );
}

function OutputChart({ dayData, fullSeries, currentDay, scenarioComparison }) {
  const p90Output = dayData.output_p90_tons;
  const p50Output = dayData.output_p50_tons;

  // Generate chart data
  const chartData = [];
  let cumulativeActual = 0;
  let cumulativeBenchmark = 0;
  
  fullSeries.slice(0, currentDay).forEach(d => {
    cumulativeActual += d.eaa_output_tpd;
    cumulativeBenchmark += 340; // Benchmark average
    chartData.push({
      day: d.day,
      benchmark: Math.round(cumulativeBenchmark),
      actual: Math.round(cumulativeActual),
      output: Math.round(d.eaa_output_tpd)
    });
  });

  // Forecast
  const avgOutput = dayData.eaa_output_tpd * 0.95;
  let cumulativeForecast = cumulativeActual;
  for (let i = currentDay + 1; i <= 111; i++) {
    cumulativeForecast += avgOutput;
    cumulativeBenchmark += 340;
    chartData.push({
      day: i,
      benchmark: Math.round(cumulativeBenchmark),
      forecast: Math.round(cumulativeForecast)
    });
  }

  return (
    <div className="triptych-card">
      <div className="triptych-header">
        <div className="triptych-title">
          <Package size={16} />
          Output Path
        </div>
        <div className="triptych-metrics">
          <div className="metric-block">
            <span className="metric-label">Committed (P90)</span>
            <span className="metric-value">{p90Output.toLocaleString()} t</span>
          </div>
          <div className="metric-block">
            <span className="metric-label">Expected (P50)</span>
            <span className="metric-value">{p50Output.toLocaleString()} t</span>
          </div>
        </div>
        <div className="shutdown-badge">
          <Calendar size={12} />
          <span>Shutdown: {dayData.shutdown_window_start?.slice(5)} – {dayData.shutdown_window_end?.slice(5)}</span>
        </div>
      </div>
      
      <div className="triptych-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickFormatter={(v) => v % 20 === 0 ? `D${v}` : ""}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickFormatter={(v) => `${Math.round(v/1000)}k`}
              label={{ value: 'Cumulative (t)', angle: -90, position: 'insideLeft', fontSize: 10, fill: "#64748B" }}
            />
            <Tooltip 
              contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 11 }}
              formatter={(value, name) => [`${value.toLocaleString()} t`, name]}
            />
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke="#94A3B8" 
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              name="Best Run"
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#10B981" 
              strokeWidth={2}
              dot={false}
              name="Actual"
            />
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke="#10B981" 
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              name="Forecast"
            />
            <ReferenceLine x={currentDay} stroke="#1E293B" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="triptych-legend">
        <span className="legend-item"><span className="legend-line dotted"></span>Best Run</span>
        <span className="legend-item"><span className="legend-line solid green"></span>Actual</span>
        <span className="legend-item"><span className="legend-line dashed green"></span>Forecast</span>
      </div>
    </div>
  );
}

function PolymerChart({ dayData, fullSeries, currentDay, events }) {
  const polymerTrend = dayData.polymer_burden_kg_per_day > 600 ? "Rising" : 
                       dayData.polymer_burden_kg_per_day > 300 ? "Stable" : "Improving";
  const filterChanges = dayData.filter_change_count_per_day;

  // Generate chart data
  const chartData = fullSeries.slice(0, currentDay).map(d => ({
    day: d.day,
    polymer: Math.round(d.polymer_burden_kg_per_day),
    benchmark: 180, // Benchmark polymer burden
    hasEvent: events?.events?.some(e => e.day === d.day && 
      (e.type === "FILTER_CLEANING_SPIKE" || e.type === "RUN_RESCUE_MODE"))
  }));

  // Get event markers
  const eventMarkers = events?.events?.filter(e => 
    e.day <= currentDay && 
    (e.type === "FILTER_CLEANING_SPIKE" || e.type === "RUN_RESCUE_MODE" || e.type === "PREDICTED_END_SHIFT")
  ) || [];

  return (
    <div className="triptych-card">
      <div className="triptych-header">
        <div className="triptych-title">
          <Filter size={16} />
          Polymer / Fouling Path
        </div>
        <div className="triptych-metrics">
          <div className="metric-block">
            <span className="metric-label">Trend</span>
            <span className={`metric-value trend ${polymerTrend.toLowerCase()}`}>{polymerTrend}</span>
          </div>
          <div className="metric-block">
            <span className="metric-label">Filter Δ/day</span>
            <span className="metric-value">{filterChanges.toFixed(1)}</span>
          </div>
        </div>
        <div className="polymer-badge">
          <span>{Math.round(dayData.polymer_burden_kg_per_day)} kg/day</span>
        </div>
      </div>
      
      <div className="triptych-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickFormatter={(v) => v % 20 === 0 ? `D${v}` : ""}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              label={{ value: 'kg/day', angle: -90, position: 'insideLeft', fontSize: 10, fill: "#64748B" }}
            />
            <Tooltip 
              contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 11 }}
              formatter={(value, name) => [`${value} kg/day`, name]}
            />
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke="#94A3B8" 
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              name="Best Run"
            />
            <Line 
              type="monotone" 
              dataKey="polymer" 
              stroke="#F59E0B" 
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.hasEvent) {
                  return <circle cx={cx} cy={cy} r={4} fill="#EF4444" stroke="#fff" strokeWidth={1} />;
                }
                return null;
              }}
              name="Actual"
            />
            <ReferenceLine x={currentDay} stroke="#1E293B" strokeDasharray="3 3" />
            {/* Event markers */}
            {eventMarkers.slice(-3).map((event, idx) => (
              <ReferenceLine 
                key={idx}
                x={event.day} 
                stroke={event.type === "RUN_RESCUE_MODE" ? "#EF4444" : "#F59E0B"}
                strokeWidth={2}
                strokeDasharray="2 2"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="triptych-legend">
        <span className="legend-item"><span className="legend-line dotted"></span>Best Run</span>
        <span className="legend-item"><span className="legend-line solid orange"></span>Actual</span>
        <span className="legend-item"><span className="legend-dot red"></span>Event</span>
      </div>
      
      {/* Event chips */}
      {eventMarkers.length > 0 && (
        <div className="event-chips">
          {eventMarkers.slice(-2).map((event, idx) => (
            <span key={idx} className={`event-chip ${event.severity}`}>
              D{event.day}: {event.type.replace(/_/g, " ").toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CommitmentBox({ dayData, scenarioComparison }) {
  const doNothing = scenarioComparison?.do_nothing;
  const executeMoves = scenarioComparison?.execute_moves;
  
  return (
    <div className="commitment-box" data-testid="commitment-box">
      <div className="commitment-box-header">
        <span className="commitment-box-title">Run Planning & Commitments</span>
        <span className="demo-tag">Simulated / Demo</span>
      </div>
      
      <div className="commitment-grid">
        <div className="commitment-item primary">
          <span className="commitment-label">We can commit production until</span>
          <span className="commitment-value">{dayData.shutdown_window_start}</span>
          <span className="commitment-confidence">P90 confidence</span>
        </div>
        
        <div className="commitment-item">
          <span className="commitment-label">Committed output till end (P90)</span>
          <span className="commitment-value">{dayData.output_p90_tons?.toLocaleString()} t</span>
        </div>
        
        <div className="commitment-item">
          <span className="commitment-label">Expected output till end (P50)</span>
          <span className="commitment-value">{dayData.output_p50_tons?.toLocaleString()} t</span>
        </div>
        
        <div className="commitment-item">
          <span className="commitment-label">Expected shutdown window (P90)</span>
          <span className="commitment-value">{dayData.shutdown_window_start} → {dayData.shutdown_window_end}</span>
        </div>
      </div>
      
      <div className="confidence-trend">
        <span className="confidence-trend-label">
          <Clock size={12} />
          Confidence trend (14d):
        </span>
        <span className={`confidence-trend-value ${dayData.prediction_ci_90pct_days <= 5 ? "tightening" : "stable"}`}>
          {dayData.prediction_ci_90pct_days <= 5 ? "Tightening" : dayData.prediction_ci_90pct_days <= 8 ? "Stable" : "Widening"}
          <span className="ci-value">±{dayData.prediction_ci_90pct_days}d</span>
        </span>
      </div>
    </div>
  );
}

function PriorityActionsPreview({ actions }) {
  const navigate = useNavigate();
  const priorityActions = actions.slice(0, 3);

  return (
    <div className="priority-actions-preview" data-testid="priority-actions">
      <div className="priority-actions-header">
        <span className="priority-actions-title">Priority Actions (next 24–72 hours)</span>
        <button 
          className="view-all-btn"
          onClick={() => navigate("/actions")}
        >
          View all in Actions Required
          <ChevronRight size={14} />
        </button>
      </div>
      
      <div className="priority-actions-grid">
        {priorityActions.map((action, idx) => (
          <ActionPreviewCard key={action.id} action={action} priority={idx + 1} />
        ))}
      </div>
    </div>
  );
}

function ActionPreviewCard({ action, priority }) {
  const navigate = useNavigate();
  const trigger = action.trigger || {};
  const impact = action.impact_on_done || {};
  
  return (
    <div className={`action-preview-card ${action.urgency}`}>
      <div className="action-preview-header">
        <span className={`action-priority ${action.urgency}`}>{priority}</span>
        <span className="action-title">{action.title}</span>
        <span className={`urgency-tag ${action.urgency}`}>{action.urgency?.toUpperCase()}</span>
      </div>
      
      <div className="action-preview-trigger">
        <span className="trigger-metric">{trigger.metric}</span>
        <span className="trigger-current">{trigger.current}</span>
        <span className="trigger-vs">vs</span>
        <span className="trigger-baseline">{trigger.baseline}</span>
        <span className={`trigger-deviation ${parseFloat(trigger.deviation) > 0 ? "negative" : "positive"}`}>
          {trigger.deviation}
        </span>
        <span className="trigger-window">{trigger.time_window}</span>
      </div>
      
      <div className="action-preview-where">
        <span className="where-label">Where:</span>
        {action.where?.map((tag, i) => (
          <span key={i} className="asset-tag">{tag}</span>
        ))}
      </div>
      
      <div className="action-preview-impact">
        {impact.remaining_days_delta > 0 && (
          <span className="impact-chip positive">+{impact.remaining_days_delta}d</span>
        )}
        {impact.polymer_reduction_pct > 0 && (
          <span className="impact-chip">Polymer ↓{impact.polymer_reduction_pct}%</span>
        )}
        {impact.ci_tightening_days > 0 && (
          <span className="impact-chip">CI ↓{impact.ci_tightening_days}d</span>
        )}
        <span className="impact-simulated">Simulated</span>
      </div>
      
      <button 
        className="open-action-btn"
        onClick={() => navigate("/actions")}
      >
        Open in Actions Required
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
