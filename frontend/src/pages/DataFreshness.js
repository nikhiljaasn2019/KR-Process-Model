import React, { useContext } from "react";
import { AppContext } from "../App";
import { 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Database,
  Activity,
  RefreshCw,
  Pause,
  Play
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

export default function DataFreshness() {
  const { freshness, loading, handleDemoAction } = useContext(AppContext);

  if (loading || !freshness) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p className="mt-4">Loading data status...</p>
      </div>
    );
  }

  const getConfidenceClass = (conf) => {
    switch (conf) {
      case "High": return "confidence-high";
      case "Medium": return "confidence-medium";
      case "Low": return "confidence-low";
      default: return "";
    }
  };

  const formatTimestamp = (ts) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div data-testid="data-freshness">
      <div className="section-header">
        <div>
          <h1 className="section-title">Data Feed & Freshness</h1>
          <p className="section-subtitle">
            Monitor data quality, freshness, and prediction confidence
          </p>
        </div>
        <div className="flex gap-2">
          {freshness.is_paused ? (
            <Button onClick={() => handleDemoAction("resume")} data-testid="resume-feed">
              <Play size={16} />
              Resume Feed
            </Button>
          ) : (
            <Button variant="outline" onClick={() => handleDemoAction("pause")} data-testid="pause-feed">
              <Pause size={16} />
              Pause Feed
            </Button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="freshness-grid">
        <div className="freshness-card" data-testid="last-data-card">
          <div className="freshness-card-label">
            <Database size={14} style={{ marginRight: "0.5rem", display: "inline" }} />
            Last Data Received
          </div>
          <div className="freshness-card-value">
            {formatTimestamp(freshness.last_data_ts)}
          </div>
        </div>

        <div className="freshness-card" data-testid="last-scoring-card">
          <div className="freshness-card-label">
            <Activity size={14} style={{ marginRight: "0.5rem", display: "inline" }} />
            Last Scoring Run
          </div>
          <div className="freshness-card-value">
            {formatTimestamp(freshness.last_scoring_ts)}
          </div>
        </div>

        <div className="freshness-card" data-testid="confidence-card">
          <div className="freshness-card-label">
            <CheckCircle size={14} style={{ marginRight: "0.5rem", display: "inline" }} />
            Prediction Confidence
          </div>
          <div style={{ marginTop: "0.5rem" }}>
            <span className={`confidence-badge ${getConfidenceClass(freshness.confidence)}`}>
              {freshness.confidence === "High" && <CheckCircle size={12} />}
              {freshness.confidence === "Medium" && <AlertTriangle size={12} />}
              {freshness.confidence === "Low" && <AlertTriangle size={12} />}
              {freshness.confidence}
            </span>
          </div>
        </div>
      </div>

      {/* Run Status */}
      <Card className="mb-6" data-testid="run-status-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock size={16} />
              Current Run Status
            </span>
            <Badge variant={freshness.is_paused ? "secondary" : "default"}>
              {freshness.is_paused ? "Paused" : "Active"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                Run Day
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>
                {freshness.run_day}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                Simulated Time
              </div>
              <div style={{ fontSize: "0.875rem", fontFamily: "JetBrains Mono, monospace" }}>
                {formatTimestamp(freshness.simulated_time)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                Last Update Age
              </div>
              <div style={{ fontSize: "0.875rem", fontFamily: "JetBrains Mono, monospace" }}>
                {freshness.last_update_age_hours.toFixed(2)} hours
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues Section */}
      <div className="freshness-issues" data-testid="issues-section">
        <div className="freshness-issues-title">Data Quality Issues</div>
        
        {/* Stale Metrics */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            Stale/Missing Metrics
          </div>
          {freshness.stale_metrics.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {freshness.stale_metrics.map((metric, idx) => (
                <Badge key={idx} variant="destructive">
                  <AlertTriangle size={12} style={{ marginRight: "0.25rem" }} />
                  {metric}
                </Badge>
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--accent-good)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle size={16} />
              All metrics current
            </div>
          )}
        </div>

        {/* Flatline Flags */}
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            Flatline/Out-of-Range Flags
          </div>
          {freshness.flatline_flags.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {freshness.flatline_flags.map((flag, idx) => (
                <Badge key={idx} variant="secondary">
                  <AlertTriangle size={12} style={{ marginRight: "0.25rem" }} />
                  {flag}
                </Badge>
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--accent-good)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle size={16} />
              No anomalies detected
            </div>
          )}
        </div>
      </div>

      {/* Confidence Explanation */}
      {freshness.confidence !== "High" && (
        <Card className="mt-6 border-amber-200 bg-amber-50/50" data-testid="confidence-warning">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} style={{ color: "var(--accent-warning)", flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                  Prediction Confidence: {freshness.confidence}
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  {freshness.confidence === "Medium" && 
                    "Data freshness has degraded. Predictions may be less accurate. Last update was over 6 hours ago."}
                  {freshness.confidence === "Low" && 
                    "Data is significantly stale. Predictions have been degraded. Consider resuming data feed or investigating data source."}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
