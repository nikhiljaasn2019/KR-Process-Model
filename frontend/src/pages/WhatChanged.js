import React, { useContext, useState, useEffect } from "react";
import { AppContext, api } from "../App";
import { 
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ThermometerSun,
  Droplet,
  Gauge,
  Zap,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
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

export default function WhatChanged() {
  const { loading } = useContext(AppContext);
  const [timeline, setTimeline] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await api.get("/timeline");
        setTimeline(response.data);
      } catch (error) {
        console.error("Error fetching timeline:", error);
      }
    };
    fetchTimeline();
  }, []);

  if (loading || !timeline) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p className="mt-4">Loading timeline...</p>
      </div>
    );
  }

  const chartData = timeline.metrics_trend.map((m) => ({
    day: m.day,
    cw_temp: m.cw_inlet_temp,
    dp_index: m.column_dp_index,
    excursions: m.excursion_count,
    dimer: m.aa_dimer * 100, // Scale for visibility
  }));

  const getEventIcon = (type) => {
    switch (type) {
      case "cw_spike": return <ThermometerSun size={18} />;
      case "inhibitor_interruption": return <Droplet size={18} />;
      case "dimer_rise": return <Activity size={18} />;
      case "dp_increase": return <Gauge size={18} />;
      default: return <Zap size={18} />;
    }
  };

  const getEventDescription = (type) => {
    switch (type) {
      case "cw_spike": 
        return {
          what: "Cooling water inlet temperature exceeded golden band threshold",
          why: "Elevated CW temperature reduces heat transfer efficiency, accelerating polymerization risk and shortening run life",
          action: "Check cooling tower operation, verify CW flow rates"
        };
      case "inhibitor_interruption": 
        return {
          what: "Inhibitor dosing continuity dropped below 99.5% threshold",
          why: "Interrupted inhibitor supply allows uncontrolled polymerization, critical risk to both run-length and product quality",
          action: "Verify dosing pump, check tank levels, inspect injection point"
        };
      case "dimer_rise": 
        return {
          what: "AA Dimer level in lab sample exceeded normal operating range",
          why: "Rising dimer indicates increased polymerization activity, signaling potential fouling and productivity loss",
          action: "Review column temperatures, check residence time, adjust draw-off rate"
        };
      case "dp_increase": 
        return {
          what: "Column differential pressure index trending above golden band",
          why: "Increasing ΔP signals fouling buildup in column internals, reducing separation efficiency and risking early shutdown",
          action: "Review feed quality, plan inspection window, assess cleaning schedule"
        };
      default:
        return {
          what: "Process deviation detected",
          why: "Deviation from golden operating envelope detected",
          action: "Review process parameters and take corrective action"
        };
    }
  };

  return (
    <div data-testid="what-changed">
      <div className="section-header">
        <div>
          <h1 className="section-title">What Changed</h1>
          <p className="section-subtitle">
            Run story and event timeline • Current Day {timeline.current_day}
          </p>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="timeline-chart" data-testid="trend-chart">
        <div className="panel-header">
          <span className="panel-title">Key Metrics Trend</span>
          <Badge variant="outline">{chartData.length} data points</Badge>
        </div>
        
        <div style={{ height: 300, marginTop: "1rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12, fill: "#64748B" }}
                axisLine={{ stroke: "#E2E8F0" }}
                label={{ value: "Run Day", position: "bottom", fontSize: 12, fill: "#64748B" }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: "#64748B" }}
                axisLine={{ stroke: "#E2E8F0" }}
              />
              <Tooltip 
                contentStyle={{ 
                  background: "white", 
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}
                formatter={(value, name) => {
                  const labels = {
                    cw_temp: "CW Inlet Temp (°C)",
                    dp_index: "ΔP Index",
                    excursions: "Excursions",
                    dimer: "AA Dimer (×100)"
                  };
                  return [typeof value === 'number' ? value.toFixed(2) : value, labels[name] || name];
                }}
              />
              <Line 
                type="monotone" 
                dataKey="cw_temp" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={false}
                name="cw_temp"
              />
              <Line 
                type="monotone" 
                dataKey="dp_index" 
                stroke="#F59E0B" 
                strokeWidth={2}
                dot={false}
                name="dp_index"
              />
              <Line 
                type="monotone" 
                dataKey="excursions" 
                stroke="#E11D48" 
                strokeWidth={2}
                dot={false}
                name="excursions"
              />
              
              {/* Event markers */}
              {timeline.events.map((event, idx) => (
                <ReferenceLine 
                  key={idx}
                  x={event.day} 
                  stroke="#8B5CF6" 
                  strokeDasharray="5 5"
                  label={{ value: "!", position: "top", fill: "#8B5CF6", fontSize: 14 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem", justifyContent: "center", fontSize: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 12, height: 3, background: "#3B82F6", borderRadius: 2 }}></div>
            <span style={{ color: "var(--text-secondary)" }}>CW Inlet Temp</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 12, height: 3, background: "#F59E0B", borderRadius: 2 }}></div>
            <span style={{ color: "var(--text-secondary)" }}>ΔP Index</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 12, height: 3, background: "#E11D48", borderRadius: 2 }}></div>
            <span style={{ color: "var(--text-secondary)" }}>Excursions</span>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="section-header" style={{ marginTop: "2rem" }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>Event Timeline</h2>
          <p className="section-subtitle">{timeline.events.length} events recorded</p>
        </div>
      </div>

      {timeline.events.length > 0 ? (
        <div className="timeline-events">
          {timeline.events.slice().reverse().map((event) => {
            const desc = getEventDescription(event.event_type);
            return (
              <div 
                key={event.id}
                className={`timeline-event ${selectedEvent === event.id ? "selected" : ""}`}
                onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
                data-testid={`event-${event.id}`}
              >
                <div className="timeline-event-marker">
                  {getEventIcon(event.event_type)}
                </div>
                <div className="timeline-event-content">
                  <div className="timeline-event-header">
                    <span className="timeline-event-title">{event.title}</span>
                    <span className="timeline-event-time">Day {event.day}</span>
                  </div>
                  <div className="timeline-event-description">
                    {event.description}
                  </div>
                  
                  {selectedEvent === event.id && (
                    <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--surface)", borderRadius: 8 }}>
                      <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                          What Changed
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                          {desc.what}
                        </div>
                      </div>
                      <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                          Why It Matters
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                          {desc.why}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                          Triggered Actions
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--accent-info)" }}>
                          {desc.action}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Clock size={24} />
          </div>
          <div className="empty-state-title">No Events Yet</div>
          <p className="empty-state-description">
            Use demo controls to inject events and see the timeline populate.
          </p>
        </div>
      )}
    </div>
  );
}
