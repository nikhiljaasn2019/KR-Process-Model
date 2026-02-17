import React, { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../App";
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Package,
  AlertTriangle,
  ChevronRight,
  Activity,
  ArrowRight,
  Clock,
  Info
} from "lucide-react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot
} from "recharts";

// ========== GLOBAL COLOR CODING ==========
const COLORS = {
  benchmark: "#3B82F6",      // Blue - Current Best Run (dashed)
  actual: "#1E293B",         // Black/Dark Gray - Actual (solid)
  forecast: "#10B981",       // Green - Forecast P50 (solid)
  forecastBand: "#10B981",   // Light green - P10-P90 band
  event: "#EF4444",          // Red - Event markers
  grid: "#E2E8F0",
  text: "#64748B",
  today: "#8B5CF6"           // Purple - Today marker
};

// Helper to format date for display
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Helper to calculate date from day number
function getDayDate(currentDay, dayNum, runStartDate) {
  if (!runStartDate) return "";
  const start = new Date(runStartDate);
  const date = new Date(start);
  date.setDate(start.getDate() + dayNum - 1);
  return date;
}

export default function MissionControl() {
  const { 
    currentDay, 
    dayData, 
    fullSeries,
    loading, 
    events
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
    <div className="mission-control-v2" data-testid="mission-control">
      {/* ZONE 1: The 3 Curves (vertically stacked) */}
      <div className="charts-zone">
        <RunLengthChart 
          dayData={dayData} 
          fullSeries={fullSeries} 
          currentDay={currentDay}
        />
        <OutputChart 
          dayData={dayData} 
          fullSeries={fullSeries} 
          currentDay={currentDay}
        />
        <PolymerChart 
          dayData={dayData} 
          fullSeries={fullSeries} 
          currentDay={currentDay}
          events={events}
        />
      </div>

      {/* ZONE 2: Priority Actions Preview */}
      <PriorityActionsPreview actions={dayData.actions || []} />

      {/* ZONE 3: Trust Strip */}
      <TrustStrip dayData={dayData} currentDay={currentDay} />
    </div>
  );
}

