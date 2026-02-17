import React, { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../App";
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Package,
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
  ReferenceLine
} from "recharts";

// ========== PREMIUM COLOR PALETTE ==========
const COLORS = {
  benchmark: "#64748B",      // Slate - Current Best (dashed 2.5px)
  actual: "#3B82F6",         // Blue - Actual (solid 3.5px) - matches UI accent
  forecast: "#F59E0B",       // Orange/Amber - Forecast P50 (solid 3px) - matches "Stable" text
  forecastBand: "rgba(245,158,11,0.16)",  // Light orange band
  event: "#DC2626",          // Red for events
  eventCritical: "#DC2626",  // Red for critical events
  grid: "#E5E7EB",           // Very subtle grid (0.6px)
  axisText: "#475569",       // Slate-600 for axis labels
  tooltipText: "#0F172A",    // Dark text for tooltips
  today: "#8B5CF6"           // Purple for today marker
};

// Line weights
const LINE_WEIGHTS = {
  benchmark: 2.5,
  actual: 3.5,
  forecast: 3,
  grid: 0.6
};

// Helper to format date for display
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Helper to calculate date from day number
function getDayDate(currentDay, dayNum, runStartDate) {
  if (!runStartDate) return null;
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

// Premium tooltip component
function ChartTooltip({ active, payload, label, currentDay, runStartDate, chartType }) {
  if (!active || !payload || !payload.length) return null;
  
  const dayNum = label;
  const date = getDayDate(currentDay, dayNum, runStartDate);
  const dateStr = date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
  
  const data = payload[0]?.payload || {};
  
  return (
    <div className="chart-tooltip-premium">
      <div className="tooltip-header-premium">
        <span className="tooltip-date-premium">{dateStr}</span>
        <span className="tooltip-day-premium">Day {dayNum}</span>
      </div>
      <div className="tooltip-body-premium">
        {chartType === "runLength" && (
          <>
            <div className="tooltip-row-premium benchmark">
              <span className="dot" style={{ background: COLORS.benchmark }}></span>
              <span className="label">Benchmark:</span>
              <span className="value">{data.benchmark || 111} days</span>
            </div>
            {data.actual && (
              <div className="tooltip-row-premium actual">
                <span className="dot" style={{ background: COLORS.actual }}></span>
                <span className="label">Actual:</span>
                <span className="value">{Math.round(data.actual)} days</span>
              </div>
            )}
            {data.forecast && (
              <>
                <div className="tooltip-row-premium forecast">
                  <span className="dot" style={{ background: COLORS.forecast }}></span>
                  <span className="label">Forecast (P50):</span>
                  <span className="value">{Math.round(data.forecast)} days</span>
                </div>
                {data.forecastP90 && data.forecastP10 && (
                  <div className="tooltip-row-premium band">
                    <span className="dot" style={{ background: COLORS.forecastBand, border: `1px solid ${COLORS.forecast}` }}></span>
                    <span className="label">P90–P10:</span>
                    <span className="value">{Math.round(data.forecastP90)}–{Math.round(data.forecastP10)} days</span>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {chartType === "output" && (
          <>
            <div className="tooltip-row-premium benchmark">
              <span className="dot" style={{ background: COLORS.benchmark }}></span>
              <span className="label">Benchmark:</span>
              <span className="value">{data.benchmark?.toLocaleString()} t</span>
            </div>
            {data.actual && (
              <div className="tooltip-row-premium actual">
                <span className="dot" style={{ background: COLORS.actual }}></span>
                <span className="label">Actual:</span>
                <span className="value">{data.actual?.toLocaleString()} t</span>
              </div>
            )}
            {data.forecast && (
              <div className="tooltip-row-premium forecast">
                <span className="dot" style={{ background: COLORS.forecast }}></span>
                <span className="label">Forecast (P50):</span>
                <span className="value">{data.forecast?.toLocaleString()} t</span>
              </div>
            )}
          </>
        )}
        {chartType === "polymer" && (
          <>
            <div className="tooltip-row-premium benchmark">
              <span className="dot" style={{ background: COLORS.benchmark }}></span>
              <span className="label">Benchmark:</span>
              <span className="value">{Math.round(data.benchmark)} kg/day</span>
            </div>
            {data.actual && (
              <div className="tooltip-row-premium actual">
                <span className="dot" style={{ background: COLORS.actual }}></span>
                <span className="label">Actual:</span>
                <span className="value">{Math.round(data.actual)} kg/day</span>
              </div>
            )}
            {data.forecast && (
              <div className="tooltip-row-premium forecast">
                <span className="dot" style={{ background: COLORS.forecast }}></span>
                <span className="label">Forecast (P50):</span>
                <span className="value">{Math.round(data.forecast)} kg/day</span>
              </div>
            )}
            {data.hasEvent && (
              <div className="tooltip-row-premium event">
                <span className="dot" style={{ background: COLORS.event }}></span>
                <span className="label">Event:</span>
                <span className="value">{data.eventLabel || "Event"}</span>
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
  const benchmarkLength = 111;
  const forecastLength = dayData.forecast_total_run || dayData.predicted_total_run_length || 116;
  const deviation = Math.round(forecastLength - benchmarkLength);
  const isAhead = deviation >= 0;
  const ci = dayData.prediction_ci_90pct_days || 4;

  const chartData = useMemo(() => {
    const data = [];
    const runStartDate = dayData.run_start_date;
    
    // Actual data up to current day
    fullSeries.slice(0, currentDay).forEach(d => {
      const actualTotal = d.actual_total_run || d.predicted_total_run_length || (d.day + d.predicted_remaining_days);
      data.push({
        day: d.day,
        date: getDayDate(currentDay, d.day, runStartDate),
        benchmark: benchmarkLength,
        actual: actualTotal
      });
    });

    // Forecast data from current day
    const baseRemaining = dayData.predicted_remaining_days || 45;
    const forecastTotal = dayData.forecast_total_run || (currentDay + baseRemaining + 10);
    
    for (let i = currentDay; i <= Math.min(130, currentDay + baseRemaining + 15); i++) {
      const daysFromNow = i - currentDay;
      const progress = daysFromNow / (baseRemaining + 10);
      
      // Smooth forecast curve (gradual convergence, no sudden jumps)
      const forecastValue = dayData.actual_total_run + (forecastTotal - dayData.actual_total_run) * Math.min(1, progress * 1.2);
      
      // P10/P90 band
      const p90 = forecastValue - ci * 0.5 * (1 - progress * 0.3);
      const p10 = forecastValue + ci * 0.5 * (1 - progress * 0.3);
      
      data.push({
        day: i,
        date: getDayDate(currentDay, i, runStartDate),
        benchmark: benchmarkLength,
        forecast: Math.round(forecastValue * 10) / 10,
        forecastP90: Math.round(p90 * 10) / 10,
        forecastP10: Math.round(p10 * 10) / 10
      });
    }
    
    return data;
  }, [fullSeries, currentDay, dayData, benchmarkLength, ci]);

  const formatXAxis = (day) => {
    if (day % 20 !== 0 && day !== currentDay && day !== 1) return "";
    const item = chartData.find(d => d.day === day);
    if (!item?.date) return "";
    return item.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <div className="chart-card-premium" data-testid="run-length-chart">
      <div className="chart-header-premium">
        <div className="chart-title-section">
          <Calendar size={18} className="chart-icon-premium" />
          <div>
            <h3 className="chart-title-premium">Run Length Trajectory</h3>
            <span className="chart-subtitle-premium">Predicted total run length (days)</span>
          </div>
        </div>
        <div className="chart-metrics-premium">
          <div className="metric-block-premium">
            <span className="metric-label-premium">Forecast End (P50)</span>
            <span className="metric-value-premium">{formatDate(dayData.predicted_end_date_p50)}</span>
          </div>
          <div className="metric-block-premium">
            <span className="metric-label-premium">End Window (P90)</span>
            <span className="metric-value-premium small">{formatDate(dayData.predicted_end_date_p90)} – {formatDate(dayData.predicted_end_date_p10)}</span>
          </div>
          <div className={`deviation-badge-premium ${isAhead ? "ahead" : "behind"}`}>
            {isAhead ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{isAhead ? "+" : ""}{deviation}d vs Best</span>
          </div>
        </div>
      </div>
      
      <div className="chart-container-premium">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} strokeWidth={LINE_WEIGHTS.grid} />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 11, fill: COLORS.axisText, fontWeight: 500 }}
              axisLine={{ stroke: COLORS.grid }}
              tickFormatter={formatXAxis}
              interval={0}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: COLORS.axisText, fontWeight: 500 }}
              axisLine={{ stroke: COLORS.grid }}
              domain={[105, 130]}
              label={{ value: 'Total Run Length (days)', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.axisText, fontWeight: 600, dx: 10 }}
            />
            <Tooltip content={<ChartTooltip currentDay={currentDay} runStartDate={dayData.run_start_date} chartType="runLength" />} />
            
            {/* P10-P90 Band */}
            <Area
              type="monotone"
              dataKey="forecastP10"
              stroke="none"
              fill={COLORS.forecastBand}
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="forecastP90"
              stroke="none"
              fill="#fff"
              fillOpacity={1}
            />
            
            {/* Benchmark (slate dashed) */}
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke={COLORS.benchmark}
              strokeDasharray="8 4"
              strokeWidth={LINE_WEIGHTS.benchmark}
              dot={false}
            />
            
            {/* Actual (dark solid) */}
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke={COLORS.actual}
              strokeWidth={LINE_WEIGHTS.actual}
              dot={false}
            />
            
            {/* Forecast (teal solid) */}
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke={COLORS.forecast}
              strokeWidth={LINE_WEIGHTS.forecast}
              dot={false}
            />
            
            <ReferenceLine x={currentDay} stroke={COLORS.today} strokeDasharray="4 4" strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <ChartLegend />
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
    
    // Actual data up to current day
    fullSeries.slice(0, currentDay).forEach(d => {
      data.push({
        day: d.day,
        date: getDayDate(currentDay, d.day, runStartDate),
        benchmark: d.benchmark_cumulative || Math.round(330 * d.day),
        actual: d.actual_cumulative || d.cumulative_output_tons
      });
    });

    // Forecast from current day
    const lastActual = data[data.length - 1]?.actual || dayData.cumulative_output_tons;
    const lastBenchmark = data[data.length - 1]?.benchmark || Math.round(330 * currentDay);
    const remainingDays = dayData.predicted_remaining_days || 45;
    const forecastRate = dayData.forecast_output_rate || 358;
    const benchmarkRate = 330;
    
    for (let i = currentDay; i <= currentDay + remainingDays + 5; i++) {
      const daysFromNow = i - currentDay;
      data.push({
        day: i,
        date: getDayDate(currentDay, i, runStartDate),
        benchmark: lastBenchmark + benchmarkRate * daysFromNow,
        forecast: Math.round(lastActual + forecastRate * daysFromNow)
      });
    }
    
    return data;
  }, [fullSeries, currentDay, dayData]);

  const formatXAxis = (day) => {
    if (day % 20 !== 0 && day !== currentDay && day !== 1) return "";
    const item = chartData.find(d => d.day === day);
    if (!item?.date) return "";
    return item.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <div className="chart-card-premium" data-testid="output-chart">
      <div className="chart-header-premium">
        <div className="chart-title-section">
          <Package size={18} className="chart-icon-premium" />
          <div>
            <h3 className="chart-title-premium">Output Trajectory</h3>
            <span className="chart-subtitle-premium">Cumulative output (tons)</span>
          </div>
        </div>
        <div className="chart-metrics-premium">
          <div className="metric-block-premium">
            <span className="metric-label-premium">Committed (P90)</span>
            <span className="metric-value-premium">{p90Output?.toLocaleString()} t</span>
          </div>
          <div className="metric-block-premium">
            <span className="metric-label-premium">Expected (P50)</span>
            <span className="metric-value-premium">{p50Output?.toLocaleString()} t</span>
          </div>
          <div className="shutdown-badge-premium">
            <Calendar size={12} />
            <span>Shutdown: {formatDate(dayData.shutdown_window_start)} – {formatDate(dayData.shutdown_window_end)}</span>
          </div>
        </div>
      </div>
      
      <div className="chart-container-premium">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} strokeWidth={LINE_WEIGHTS.grid} />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 11, fill: COLORS.axisText, fontWeight: 500 }}
              axisLine={{ stroke: COLORS.grid }}
              tickFormatter={formatXAxis}
              interval={0}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: COLORS.axisText, fontWeight: 500 }}
              axisLine={{ stroke: COLORS.grid }}
              tickFormatter={(v) => `${Math.round(v/1000)}k`}
              label={{ value: 'Cumulative Output (t)', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.axisText, fontWeight: 600, dx: 10 }}
            />
            <Tooltip content={<ChartTooltip currentDay={currentDay} runStartDate={dayData.run_start_date} chartType="output" />} />
            
            {/* Benchmark (slate dashed) */}
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke={COLORS.benchmark}
              strokeDasharray="8 4"
              strokeWidth={LINE_WEIGHTS.benchmark}
              dot={false}
            />
            
            {/* Actual (dark solid) */}
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke={COLORS.actual}
              strokeWidth={LINE_WEIGHTS.actual}
              dot={false}
            />
            
            {/* Forecast (teal solid) */}
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke={COLORS.forecast}
              strokeWidth={LINE_WEIGHTS.forecast}
              dot={false}
            />
            
            <ReferenceLine x={currentDay} stroke={COLORS.today} strokeDasharray="4 4" strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <ChartLegend />
    </div>
  );
}

// ========== CHART 3: POLYMER / FOULING TRAJECTORY ==========
function PolymerChart({ dayData, fullSeries, currentDay, events }) {
  const polymer = dayData.actual_polymer || dayData.polymer_burden_kg_per_day;
  const polymerTrend = polymer > 550 ? "Rising" : polymer > 400 ? "Stable" : "Improving";
  const filterChanges = dayData.filter_change_count_per_day;

  // Event map
  const eventMap = useMemo(() => {
    const map = {};
    const engineEvents = [
      { day: 12, type: "FILTER_CLEANING_SPIKE", label: "Filter Cleaning Spike" },
      { day: 52, type: "FOULING_RISK_CLUSTER", label: "Fouling Risk Cluster" }
    ];
    engineEvents.forEach(e => { map[e.day] = e; });
    return map;
  }, []);

  const chartData = useMemo(() => {
    const data = [];
    const runStartDate = dayData.run_start_date;
    
    // Actual data with proper rising benchmark
    fullSeries.slice(0, currentDay).forEach(d => {
      const event = eventMap[d.day];
      data.push({
        day: d.day,
        date: getDayDate(currentDay, d.day, runStartDate),
        benchmark: d.benchmark_polymer || Math.round(380 + (d.day / 110) ** 1.3 * 400),
        actual: d.actual_polymer || d.polymer_burden_kg_per_day,
        hasEvent: !!event,
        eventLabel: event?.label
      });
    });

    // Forecast - stable/flattening (post-actions effect)
    const basePolymer = dayData.forecast_polymer || dayData.actual_polymer * 0.85;
    const remainingDays = dayData.predicted_remaining_days || 45;
    
    for (let i = currentDay; i <= Math.min(currentDay + remainingDays, 120); i++) {
      const daysFromNow = i - currentDay;
      // Forecast polymer stays flat/slightly decreasing (post-actions effect)
      const forecastPolymer = basePolymer * (1 + daysFromNow * 0.002);
      const benchmarkPolymer = 380 + (i / 110) ** 1.3 * 400;
      
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
    if (day % 20 !== 0 && day !== currentDay && day !== 1) return "";
    const item = chartData.find(d => d.day === day);
    if (!item?.date) return "";
    return item.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const eventDays = Object.keys(eventMap).map(Number).filter(d => d <= currentDay);

  return (
    <div className="chart-card-premium" data-testid="polymer-chart">
      <div className="chart-header-premium">
        <div className="chart-title-section">
          <Activity size={18} className="chart-icon-premium" />
          <div>
            <h3 className="chart-title-premium">Polymer / Fouling Trajectory</h3>
            <span className="chart-subtitle-premium">Polymer burden (kg/day)</span>
          </div>
        </div>
        <div className="chart-metrics-premium">
          <div className="metric-block-premium">
            <span className="metric-label-premium">Trend</span>
            <span className={`metric-value-premium trend ${polymerTrend.toLowerCase()}`}>{polymerTrend}</span>
          </div>
          <div className="metric-block-premium">
            <span className="metric-label-premium">Filter Δ/day</span>
            <span className="metric-value-premium">{filterChanges?.toFixed(1)}</span>
          </div>
          <div className="polymer-badge-premium">
            <span>{Math.round(polymer)} kg/day</span>
          </div>
        </div>
      </div>
      
      <div className="chart-container-premium">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} strokeWidth={LINE_WEIGHTS.grid} />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 11, fill: COLORS.axisText, fontWeight: 500 }}
              axisLine={{ stroke: COLORS.grid }}
              tickFormatter={formatXAxis}
              interval={0}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: COLORS.axisText, fontWeight: 500 }}
              axisLine={{ stroke: COLORS.grid }}
              label={{ value: 'Polymer Burden (kg/day)', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.axisText, fontWeight: 600, dx: 10 }}
            />
            <Tooltip content={<ChartTooltip currentDay={currentDay} runStartDate={dayData.run_start_date} chartType="polymer" />} />
            
            {/* Benchmark (slate dashed) - RISING */}
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke={COLORS.benchmark}
              strokeDasharray="8 4"
              strokeWidth={LINE_WEIGHTS.benchmark}
              dot={false}
            />
            
            {/* Actual (dark solid with event markers) */}
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke={COLORS.actual}
              strokeWidth={LINE_WEIGHTS.actual}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.hasEvent) {
                  return <circle key={`event-${payload.day}`} cx={cx} cy={cy} r={5} fill={COLORS.event} stroke="#fff" strokeWidth={2} />;
                }
                return null;
              }}
            />
            
            {/* Forecast (teal solid) */}
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke={COLORS.forecast}
              strokeWidth={LINE_WEIGHTS.forecast}
              dot={false}
            />
            
            <ReferenceLine x={currentDay} stroke={COLORS.today} strokeDasharray="4 4" strokeWidth={1.5} />
            
            {eventDays.map((day) => (
              <ReferenceLine key={`ev-${day}`} x={day} stroke={COLORS.event} strokeWidth={1} strokeDasharray="2 2" />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="chart-legend-premium">
        <span className="legend-item-premium">
          <span className="legend-line-premium dashed" style={{ background: COLORS.benchmark }}></span>
          Benchmark (Current Best)
        </span>
        <span className="legend-item-premium">
          <span className="legend-line-premium solid" style={{ background: COLORS.actual }}></span>
          Actual
        </span>
        <span className="legend-item-premium">
          <span className="legend-line-premium solid" style={{ background: COLORS.forecast }}></span>
          Forecast (P50)
        </span>
        <span className="legend-item-premium">
          <span className="legend-dot-premium" style={{ background: COLORS.event }}></span>
          Event
        </span>
      </div>
      
      {eventDays.length > 0 && (
        <div className="event-chips-premium">
          {eventDays.map((day) => {
            const event = eventMap[day];
            return (
              <span key={day} className="event-chip-premium">
                D{day}: {event?.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Shared legend component
function ChartLegend() {
  return (
    <div className="chart-legend-premium">
      <span className="legend-item-premium">
        <span className="legend-line-premium dashed" style={{ background: COLORS.benchmark }}></span>
        Benchmark (Current Best)
      </span>
      <span className="legend-item-premium">
        <span className="legend-line-premium solid" style={{ background: COLORS.actual }}></span>
        Actual
      </span>
      <span className="legend-item-premium">
        <span className="legend-line-premium solid" style={{ background: COLORS.forecast }}></span>
        Forecast (P50)
      </span>
      <span className="legend-item-premium">
        <span className="legend-area-premium" style={{ background: COLORS.forecastBand }}></span>
        P10–P90
      </span>
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
      
      <button className="open-action-btn" onClick={() => navigate("/actions")}>
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
