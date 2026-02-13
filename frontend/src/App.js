import React, { useState, useEffect, useCallback, createContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  Activity, 
  Gauge, 
  FlaskConical,
  Info
} from "lucide-react";

// Pages
import MissionControl from "./pages/MissionControl";
import Simulator from "./pages/Simulator";

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
  const [whatChanged, setWhatChanged] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickDays, setQuickDays] = useState([]);
  const [actionStatuses, setActionStatuses] = useState({});
  const [events, setEvents] = useState(null);
  const [scenarioComparison, setScenarioComparison] = useState(null);
  const [scenarioMode, setScenarioMode] = useState("do_nothing"); // "do_nothing" or "execute_moves"

  const fetchData = useCallback(async (day) => {
    try {
      const [dayRes, runRes, seriesRes, changedRes, quickRes, statusesRes, eventsRes, scenarioRes] = await Promise.all([
        api.get(`/day/${day}`),
        api.get("/run-info"),
        api.get(`/time-series?start=1&end=${day}`),
        api.get(`/what-changed/${day}`),
        api.get("/quick-days"),
        api.get("/actions/statuses"),
        api.get("/events"),
        api.get(`/scenario-comparison/${day}`)
      ]);
      
      setDayData(dayRes.data);
      setRunInfo(runRes.data);
      setTimeSeries(seriesRes.data.series);
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
      
      // If marked as Done, refresh scenario comparison to show impact
      if (status === "Done") {
        const scenarioRes = await api.get(`/scenario-comparison/${currentDay}`);
        setScenarioComparison(scenarioRes.data);
        // Refresh day data to get updated metrics
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
    whatChanged,
    quickDays,
    loading,
    handleDayChange,
    fetchData,
    actionStatuses,
    updateActionStatus,
    events,
    scenarioComparison,
    scenarioMode,
    setScenarioMode
  };

  return (
    <AppContext.Provider value={contextValue}>
      <BrowserRouter>
        <div className="app-layout">
          <LeftNav />
          <div className="main-content">
            <StatusStrip dayData={dayData} />
            <Routes>
              <Route path="/" element={<MissionControl />} />
              <Route path="/simulator" element={<Simulator />} />
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
    { path: "/simulator", label: "Simulator", icon: FlaskConical },
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
        <div className="tooltip prototype-badge">
          <Info size={12} />
          <span>Prototype</span>
          <div className="tooltip-content">
            Illustrative simulation for UX; not plant-validated logic.
          </div>
        </div>
      </div>
    </nav>
  );
}

function StatusStrip({ dayData }) {
  if (!dayData) return null;
  
  const feedStatus = dayData.feed_status || "Healthy";
  const statusClass = feedStatus === "Healthy" ? "" : feedStatus === "Delayed" ? "delayed" : "interrupted";
  
  return (
    <div className="status-strip" data-testid="status-strip">
      <div className="status-left">
        <div className="status-item">
          <span className={`status-dot ${statusClass}`}></span>
          <span className="status-label">Feed:</span>
          <span className="status-value">{feedStatus}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Updated:</span>
          <span className="status-value">2 min ago</span>
        </div>
        <div className="status-item">
          <span className="status-label">Scored:</span>
          <span className="status-value">5 min ago</span>
        </div>
      </div>
      <div className="status-right">
        <div className="run-selector">
          <Activity size={14} />
          <span>KR-AA-GOLDEN-CANDIDATE</span>
        </div>
      </div>
    </div>
  );
}

export default App;
