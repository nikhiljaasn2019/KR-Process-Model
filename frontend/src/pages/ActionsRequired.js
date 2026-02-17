import React, { useContext, useState } from "react";
import { AppContext } from "../App";
import { 
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  Eye,
  Check,
  XCircle,
  Shield,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Zap,
  MessageSquare
} from "lucide-react";

export default function ActionsRequired() {
  const { 
    currentDay, 
    dayData, 
    actionStatuses,
    updateActionStatus,
    outcomeDelta,
    loading
  } = useContext(AppContext);

  if (loading || !dayData) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: "1rem" }}>Loading actions...</p>
      </div>
    );
  }

  const actions = dayData.actions || [];
  
  // Group actions by horizon
  const nowActions = actions.filter(a => a.urgency === "critical");
  const next24hActions = actions.filter(a => a.urgency === "high");
  const thisWeekActions = actions.filter(a => a.urgency === "medium" || a.urgency === "routine");

  // Calculate completed count
  const completedCount = actions.filter(a => actionStatuses[a.id]?.status === "Done").length;

  return (
    <div className="actions-required" data-testid="actions-required">
      {/* Outcome Delta Panel */}
      {outcomeDelta && (
        <OutcomeDeltaPanel delta={outcomeDelta} />
      )}

      {/* Header */}
      <div className="actions-header">
        <div className="actions-header-left">
          <h1 className="actions-title">Actions Required</h1>
          <span className="actions-subtitle">Day {currentDay} • {completedCount}/{actions.length} completed</span>
        </div>
        <div className="actions-header-right">
          <span className="actions-demo-tag">Simulated / Demo</span>
        </div>
      </div>

      {/* Action Sections by Horizon */}
      {nowActions.length > 0 && (
        <ActionSection 
          title="Now (this shift)" 
          actions={nowActions}
          actionStatuses={actionStatuses}
          updateActionStatus={updateActionStatus}
          urgencyClass="critical"
        />
      )}
      
      {next24hActions.length > 0 && (
        <ActionSection 
          title="Next 24 hours" 
          actions={next24hActions}
          actionStatuses={actionStatuses}
          updateActionStatus={updateActionStatus}
          urgencyClass="high"
        />
      )}
      
      {thisWeekActions.length > 0 && (
        <ActionSection 
          title="This week" 
          actions={thisWeekActions}
          actionStatuses={actionStatuses}
          updateActionStatus={updateActionStatus}
          urgencyClass="medium"
        />
      )}

      {actions.length === 0 && (
        <div className="no-actions">
          <CheckCircle size={48} color="#10B981" />
          <h3>All clear</h3>
          <p>No priority actions required at this time. Continue monitoring.</p>
        </div>
      )}
    </div>
  );
}

