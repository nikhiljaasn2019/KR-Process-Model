import React from "react";
import { 
  Settings,
  Clock,
  ThermometerSun,
  Droplet,
  Activity,
  Gauge,
  CheckCircle,
  Pause,
  Play,
  RotateCcw
} from "lucide-react";

export default function DemoControlPanel({ show, onToggle, onAction, isPaused }) {
  return (
    <div className="demo-panel" data-testid="demo-panel">
      <button 
        className="demo-panel-toggle"
        onClick={onToggle}
        data-testid="demo-panel-toggle"
        title="Demo Controls"
      >
        <Settings size={20} />
      </button>
      
      {show && (
        <div className="demo-panel-content" data-testid="demo-panel-content">
          <div className="demo-panel-header">
            Demo Controls
          </div>
          <div className="demo-panel-body">
            <button 
              className="demo-btn"
              onClick={() => onAction("advance")}
              data-testid="demo-advance"
            >
              <span className="demo-btn-icon"><Clock size={16} /></span>
              Advance 6 Hours
            </button>
            
            <button 
              className="demo-btn"
              onClick={() => onAction("inject", { eventType: "cw_spike" })}
              data-testid="demo-cw-spike"
            >
              <span className="demo-btn-icon"><ThermometerSun size={16} /></span>
              Inject CW Spike
            </button>
            
            <button 
              className="demo-btn"
              onClick={() => onAction("inject", { eventType: "inhibitor_interruption" })}
              data-testid="demo-inhibitor"
            >
              <span className="demo-btn-icon"><Droplet size={16} /></span>
              Inject Inhibitor Interruption
            </button>
            
            <button 
              className="demo-btn"
              onClick={() => onAction("inject", { eventType: "dimer_rise" })}
              data-testid="demo-dimer"
            >
              <span className="demo-btn-icon"><Activity size={16} /></span>
              Inject Dimer Rise
            </button>
            
            <button 
              className="demo-btn"
              onClick={() => onAction("inject", { eventType: "dp_increase" })}
              data-testid="demo-dp"
            >
              <span className="demo-btn-icon"><Gauge size={16} /></span>
              Inject ΔP Increase
            </button>
            
            <button 
              className="demo-btn"
              onClick={() => onAction("resolve")}
              data-testid="demo-resolve"
            >
              <span className="demo-btn-icon"><CheckCircle size={16} /></span>
              Resolve Action
            </button>
            
            <div style={{ height: 1, background: "var(--border)", margin: "0.5rem 0" }}></div>
            
            {isPaused ? (
              <button 
                className="demo-btn"
                onClick={() => onAction("resume")}
                data-testid="demo-resume"
              >
                <span className="demo-btn-icon"><Play size={16} /></span>
                Resume Data Feed
              </button>
            ) : (
              <button 
                className="demo-btn"
                onClick={() => onAction("pause")}
                data-testid="demo-pause"
              >
                <span className="demo-btn-icon"><Pause size={16} /></span>
                Pause Data Feed
              </button>
            )}
            
            <button 
              className="demo-btn"
              onClick={() => onAction("reset")}
              data-testid="demo-reset"
              style={{ color: "var(--accent-critical)" }}
            >
              <span className="demo-btn-icon"><RotateCcw size={16} /></span>
              Reset Simulation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
