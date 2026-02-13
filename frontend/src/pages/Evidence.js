import React, { useContext, useState, useEffect } from "react";
import { AppContext, api } from "../App";
import { 
  Radio,
  Filter,
  AlertTriangle,
  ThermometerSun,
  Activity,
  FileText,
  Database,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";

export default function Evidence() {
  const { currentDay, loading } = useContext(AppContext);
  const [events, setEvents] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await api.get("/events");
        setEvents(response.data);
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };
    fetchEvents();
  }, []);

  if (loading || !events) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: "1rem" }}>Loading evidence...</p>
      </div>
    );
  }

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
      case "FILTER_CLEANING_SPIKE": return <Filter size={16} />;
      case "TEMP_EXCURSION": return <ThermometerSun size={16} />;
      case "FOULING_RISK_CLUSTER": return <AlertTriangle size={16} />;
      case "RUN_RESCUE_MODE": return <Activity size={16} />;
      case "PREDICTED_END_SHIFT": return <Clock size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  return (
    <div className="evidence-page" data-testid="evidence">
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div className="section-title">
          <Radio size={20} />
          Evidence & Event Timeline
        </div>
      </div>

      <div className="evidence-grid">
        {/* Main Timeline */}
        <div className="evidence-timeline">
          <div className="evidence-filters">
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                className={`filter-chip ${activeFilter === opt.id ? "active" : ""}`}
                onClick={() => setActiveFilter(opt.id)}
                data-testid={`filter-${opt.id}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: "500px", overflowY: "auto" }}>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event, idx) => (
                <div key={idx} className="event-card" data-testid={`event-${event.day}`}>
                  <div className="event-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {getEventIcon(event.type)}
                      <span className="event-type">{event.type.replace(/_/g, " ")}</span>
                    </div>
                    <span className={`event-severity ${event.severity}`}>
                      {event.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="event-day">Day {event.day}</div>
                  <div className="event-assets">
                    {event.asset_tags?.map((tag, i) => (
                      <span key={i} className="asset-tag">{tag}</span>
                    ))}
                  </div>
                  <div className="event-note">"{event.operator_note}"</div>
                  
                  {/* Observed values */}
                  {event.observed && (
                    <div style={{ 
                      marginTop: "0.75rem", 
                      padding: "0.5rem",
                      background: "#111827",
                      borderRadius: "6px",
                      fontSize: "0.6875rem"
                    }}>
                      {Object.entries(event.observed).map(([key, value]) => (
                        <div key={key} style={{ 
                          display: "flex", 
                          justifyContent: "space-between",
                          padding: "0.25rem 0",
                          borderBottom: "1px solid #2A3548"
                        }}>
                          <span style={{ color: "#64748B" }}>{key.replace(/_/g, " ")}</span>
                          <span style={{ color: "#F8FAFC", fontWeight: 500 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "2rem", color: "#64748B" }}>
                No events matching filter
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="evidence-sidebar">
          {/* Shift Logs */}
          <div className="shift-log-card">
            <div className="shift-log-header">
              <span className="section-title" style={{ fontSize: "0.875rem" }}>
                <FileText size={16} />
                Shift Logs
              </span>
            </div>
            <div style={{ marginTop: "1rem" }}>
              {events.shift_logs.map((log, idx) => (
                <div key={idx} style={{ 
                  marginBottom: "1rem",
                  padding: "0.75rem",
                  background: "#242E42",
                  borderRadius: "8px"
                }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    marginBottom: "0.5rem"
                  }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#F8FAFC" }}>
                      Day {log.day} - Shift {log.shift}
                    </span>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      {log.flags?.map((flag, i) => (
                        <span 
                          key={i} 
                          style={{ 
                            fontSize: "0.5625rem",
                            padding: "0.125rem 0.375rem",
                            background: flag === "HIGH_RISK" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                            color: flag === "HIGH_RISK" ? "#EF4444" : "#F59E0B",
                            borderRadius: "4px",
                            fontWeight: 600
                          }}
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.5rem" }}>
                    {log.summary}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#64748B" }}>
                    <strong>Actions:</strong> {log.actions_taken?.join(" • ")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lab Results */}
          <div className="shift-log-card">
            <div className="shift-log-header">
              <span className="section-title" style={{ fontSize: "0.875rem" }}>
                Lab Results
              </span>
            </div>
            <div style={{ marginTop: "1rem" }}>
              {events.lab_results.map((lab, idx) => (
                <div key={idx} style={{ 
                  padding: "0.625rem",
                  background: "#242E42",
                  borderRadius: "6px",
                  marginBottom: "0.5rem"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.6875rem", color: "#64748B" }}>Day {lab.day}</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#F8FAFC" }}>
                      {lab.value} {lab.unit}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{lab.comment}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline Status */}
          <div className="pipeline-card">
            <div className="shift-log-header">
              <span className="section-title" style={{ fontSize: "0.875rem" }}>
                <Database size={16} />
                Data Pipeline Status
              </span>
            </div>
            <div style={{ marginTop: "1rem" }}>
              {events.pipeline_status.map((pipe, idx) => (
                <div key={idx} className="pipeline-item">
                  <span className="pipeline-source">{pipe.source.replace(/_/g, " ")}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "#64748B" }}>
                      {pipe.last_seen_hours_ago}h ago
                    </span>
                    <span className={`pipeline-status ${pipe.status.toLowerCase()}`}>
                      {pipe.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Recommendation */}
            {events.pipeline_status.some(p => p.status === "LATE") && (
              <div style={{ 
                marginTop: "1rem",
                padding: "0.75rem",
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "6px",
                fontSize: "0.6875rem",
                color: "#F59E0B"
              }}>
                <strong>Recommended check:</strong> Lab report feed is late. Verify sample submission timeline.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