function OutcomeDeltaPanel({ delta }) {
  return (
    <div className="outcome-delta-panel" data-testid="outcome-delta">
      <div className="outcome-delta-header">
        <Zap size={16} />
        <span>Outcome from Completed Actions</span>
        <span className="simulated-tag">Simulated</span>
      </div>
      <div className="outcome-delta-grid">
        {delta.remaining_days > 0 && (
          <div className="outcome-delta-item positive">
            <span className="delta-label">Run Extended</span>
            <span className="delta-value">+{delta.remaining_days} days</span>
          </div>
        )}
        {delta.health_score > 0 && (
          <div className="outcome-delta-item positive">
            <span className="delta-label">Health Improved</span>
            <span className="delta-value">+{delta.health_score} pts</span>
          </div>
        )}
        {delta.polymer_reduction > 0 && (
          <div className="outcome-delta-item">
            <span className="delta-label">Polymer Slope</span>
            <span className="delta-value">↓ Flattened</span>
          </div>
        )}
        {delta.ci_tightening > 0 && (
          <div className="outcome-delta-item">
            <span className="delta-label">Confidence Band</span>
            <span className="delta-value">↓ {delta.ci_tightening}d tighter</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionSection({ title, actions, actionStatuses, updateActionStatus, urgencyClass }) {
  return (
    <div className={`action-section ${urgencyClass}`}>
      <div className="action-section-header">
        <Clock size={16} />
        <span className="action-section-title">{title}</span>
        <span className="action-section-count">{actions.length}</span>
      </div>
      <div className="action-cards">
        {actions.map((action) => (
          <FullActionCard 
            key={action.id}
            action={action}
            status={actionStatuses[action.id]?.status || "New"}
            reasonCode={actionStatuses[action.id]?.reason_code}
            onUpdateStatus={updateActionStatus}
          />
        ))}
      </div>
    </div>
  );
}

function FullActionCard({ action, status, reasonCode, onUpdateStatus }) {
  const [expanded, setExpanded] = useState(status === "New");
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [note, setNote] = useState("");
  
  const trigger = action.trigger || {};
  const impact = action.impact_on_done || {};
  const expectedEffect = action.expected_effect || {};
  const isCompleted = status === "Done" || status === "Not Feasible";

  const effortLevel = action.checklist?.length > 4 ? "High" : action.checklist?.length > 2 ? "Med" : "Low";

  const reasonCodes = [
    { code: "UTILITY_CONSTRAINT", label: "Utility constraint" },
    { code: "EQUIPMENT_ISSUE", label: "Equipment issue" },
    { code: "MANPOWER", label: "Manpower" },
    { code: "PROCESS_LIMITATION", label: "Process limitation" },
    { code: "UNKNOWN", label: "Unknown" }
  ];

  const handleNotFeasible = (code) => {
    onUpdateStatus(action.id, "Not Feasible", code, note);
    setShowReasonDialog(false);
    setNote("");
  };

  return (
    <div className={`full-action-card ${action.urgency} ${isCompleted ? "completed" : ""}`} data-testid={`action-${action.id}`}>
      {/* Header */}
      <div className="full-action-header" onClick={() => setExpanded(!expanded)}>
        <div className="action-status-indicator">
          {status === "Done" ? (
            <CheckCircle size={20} color="#10B981" />
          ) : status === "Not Feasible" ? (
            <XCircle size={20} color="#EF4444" />
          ) : status === "Acknowledged" ? (
            <Eye size={20} color="#F59E0B" />
          ) : (
            <div className={`action-priority-badge ${action.urgency}`}>
              {action.urgency === "critical" ? "!" : action.urgency === "high" ? "H" : "M"}
            </div>
          )}
        </div>
        
        <div className="action-header-content">
          <div className="action-title-row">
            <span className="action-title">{action.title}</span>
            <span className={`urgency-badge ${action.urgency}`}>{action.urgency?.toUpperCase()}</span>
            {status !== "New" && (
              <span className={`status-badge ${status.toLowerCase().replace(" ", "-")}`}>{status}</span>
            )}
          </div>
          <div className="action-meta">
            <span className="protects-tag">
              <Shield size={12} />
              Protects: {action.protects}
            </span>
            <span className="effort-tag">Effort: {effortLevel}</span>
          </div>
        </div>
        
        <button className="expand-btn">
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="full-action-body">
          {/* Trigger */}
          <div className="action-trigger-section">
            <div className="section-label">TRIGGER</div>
            <div className="trigger-details">
              <div className="trigger-row">
                <span className="trigger-metric">{trigger.metric}</span>
                <span className="trigger-current warning">{trigger.current}</span>
                <span className="trigger-separator">vs benchmark</span>
                <span className="trigger-baseline">{trigger.baseline}</span>
              </div>
              <div className="trigger-row">
                <span className="trigger-band">Band: {trigger.band}</span>
                <span className={`trigger-deviation ${parseFloat(trigger.deviation) > 50 ? "critical" : "warning"}`}>
                  {trigger.deviation}
                </span>
                <span className="trigger-window">{trigger.time_window}</span>
              </div>
            </div>
          </div>

          {/* Where */}
          <div className="action-where-section">
            <div className="section-label">WHERE</div>
            <div className="asset-tags">
              {action.where?.map((tag, i) => (
                <span key={i} className="asset-tag">{tag}</span>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div className="action-checklist-section">
            <div className="section-label">CHECKLIST</div>
            <div className="checklist-items">
              {action.checklist?.map((item, idx) => (
                <div key={idx} className="checklist-item">
                  <span className="checklist-number">{idx + 1}</span>
                  <span className="checklist-text">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Impact */}
          <div className="action-impact-section">
            <div className="section-label">IMPACT (Simulated)</div>
            <div className="impact-grid">
              {expectedEffect.run_length && (
                <div className="impact-item">
                  <TrendingUp size={14} />
                  <span>{expectedEffect.run_length}</span>
                </div>
              )}
              {expectedEffect.polymer_slope && (
                <div className="impact-item">
                  <span>Polymer: {expectedEffect.polymer_slope}</span>
                </div>
              )}
              {impact.remaining_days_delta > 0 && (
                <div className="impact-chip positive">+{impact.remaining_days_delta} days P50</div>
              )}
              {impact.ci_tightening_days > 0 && (
                <div className="impact-chip">CI tightens ~{impact.ci_tightening_days}d</div>
              )}
            </div>
          </div>

          {/* Evidence (placeholder) */}
          <div className="action-evidence-section">
            <div className="section-label">EVIDENCE (Optional)</div>
            <div className="evidence-actions">
              <button className="evidence-btn">
                <MessageSquare size={14} />
                Add note
              </button>
              <span className="evidence-placeholder">Attach evidence (demo placeholder)</span>
            </div>
          </div>

          {/* Action Buttons */}
          {!isCompleted && (
            <div className="action-buttons">
              {status === "New" && (
                <>
                  <button 
                    className="action-btn acknowledge"
                    onClick={() => onUpdateStatus(action.id, "Acknowledged")}
                  >
                    <Eye size={16} />
                    Acknowledge
                  </button>
                  <button 
                    className="action-btn done"
                    onClick={() => onUpdateStatus(action.id, "Done")}
                  >
                    <Check size={16} />
                    Mark Done
                  </button>
                  <button 
                    className="action-btn not-feasible"
                    onClick={() => setShowReasonDialog(true)}
                  >
                    <XCircle size={16} />
                    Not Feasible
                  </button>
                </>
              )}
              {status === "Acknowledged" && (
                <>
                  <button 
                    className="action-btn done"
                    onClick={() => onUpdateStatus(action.id, "Done")}
                  >
                    <Check size={16} />
                    Mark Done
                  </button>
                  <button 
                    className="action-btn not-feasible"
                    onClick={() => setShowReasonDialog(true)}
                  >
                    <XCircle size={16} />
                    Not Feasible
                  </button>
                </>
              )}
            </div>
          )}

          {/* Completed status */}
          {status === "Done" && (
            <div className="action-completed-banner done">
              <CheckCircle size={16} />
              <span>Completed • Impact applied to forecast</span>
            </div>
          )}
          {status === "Not Feasible" && (
            <div className="action-completed-banner not-feasible">
              <XCircle size={16} />
              <span>Not Feasible • Reason: {reasonCode?.replace(/_/g, " ")}</span>
            </div>
          )}
        </div>
      )}

      {/* Reason Dialog */}
      {showReasonDialog && (
        <div className="reason-dialog-overlay" onClick={() => setShowReasonDialog(false)}>
          <div className="reason-dialog" onClick={e => e.stopPropagation()}>
            <div className="reason-dialog-header">
              <span>Why is this not feasible?</span>
              <button onClick={() => setShowReasonDialog(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>
            <div className="reason-dialog-body">
              <div className="reason-options">
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
              <div className="reason-note">
                <label>Additional note (optional)</label>
                <textarea 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add context..."
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
