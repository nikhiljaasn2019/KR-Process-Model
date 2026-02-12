import React, { useContext, useState } from "react";
import { AppContext, api } from "../App";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  ChevronDown,
  ChevronUp,
  Shield,
  Target,
  Zap,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";

export default function ActionCenter() {
  const { actions, loading, fetchData } = useContext(AppContext);
  const [showCompleted, setShowCompleted] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionNote, setActionNote] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");

  if (loading || !actions) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p className="mt-4">Loading actions...</p>
      </div>
    );
  }

  const activeActions = actions.actions.filter(a => a.status !== "Done" && a.status !== "Not feasible");
  const completedActions = actions.actions.filter(a => a.status === "Done" || a.status === "Not feasible");

  const handleStatusUpdate = async (actionId, status, note = "") => {
    try {
      await api.post(`/actions/${actionId}/status`, { status, note });
      toast.success(`Action ${actionId} marked as ${status}`);
      fetchData();
    } catch (error) {
      console.error("Error updating action:", error);
      toast.error("Failed to update action status");
    }
  };

  const openNoteDialog = (action, status) => {
    setSelectedAction(action);
    setPendingStatus(status);
    setActionNote("");
    setNoteDialogOpen(true);
  };

  const confirmStatusWithNote = () => {
    if (selectedAction) {
      handleStatusUpdate(selectedAction.id, pendingStatus, actionNote);
    }
    setNoteDialogOpen(false);
    setSelectedAction(null);
    setActionNote("");
  };

  const getProtectsBadgeClass = (protects) => {
    switch (protects) {
      case "Run-length": return "protects-run-length";
      case "Productivity": return "protects-productivity";
      case "Both": return "protects-both";
      default: return "";
    }
  };

  return (
    <div data-testid="action-center">
      <div className="section-header">
        <div>
          <h1 className="section-title">Action Center</h1>
          <p className="section-subtitle">
            {activeActions.length} active actions • {completedActions.length} completed
          </p>
        </div>
      </div>

      {/* Active Actions */}
      {activeActions.length > 0 ? (
        <div className="action-cards-container">
          {activeActions.map((action) => (
            <ActionCard 
              key={action.id} 
              action={action}
              onAcknowledge={() => handleStatusUpdate(action.id, "Acknowledged")}
              onDone={() => openNoteDialog(action, "Done")}
              onNotFeasible={() => openNoteDialog(action, "Not feasible")}
              getProtectsBadgeClass={getProtectsBadgeClass}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <CheckCircle size={24} style={{ color: "var(--accent-good)" }} />
          </div>
          <div className="empty-state-title">All Clear</div>
          <p className="empty-state-description">
            No actions required. All metrics are within golden bands.
          </p>
        </div>
      )}

      {/* Completed Actions Section */}
      {completedActions.length > 0 && (
        <div className="done-actions-section">
          <div className="done-actions-header">
            <span className="done-actions-title">
              Completed / Logged ({completedActions.length})
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              data-testid="toggle-completed"
            >
              {showCompleted ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showCompleted ? "Hide" : "Show"}
            </Button>
          </div>
          
          {showCompleted && (
            <div className="action-cards-container">
              {completedActions.map((action) => (
                <ActionCard 
                  key={action.id} 
                  action={action}
                  isCompleted
                  getProtectsBadgeClass={getProtectsBadgeClass}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStatus === "Done" ? "Mark Action as Done" : "Mark as Not Feasible"}
            </DialogTitle>
            <DialogDescription>
              {selectedAction?.id}: {selectedAction?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={pendingStatus === "Done" ? "Add completion notes (optional)..." : "Please provide a reason..."}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              data-testid="action-note-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmStatusWithNote}
              data-testid="confirm-action-status"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionCard({ action, onAcknowledge, onDone, onNotFeasible, isCompleted, getProtectsBadgeClass }) {
  return (
    <div 
      className={`action-card ${isCompleted ? "done-action-card" : ""}`}
      data-testid={`action-card-${action.id}`}
    >
      <div className="action-card-header">
        <div>
          <div className="action-card-title-row">
            <span className="action-card-id">{action.id}</span>
            <h3 className="action-card-title">{action.title}</h3>
          </div>
        </div>
        <div className="action-card-badges">
          <span className={`protects-badge ${getProtectsBadgeClass(action.protects)}`}>
            Protects: {action.protects}
          </span>
          <Badge 
            variant="outline" 
            className={`status-${action.status.toLowerCase().replace(" ", "-")}`}
          >
            {action.status}
          </Badge>
        </div>
      </div>

      <div className="action-card-body">
        {/* Trigger Section */}
        <div className="trigger-section">
          <div className="trigger-grid">
            <div className="trigger-item">
              <div className="trigger-label">Metric</div>
              <div className="trigger-value">{action.trigger.metric}</div>
            </div>
            <div className="trigger-item">
              <div className="trigger-label">Golden Band</div>
              <div className="trigger-value">{action.trigger.golden_band}</div>
            </div>
            <div className="trigger-item">
              <div className="trigger-label">Current</div>
              <div className="trigger-value deviation">{action.trigger.current_value}</div>
            </div>
            <div className="trigger-item">
              <div className="trigger-label">Time Window</div>
              <div className="trigger-value">{action.trigger.time_window}</div>
            </div>
          </div>
        </div>

        {/* Evidence */}
        {action.evidence && action.evidence.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <div className="checklist-title">Evidence</div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              {action.evidence.map((e, i) => (
                <div key={i} style={{ marginBottom: "0.25rem" }}>• {e}</div>
              ))}
            </div>
          </div>
        )}

        {/* Action Checklist */}
        <div className="checklist-section">
          <div className="checklist-title">Action Checklist</div>
          <div className="checklist-items">
            {action.action_checklist.map((item, idx) => (
              <div key={idx} className="checklist-item">
                <span className="checklist-bullet"></span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expected Effect */}
        <div className="expected-effect">
          <CheckCircle size={16} />
          <span>Expected: {action.expected_effect}</span>
        </div>
      </div>

      <div className="action-card-footer">
        <div className="action-card-timestamp">
          {action.status === "Done" || action.status === "Not feasible" ? (
            <>Updated: {new Date(action.updated_at).toLocaleString()}</>
          ) : (
            <>Created: {new Date(action.created_at).toLocaleString()}</>
          )}
          {action.note && (
            <div style={{ marginTop: "0.25rem", fontStyle: "italic" }}>
              Note: {action.note}
            </div>
          )}
        </div>
        
        {!isCompleted && (
          <div className="action-card-actions">
            {action.status === "New" && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onAcknowledge}
                data-testid={`acknowledge-${action.id}`}
              >
                Acknowledge
              </Button>
            )}
            <Button 
              variant="default" 
              size="sm"
              onClick={onDone}
              data-testid={`done-${action.id}`}
            >
              <CheckCircle size={14} />
              Mark Done
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onNotFeasible}
              data-testid={`not-feasible-${action.id}`}
            >
              <X size={14} />
              Not Feasible
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