// Custom tooltip component for all charts
function ChartTooltip({ active, payload, label, currentDay, runStartDate, chartType }) {
  if (!active || !payload || !payload.length) return null;
  
  const dayNum = label;
  const date = getDayDate(currentDay, dayNum, runStartDate);
  const dateStr = date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
  
  const data = payload[0]?.payload || {};
  
  return (
    <div className="chart-tooltip">
      <div className="tooltip-header">
        <span className="tooltip-date">{dateStr}</span>
        <span className="tooltip-day">Day {dayNum}</span>
      </div>
      <div className="tooltip-body">
        {chartType === "runLength" && (
          <>
            <div className="tooltip-row benchmark">
              <span className="tooltip-label">Benchmark:</span>
              <span className="tooltip-value">{data.benchmark || 111} days</span>
            </div>
            {data.actual && (
              <div className="tooltip-row actual">
                <span className="tooltip-label">Actual:</span>
                <span className="tooltip-value">{Math.round(data.actual)} days</span>
              </div>
            )}
            {data.forecast && (
              <>
                <div className="tooltip-row forecast">
                  <span className="tooltip-label">Forecast (P50):</span>
                  <span className="tooltip-value">{Math.round(data.forecast)} days</span>
                </div>
                {data.forecastP90 && data.forecastP10 && (
                  <div className="tooltip-row band">
                    <span className="tooltip-label">P90–P10:</span>
                    <span className="tooltip-value">{Math.round(data.forecastP90)}–{Math.round(data.forecastP10)} days</span>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {chartType === "output" && (
          <>
            <div className="tooltip-row benchmark">
              <span className="tooltip-label">Benchmark:</span>
              <span className="tooltip-value">{data.benchmark?.toLocaleString()} t</span>
            </div>
            {data.actual && (
              <div className="tooltip-row actual">
                <span className="tooltip-label">Actual:</span>
                <span className="tooltip-value">{data.actual?.toLocaleString()} t</span>
              </div>
            )}
            {data.forecast && (
              <div className="tooltip-row forecast">
                <span className="tooltip-label">Forecast (P50):</span>
                <span className="tooltip-value">{data.forecast?.toLocaleString()} t</span>
              </div>
            )}
          </>
        )}
        {chartType === "polymer" && (
          <>
            <div className="tooltip-row benchmark">
              <span className="tooltip-label">Benchmark:</span>
              <span className="tooltip-value">{Math.round(data.benchmark)} kg/day</span>
            </div>
            {data.actual && (
              <div className="tooltip-row actual">
                <span className="tooltip-label">Actual:</span>
                <span className="tooltip-value">{Math.round(data.actual)} kg/day</span>
              </div>
            )}
            {data.forecast && (
              <div className="tooltip-row forecast">
                <span className="tooltip-label">Forecast (P50):</span>
                <span className="tooltip-value">{Math.round(data.forecast)} kg/day</span>
              </div>
            )}
            {data.hasEvent && (
              <div className="tooltip-row event">
                <span className="tooltip-label">Event:</span>
                <span className="tooltip-value">{data.eventLabel || "Operational Event"}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ========== CHART 1: RUN LENGTH TRAJECTORY ==========
function RunLengthChart({ dayData, fullSeries, currentDay }) {
  const benchmarkLength = 111; // Current Best Run length
  const forecastLength = dayData.predicted_total_run_length || (currentDay + dayData.predicted_remaining_days);
  const deviation = forecastLength - benchmarkLength;
  const isAhead = deviation >= 0;
  const ci = dayData.prediction_ci_90pct_days;

  // Generate chart data with dates
  const chartData = useMemo(() => {
    const data = [];
    const runStartDate = dayData.run_start_date;
    
    // Actual data up to current day (predicted total run length = day + remaining)
    fullSeries.slice(0, currentDay).forEach(d => {
      const totalRunLength = d.day + d.predicted_remaining_days;
      data.push({
        day: d.day,
        date: getDayDate(currentDay, d.day, runStartDate),
        benchmark: benchmarkLength,
        actual: totalRunLength
      });
    });

    // Forecast data from current day
    const baseRemaining = dayData.predicted_remaining_days;
    for (let i = currentDay; i <= Math.min(130, currentDay + baseRemaining + 10); i++) {
      const daysFromNow = i - currentDay;
      const remaining = Math.max(0, baseRemaining - daysFromNow);
      const totalForecast = i + remaining;
      
      // P10/P90 band
      const p90 = i + Math.max(0, remaining - ci * 0.5);
      const p10 = i + remaining + ci * 0.5;
      
      data.push({
        day: i,
        date: getDayDate(currentDay, i, runStartDate),
        benchmark: benchmarkLength,
        forecast: totalForecast,
        forecastP90: p90,
        forecastP10: p10
      });
    }
    
    return data;
  }, [fullSeries, currentDay, dayData, benchmarkLength, ci]);

  // X-axis tick formatter - show dates
  const formatXAxis = (day) => {
    if (day % 20 !== 0 && day !== currentDay) return "";
    const date = chartData.find(d => d.day === day)?.date;
    if (!date) return "";
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <div className="chart-card" data-testid="run-length-chart">
      <div className="chart-header">
        <div className="chart-title-section">
          <Calendar size={18} className="chart-icon" />
          <div>
            <h3 className="chart-title">Run Length Trajectory</h3>
            <span className="chart-subtitle">Predicted total run length (days)</span>
          </div>
        </div>
        <div className="chart-metrics">
          <div className="metric-block">
            <span className="metric-label">Forecast End (P50)</span>
            <span className="metric-value">{formatDate(dayData.predicted_end_date_p50)}</span>
          </div>
          <div className="metric-block">
            <span className="metric-label">End Window (P90)</span>
            <span className="metric-value small">{formatDate(dayData.predicted_end_date_p90)} – {formatDate(dayData.predicted_end_date_p10)}</span>
          </div>
          <div className={`deviation-badge ${isAhead ? "ahead" : "behind"}`}>
            {isAhead ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{isAhead ? "+" : ""}{deviation}d vs Best</span>
          </div>
        </div>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 11, fill: COLORS.text }}
              axisLine={{ stroke: COLORS.grid }}
              tickFormatter={formatXAxis}
              interval={0}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: COLORS.text }}
              axisLine={{ stroke: COLORS.grid }}
              domain={[100, 130]}
              label={{ value: 'Total Run Length (days)', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.text, dx: 10 }}
            />
            <Tooltip content={<ChartTooltip currentDay={currentDay} runStartDate={dayData.run_start_date} chartType="runLength" />} />
            
            {/* P10-P90 Band (light green) */}
            <Area
              type="monotone"
              dataKey="forecastP10"
              stroke="none"
              fill={COLORS.forecastBand}
              fillOpacity={0.15}
              name="P10"
            />
            <Area
              type="monotone"
              dataKey="forecastP90"
              stroke="none"
              fill="#fff"
              fillOpacity={1}
            />
            
            {/* Benchmark (blue dashed) */}
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke={COLORS.benchmark}
              strokeDasharray="6 4"
              strokeWidth={2}
              dot={false}
              name="Benchmark"
            />
            
            {/* Actual (black solid) */}
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke={COLORS.actual}
              strokeWidth={2.5}
              dot={false}
              name="Actual"
            />
            
            {/* Forecast P50 (green solid) */}
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke={COLORS.forecast}
              strokeWidth={2.5}
              dot={false}
              name="Forecast"
            />
            
            {/* Today marker */}
            <ReferenceLine x={currentDay} stroke={COLORS.today} strokeDasharray="4 4" strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-line dashed" style={{ background: COLORS.benchmark }}></span>
          Benchmark (Current Best)
        </span>
        <span className="legend-item">
          <span className="legend-line solid" style={{ background: COLORS.actual }}></span>
          Actual
        </span>
        <span className="legend-item">
          <span className="legend-line solid" style={{ background: COLORS.forecast }}></span>
          Forecast (P50)
        </span>
        <span className="legend-item">
          <span className="legend-area" style={{ background: COLORS.forecastBand, opacity: 0.2 }}></span>
          P10–P90
        </span>
      </div>
    </div>
  );
}

// ========== CHART 2: OUTPUT TRAJECTORY ==========
function OutputChart({ dayData, fullSeries, currentDay }) {
  const p90Output = dayData.output_p90_tons;
  const p50Output = dayData.output_p50_tons;

  const chartData = useMemo(() => {
    const data = [];
    const runStartDate = dayData.run_start_date;
    let cumulativeActual = 0;
    let cumulativeBenchmark = 0;
    const benchmarkRate = 340; // Benchmark daily output
    
    // Actual data up to current day
    fullSeries.slice(0, currentDay).forEach(d => {
      cumulativeActual += d.eaa_output_tpd;
      cumulativeBenchmark += benchmarkRate;
      data.push({
        day: d.day,
        date: getDayDate(currentDay, d.day, runStartDate),
        benchmark: Math.round(cumulativeBenchmark),
        actual: Math.round(cumulativeActual)
      });
    });

    // Forecast from current day
    const avgOutput = dayData.eaa_output_tpd * 0.95;
    let cumulativeForecast = cumulativeActual;
    const remainingDays = dayData.predicted_remaining_days;
    
    for (let i = currentDay; i <= currentDay + remainingDays + 5; i++) {
      cumulativeForecast += avgOutput;
      cumulativeBenchmark += benchmarkRate;
      data.push({
        day: i,
        date: getDayDate(currentDay, i, runStartDate),
        benchmark: Math.round(cumulativeBenchmark),
        forecast: Math.round(cumulativeForecast)
      });
    }
    
    return data;
  }, [fullSeries, currentDay, dayData]);

  const formatXAxis = (day) => {
    if (day % 20 !== 0 && day !== currentDay) return "";
    const date = chartData.find(d => d.day === day)?.date;
    if (!date) return "";
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <div className="chart-card" data-testid="output-chart">
      <div className="chart-header">
        <div className="chart-title-section">
          <Package size={18} className="chart-icon" />
          <div>
            <h3 className="chart-title">Output Trajectory</h3>
            <span className="chart-subtitle">Cumulative output (tons)</span>
          </div>
        </div>
        <div className="chart-metrics">
          <div className="metric-block">
            <span className="metric-label">Committed (P90)</span>
            <span className="metric-value">{p90Output?.toLocaleString()} t</span>
          </div>
          <div className="metric-block">
            <span className="metric-label">Expected (P50)</span>
            <span className="metric-value">{p50Output?.toLocaleString()} t</span>
          </div>
          <div className="shutdown-badge">
            <Calendar size={12} />
            <span>Shutdown: {formatDate(dayData.shutdown_window_start)} – {formatDate(dayData.shutdown_window_end)}</span>
          </div>
        </div>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 11, fill: COLORS.text }}
              axisLine={{ stroke: COLORS.grid }}
              tickFormatter={formatXAxis}
              interval={0}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: COLORS.text }}
              axisLine={{ stroke: COLORS.grid }}
              tickFormatter={(v) => `${Math.round(v/1000)}k`}
              label={{ value: 'Cumulative Output (t)', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.text, dx: 10 }}
            />
            <Tooltip content={<ChartTooltip currentDay={currentDay} runStartDate={dayData.run_start_date} chartType="output" />} />
            
            {/* Benchmark (blue dashed) */}
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke={COLORS.benchmark}
              strokeDasharray="6 4"
              strokeWidth={2}
              dot={false}
              name="Benchmark"
            />
            
            {/* Actual (black solid) */}
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke={COLORS.actual}
              strokeWidth={2.5}
              dot={false}
              name="Actual"
            />
            
            {/* Forecast (green solid) */}
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke={COLORS.forecast}
              strokeWidth={2.5}
              dot={false}
              name="Forecast"
            />
            
            {/* Today marker */}
            <ReferenceLine x={currentDay} stroke={COLORS.today} strokeDasharray="4 4" strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-line dashed" style={{ background: COLORS.benchmark }}></span>
          Benchmark (Current Best)
        </span>
        <span className="legend-item">
          <span className="legend-line solid" style={{ background: COLORS.actual }}></span>
          Actual
        </span>
        <span className="legend-item">
          <span className="legend-line solid" style={{ background: COLORS.forecast }}></span>
          Forecast (P50)
        </span>
      </div>
    </div>
  );
}

// ========== CHART 3: POLYMER / FOULING TRAJECTORY ==========
function PolymerChart({ dayData, fullSeries, currentDay, events }) {
  const polymerTrend = dayData.polymer_burden_kg_per_day > 600 ? "Rising" : 
                       dayData.polymer_burden_kg_per_day > 300 ? "Stable" : "Improving";
  const filterChanges = dayData.filter_change_count_per_day;

  // Get event markers
  const eventMap = useMemo(() => {
    const map = {};
    events?.events?.forEach(e => {
      if (e.type === "FILTER_CLEANING_SPIKE" || e.type === "RUN_RESCUE_MODE" || e.type === "FOULING_RISK_CLUSTER") {
        map[e.day] = e;
      }
    });
    return map;
  }, [events]);

  const chartData = useMemo(() => {
    const data = [];
    const runStartDate = dayData.run_start_date;
    
    // Actual data with RISING benchmark (not flat)
    fullSeries.slice(0, currentDay).forEach(d => {
      const event = eventMap[d.day];
      // Rising benchmark: starts at 120, grows slowly
      const benchmarkPolymer = 120 + (d.day * 2.5 * 0.7);
      
      data.push({
        day: d.day,
        date: getDayDate(currentDay, d.day, runStartDate),
        benchmark: Math.round(benchmarkPolymer),
        actual: Math.round(d.polymer_burden_kg_per_day),
        hasEvent: !!event,
        eventLabel: event ? event.type.replace(/_/g, " ").toLowerCase() : null
      });
    });

    // Forecast
    const basePolymer = dayData.polymer_burden_kg_per_day;
    const remainingDays = dayData.predicted_remaining_days;
    
    for (let i = currentDay; i <= Math.min(currentDay + remainingDays, 120); i++) {
      const daysFromNow = i - currentDay;
      // Slight increase in polymer forecast
      const forecastPolymer = basePolymer + (daysFromNow * 3);
      const benchmarkPolymer = 120 + (i * 2.5 * 0.7);
      
      data.push({
        day: i,
        date: getDayDate(currentDay, i, runStartDate),
        benchmark: Math.round(benchmarkPolymer),
        forecast: Math.round(forecastPolymer)
      });
    }
    
    return data;
  }, [fullSeries, currentDay, dayData, eventMap]);

  const formatXAxis = (day) => {
    if (day % 20 !== 0 && day !== currentDay) return "";
    const date = chartData.find(d => d.day === day)?.date;
    if (!date) return "";
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  // Event markers for reference lines
  const eventDays = Object.keys(eventMap).map(Number).filter(d => d <= currentDay).slice(-3);

  return (
    <div className="chart-card" data-testid="polymer-chart">
      <div className="chart-header">
        <div className="chart-title-section">
          <Activity size={18} className="chart-icon" />
          <div>
            <h3 className="chart-title">Polymer / Fouling Trajectory</h3>
            <span className="chart-subtitle">Polymer burden (kg/day)</span>
          </div>
        </div>
        <div className="chart-metrics">
          <div className="metric-block">
            <span className="metric-label">Trend</span>
            <span className={`metric-value trend ${polymerTrend.toLowerCase()}`}>{polymerTrend}</span>
          </div>
          <div className="metric-block">
            <span className="metric-label">Filter Δ/day</span>
            <span className="metric-value">{filterChanges?.toFixed(1)}</span>
          </div>
          <div className="polymer-badge">
            <span>{Math.round(dayData.polymer_burden_kg_per_day)} kg/day</span>
          </div>
        </div>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 11, fill: COLORS.text }}
              axisLine={{ stroke: COLORS.grid }}
              tickFormatter={formatXAxis}
              interval={0}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: COLORS.text }}
              axisLine={{ stroke: COLORS.grid }}
              label={{ value: 'Polymer Burden (kg/day)', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.text, dx: 10 }}
            />
            <Tooltip content={<ChartTooltip currentDay={currentDay} runStartDate={dayData.run_start_date} chartType="polymer" />} />
            
            {/* Benchmark (blue dashed) - RISING, not flat */}
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke={COLORS.benchmark}
              strokeDasharray="6 4"
              strokeWidth={2}
              dot={false}
              name="Benchmark"
            />
            
            {/* Actual (black solid with red event dots) */}
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke={COLORS.actual}
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.hasEvent) {
                  return <circle key={`event-${payload.day}`} cx={cx} cy={cy} r={5} fill={COLORS.event} stroke="#fff" strokeWidth={1.5} />;
                }
                return null;
              }}
              name="Actual"
            />
            
            {/* Forecast (green solid) */}
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke={COLORS.forecast}
              strokeWidth={2.5}
              dot={false}
              name="Forecast"
            />
            
            {/* Today marker */}
            <ReferenceLine x={currentDay} stroke={COLORS.today} strokeDasharray="4 4" strokeWidth={1.5} />
            
            {/* Event reference lines */}
            {eventDays.map((day) => (
              <ReferenceLine 
                key={`event-line-${day}`}
                x={day} 
                stroke={COLORS.event}
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-line dashed" style={{ background: COLORS.benchmark }}></span>
          Benchmark (Current Best)
        </span>
        <span className="legend-item">
          <span className="legend-line solid" style={{ background: COLORS.actual }}></span>
          Actual
        </span>
        <span className="legend-item">
          <span className="legend-line solid" style={{ background: COLORS.forecast }}></span>
          Forecast (P50)
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: COLORS.event }}></span>
          Event
        </span>
      </div>
      
      {/* Event chips */}
      {eventDays.length > 0 && (
        <div className="event-chips">
          {eventDays.map((day) => {
            const event = eventMap[day];
            return (
              <span key={day} className={`event-chip ${event?.severity || "medium"}`}>
                D{day}: {event?.type?.replace(/_/g, " ").toLowerCase()}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== ZONE 2: PRIORITY ACTIONS PREVIEW ==========
function PriorityActionsPreview({ actions }) {
  const navigate = useNavigate();
  const priorityActions = actions.slice(0, 3);

  return (
    <div className="priority-actions-zone" data-testid="priority-actions">
      <div className="zone-header">
        <h3 className="zone-title">Priority Actions (next 24–72 hours)</h3>
        <button 
          className="view-all-btn"
          onClick={() => navigate("/actions")}
          data-testid="view-all-actions"
        >
          View all in Actions Required
          <ChevronRight size={14} />
        </button>
      </div>
      
      <div className="actions-grid">
        {priorityActions.map((action, idx) => (
          <ActionCard key={action.id} action={action} priority={idx + 1} />
        ))}
      </div>
    </div>
  );
}

function ActionCard({ action, priority }) {
  const navigate = useNavigate();
  const impact = action.impact_on_done || {};
  const expectedEffect = action.expected_effect || {};
  
  return (
    <div className={`action-card-v2 ${action.urgency}`} data-testid={`action-card-${action.id}`}>
      <div className="action-card-header">
        <span className={`priority-badge ${action.urgency}`}>{priority}</span>
        <span className="action-title">{action.title}</span>
        <span className={`urgency-badge ${action.urgency}`}>{action.urgency?.toUpperCase()}</span>
      </div>
      
      <div className="action-impact-box">
        <span className="impact-label">Expected impact (simulated):</span>
        <div className="impact-details">
          {impact.remaining_days_delta > 0 && (
            <span className="impact-item positive">+{impact.remaining_days_delta} days (P50)</span>
          )}
          {impact.ci_tightening_days > 0 && (
            <span className="impact-item">CI tightens ~{impact.ci_tightening_days}d</span>
          )}
          {impact.polymer_reduction_pct > 0 && (
            <span className="impact-item">polymer slope flattens for 72h</span>
          )}
        </div>
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

// ========== ZONE 3: TRUST STRIP ==========
function TrustStrip({ dayData, currentDay }) {
  return (
    <div className="trust-strip" data-testid="trust-strip">
      <div className="trust-item">
        <Clock size={14} />
        <span>Run date: {dayData.current_date_display} (Day {currentDay} of 111)</span>
      </div>
      <div className="trust-item">
        <span className="status-dot ok"></span>
        <span>Data updated: 2 min ago</span>
      </div>
      <div className="trust-item">
        <span>Scored: 5 min ago</span>
      </div>
      <div className="trust-badge">
        <Info size={10} />
        <span>Simulated / Demo — Not plant-validated</span>
      </div>
    </div>
  );
}
