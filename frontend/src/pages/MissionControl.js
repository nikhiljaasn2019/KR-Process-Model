import React, { useContext } from "react";
import { AppContext } from "../App";
import { useNavigate } from "react-router-dom";
import { 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  ChevronRight,
  Shield,
  Activity,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";

export default function MissionControl() {
  const { projections, metrics, actions, loading, freshness } = useContext(AppContext);
  const navigate = useNavigate();

  if (loading || !projections) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p className="mt-4">Loading mission data...</p>
      </div>
    );
  }

  const activeActions = actions?.actions?.filter(a => a.status !== "Done" && a.status !== "Not feasible") || [];
  const topThreats = activeActions.slice(0, 3);
  const topActions = activeActions.slice(0, 3);

  const progressPercent = Math.min(100, (projections.current_day / projections.golden_target_days) * 100);
  const projectedPercent = Math.min(100, (projections.projected_total_days / projections.golden_target_days) * 100);

  return (
    <div data-testid="mission-control">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          label="Current Run Day"
          value={projections.current_day}
          subtext={metrics?.phase || ""}
          icon={<Activity size={16} />}
          testId="kpi-current-day"
        />
        <KPICard
          label="Golden Target"
          value={`${projections.golden_target_days} days`}
          subtext="Baseline reference"
          icon={<Target size={16} />}
          testId="kpi-golden-target"
        />
        <KPICard
          label="Projected Total"
          value={`${projections.projected_total_days} days`}
          subtext={projections.projected_end_window}
          valueClass={projections.gap_to_golden >= 0 ? "positive" : "negative"}
          icon={<TrendingUp size={16} />}
          testId="kpi-projected-total"
        />
        <KPICard
          label="Gap to Golden"
          value={`${projections.gap_to_golden > 0 ? "+" : ""}${projections.gap_to_golden} days`}
          subtext={`Confidence: ${projections.confidence}`}
          valueClass={projections.gap_to_golden >= 0 ? "positive" : projections.gap_to_golden >= -10 ? "warning" : "negative"}
          icon={projections.gap_to_golden >= 0 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          testId="kpi-gap"
        />
      </div>

      {/* Progress Bar */}
      <div className="progress-container" data-testid="progress-container">
        <div className="progress-header">
          <span className="progress-title">Run Progress</span>
          <Badge variant={projections.confidence === "High" ? "default" : projections.confidence === "Medium" ? "secondary" : "destructive"}>
            {projections.confidence} Confidence
          </Badge>
        </div>
        
        <div className="progress-bar-wrapper">
          {/* Current progress */}
          <div 
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="progress-marker" style={{ right: 0 }}>
              <div className="progress-marker-line" style={{ background: "#0F172A" }}></div>
              <span className="progress-marker-label">Day {projections.current_day}</span>
            </div>
          </div>
          
          {/* Golden target line */}
          <div 
            className="golden-target-line"
            style={{ left: "100%" }}
          >
            <span className="golden-target-label">Golden: {projections.golden_target_days} days</span>
          </div>
          
          {/* Projection window */}
          {projections.projected_total_days > projections.current_day && (
            <div 
              className="projection-window"
              style={{ 
                left: `${progressPercent}%`,
                width: `${Math.min(100 - progressPercent, projectedPercent - progressPercent)}%`
              }}
            >
              <span className="projection-label">Projected: {projections.projected_end_window}</span>
            </div>
          )}
        </div>
        
        <div className="progress-labels">
          <span>Day 1</span>
          <span>Day {projections.golden_target_days}</span>
        </div>
      </div>

      {/* Risk Panel */}
      <div className="risk-panel" data-testid="risk-panel">
        <RiskItem 
          label="Risk within 7 days" 
          value={projections.risk_7d} 
          testId="risk-7d"
        />
        <RiskItem 
          label="Risk within 14 days" 
          value={projections.risk_14d}
          testId="risk-14d"
        />
        <RiskItem 
          label="Risk within 30 days" 
          value={projections.risk_30d}
          testId="risk-30d"
        />
      </div>

      {/* Panels Grid */}
      <div className="panels-grid">
        {/* Productivity Status Panel */}
        <div className="panel" data-testid="productivity-panel">
          <div className="panel-header">
            <span className="panel-title">
              <Shield size={16} />
              Productivity Status
            </span>
            <span className={`panel-badge ${projections.productivity_status === "Stable" ? "badge-stable" : "badge-at-risk"}`}>
              {projections.productivity_status}
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
            {projections.productivity_reason}
          </p>
          
          {/* Top Threats */}
          <div className="panel-title" style={{ marginBottom: "0.75rem", marginTop: "1.5rem" }}>
            <AlertTriangle size={16} style={{ color: "var(--accent-warning)" }} />
            Top Threats Right Now
          </div>
          {topThreats.length > 0 ? (
            <div className="threat-list">
              {topThreats.map((action, idx) => (
                <div 
                  key={action.id} 
                  className={`threat-item ${action.protects === "Both" ? "critical" : ""}`}
                  data-testid={`threat-${idx}`}
                >
                  <div className="threat-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="threat-content">
                    <div className="threat-metric">{action.trigger.metric}</div>
                    <div className="threat-detail">
                      {action.trigger.current_value} (Band: {action.trigger.golden_band})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "1rem" }}>
              <CheckCircle size={24} style={{ color: "var(--accent-good)" }} />
              <p style={{ marginTop: "0.5rem" }}>All metrics within golden bands</p>
            </div>
          )}
        </div>

        {/* Actions Panel */}
        <div className="panel" data-testid="actions-preview-panel">
          <div className="panel-header">
            <span className="panel-title">
              <Activity size={16} />
              Actions Right Now
            </span>
            <Badge>{activeActions.length} Active</Badge>
          </div>
          
          {topActions.length > 0 ? (
            <div className="action-preview-list">
              {topActions.map((action) => (
                <div 
                  key={action.id} 
                  className="action-preview-item"
                  onClick={() => navigate("/actions")}
                  data-testid={`action-preview-${action.id}`}
                >
                  <div className="action-preview-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="action-preview-content">
                    <div className="action-preview-title">{action.title}</div>
                    <div className="action-preview-meta">
                      Protects: {action.protects} • {action.trigger.time_window}
                    </div>
                  </div>
                  <div className="action-preview-badge">
                    <Badge variant="outline" className={`status-${action.status.toLowerCase().replace(" ", "-")}`}>
                      {action.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "1rem" }}>
              <CheckCircle size={24} style={{ color: "var(--accent-good)" }} />
              <p style={{ marginTop: "0.5rem" }}>No actions required</p>
            </div>
          )}
          
          {activeActions.length > 3 && (
            <Button 
              variant="ghost" 
              className="w-full mt-4"
              onClick={() => navigate("/actions")}
              data-testid="view-all-actions"
            >
              View All Actions
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, subtext, valueClass, icon, testId }) {
  return (
    <div className="kpi-card" data-testid={testId}>
      <div className="kpi-label">
        {icon}
        {label}
      </div>
      <div className={`kpi-value ${valueClass || ""}`}>{value}</div>
      <div className="kpi-subtext">{subtext}</div>
    </div>
  );
}

function RiskItem({ label, value, testId }) {
  const getRiskClass = (val) => {
    if (val <= 20) return "risk-low";
    if (val <= 50) return "risk-medium";
    return "risk-high";
  };

  return (
    <div className="risk-item" data-testid={testId}>
      <div className="risk-label">{label}</div>
      <div className={`risk-value ${getRiskClass(value)}`}>{value}%</div>
    </div>
  );
}
