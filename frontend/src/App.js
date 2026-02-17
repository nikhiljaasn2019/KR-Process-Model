import React, { useState, useEffect, useCallback, createContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  Activity, 
  Gauge, 
  ClipboardList,
  Target,
  Info
} from "lucide-react";

// Pages
import MissionControl from "./pages/MissionControl";
import ActionsRequired from "./pages/ActionsRequired";
import PlanCommit from "./pages/PlanCommit";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 10000,
});

// App Context
export const AppContext = createContext(null);

function App() {
  const [currentDay, setCurrentDay] = useState(70); // Default to Day 70 - critical moment
  const [dayData, setDayData] = useState(null);
  const [runInfo, setRunInfo] = useState(null);
  const [timeSeries, setTimeSeries] = useState([]);
  const [fullSeries, setFullSeries] = useState([]); // Full 1-111 series for charts
  const [whatChanged, setWhatChanged] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickDays, setQuickDays] = useState([]);
  const [actionStatuses, setActionStatuses] = useState({});
  const [events, setEvents] = useState(null);
  const [scenarioComparison, setScenarioComparison] = useState(null);
  const [outcomeDelta, setOutcomeDelta] = useState(null); // Track action impact

  const fetchData = useCallback(async (day) => {
    try {
      const [dayRes, runRes, seriesRes, fullSeriesRes, changedRes, quickRes, statusesRes, eventsRes, scenarioRes] = await Promise.all([
        api.get(`/day/${day}`),
        api.get("/run-info"),
        api.get(`/time-series?start=1&end=${day}`),
        api.get(`/time-series?start=1&end=111`), // Full series for forecast charts
        api.get(`/what-changed/${day}`),
        api.get("/quick-days"),
        api.get("/actions/statuses"),
        api.get("/events"),
        api.get(`/scenario-comparison/${day}`)
      ]);
      
      setDayData(dayRes.data);
      setRunInfo(runRes.data);
      setTimeSeries(seriesRes.data.series);
      setFullSeries(fullSeriesRes.data.series);
      setWhatChanged(changedRes.data.changes);
      setQuickDays(quickRes.data.days);
      setEvents(eventsRes.data);
      setScenarioComparison(scenarioRes.data);
      
      // Convert statuses array to map
      const statusMap = {};
      statusesRes.data.statuses.forEach(s => {
        statusMap[s.action_id] = s;
      });
      setActionStatuses(statusMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentDay);
  }, [currentDay, fetchData]);

  const handleDayChange = (day) => {
    setLoading(true);
    setOutcomeDelta(null); // Reset outcome delta when changing day
    setCurrentDay(day);
  };

  const updateActionStatus = async (actionId, status, reasonCode = null, note = "") => {
    try {
      await api.post(`/actions/${actionId}/status`, {
        status,
        reason_code: reasonCode,
        note
      });
      
      // Update local state
      setActionStatuses(prev => ({
        ...prev,
        [actionId]: { action_id: actionId, status, reason_code: reasonCode, note }
      }));
      
      toast.success(`Action marked as ${status}`);
      
      // If marked as Done, calculate and show outcome delta
      if (status === "Done") {
        const scenarioRes = await api.get(`/scenario-comparison/${currentDay}`);
        setScenarioComparison(scenarioRes.data);
        
        // Calculate outcome delta for display
        const action = dayData?.actions?.find(a => a.id === actionId);
        if (action?.impact_on_done) {
          setOutcomeDelta(prev => ({
            remaining_days: (prev?.remaining_days || 0) + action.impact_on_done.remaining_days_delta,
            health_score: (prev?.health_score || 0) + action.impact_on_done.health_score_delta,
            polymer_reduction: (prev?.polymer_reduction || 0) + action.impact_on_done.polymer_reduction_pct,
            ci_tightening: (prev?.ci_tightening || 0) + action.impact_on_done.ci_tightening_days
          }));
        }
        
        // Refresh day data
        const dayRes = await api.post(`/apply-action-impact/${currentDay}`, [actionId]);
        if (dayRes.data.adjusted) {
          setDayData(prev => ({
            ...prev,
            ...dayRes.data.adjusted
          }));
        }
      }
    } catch (error) {
      console.error("Error updating action status:", error);
      toast.error("Failed to update action status");
    }
  };

  const contextValue = {
    currentDay,
    dayData,
    runInfo,
    timeSeries,
    fullSeries,
    whatChanged,
    quickDays,
    loading,
    handleDayChange,
    fetchData,
    actionStatuses,
    updateActionStatus,
    events,
    scenarioComparison,
    outcomeDelta,
    setOutcomeDelta
  };

  return (
    <AppContext.Provider value={contextValue}>
      <BrowserRouter>
        <div className="app-layout">
          <LeftNav />
          <div className="main-content">
            <TopBar 
              currentDay={currentDay} 
              quickDays={quickDays} 
              onDayChange={handleDayChange}
              dayData={dayData}
            />
            <Routes>
              <Route path="/" element={<MissionControl />} />
              <Route path="/actions" element={<ActionsRequired />} />
              <Route path="/plan" element={<PlanCommit />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
      <Toaster position="top-right" theme="light" richColors closeButton />
    </AppContext.Provider>
  );
}

function LeftNav() {
  const navItems = [
    { path: "/", label: "Mission Control", icon: Gauge },
    { path: "/actions", label: "Actions Required", icon: ClipboardList },
    { path: "/plan", label: "Plan & Commit", icon: Target },
  ];

  return (
    <nav className="left-nav">
      <div className="nav-logo">
        <div className="nav-logo-icon">
          <Activity size={18} color="white" />
        </div>
        <div>
          <div className="nav-logo-text">KR AA Run Health</div>
          <div className="nav-logo-sub">Kochi Refinery</div>
        </div>
      </div>
      
      <div className="nav-items">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            data-testid={`nav-${item.path === "/" ? "mission" : item.path.slice(1)}`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
      
      <div className="nav-footer">
        <div className="demo-badge">
          <Info size={10} />
          <span>Demo</span>
        </div>
      </div>
    </nav>
  );
}

function TopBar({ currentDay, quickDays, onDayChange, dayData }) {
  return (
    <div className="top-bar" data-testid="top-bar">
      <div className="top-bar-left">
        <div className="run-selector">
          <Activity size={14} />
          <span>KR-AA-CURRENT-BEST-CANDIDATE</span>
        </div>
      </div>
      
      <div className="top-bar-center">
        <div className="day-selector">
          <span className="day-label">Day</span>
          <span className="day-value">{currentDay}</span>
          <span className="day-total">of 111</span>
          
          <div className="day-slider-container">
            <input 
              type="range" 
              min="1" 
              max="111" 
              value={currentDay}
              onChange={(e) => onDayChange(parseInt(e.target.value))}
              className="day-slider-input"
            />
          </div>
          
          <div className="quick-chips">
            {quickDays.map((item) => (
              <button
                key={item.day}
                className={`quick-chip ${currentDay === item.day ? "active" : ""}`}
                onClick={() => onDayChange(item.day)}
                data-testid={`quick-day-${item.day}`}
              >
                {item.day}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="top-bar-right">
        <div className="data-status">
          <span className="data-status-item">
            <span className="status-dot ok"></span>
            Data updated: 2 min ago
          </span>
          <span className="data-status-item">
            Scored: 5 min ago
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
