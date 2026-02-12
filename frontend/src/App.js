import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Settings, 
  Target, 
  TrendingUp, 
  Shield,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Droplet,
  ThermometerSun,
  Gauge,
  ListChecks,
  FileText,
  Database,
  X,
  Check,
  ArrowRight,
  RefreshCw
} from "lucide-react";

// Pages
import MissionControl from "./pages/MissionControl";
import ActionCenter from "./pages/ActionCenter";
import WhatChanged from "./pages/WhatChanged";
import GoldenComparator from "./pages/GoldenComparator";
import DataFreshness from "./pages/DataFreshness";

// Components
import DemoControlPanel from "./components/DemoControlPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Create axios instance
export const api = axios.create({
  baseURL: API,
  timeout: 10000,
});

// App Context for shared state
export const AppContext = React.createContext(null);

import React from "react";

function App() {
  const [projections, setProjections] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [actions, setActions] = useState(null);
  const [freshness, setFreshness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDemoPanel, setShowDemoPanel] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [projectionsRes, metricsRes, actionsRes, freshnessRes] = await Promise.all([
        api.get("/projections"),
        api.get("/metrics"),
        api.get("/actions"),
        api.get("/data-freshness"),
      ]);
      setProjections(projectionsRes.data);
      setMetrics(metricsRes.data);
      setActions(actionsRes.data);
      setFreshness(freshnessRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDemoAction = async (action, params = {}) => {
    try {
      let response;
      switch (action) {
        case "advance":
          response = await api.post("/demo/advance-time");
          toast.success(`Advanced 6 hours • Day ${response.data.new_day}`);
          break;
        case "inject":
          response = await api.post("/demo/inject-event", { event_type: params.eventType });
          toast.success(`Injected: ${params.eventType.replace("_", " ")}`);
          break;
        case "resolve":
          response = await api.post("/demo/resolve-action");
          toast.success(response.data.message);
          break;
        case "pause":
          response = await api.post("/demo/pause");
          toast.info("Data feed paused");
          break;
        case "resume":
          response = await api.post("/demo/resume");
          toast.success("Data feed resumed");
          break;
        case "reset":
          response = await api.post("/demo/reset");
          toast.success("Simulation reset to Day 1");
          break;
        default:
          break;
      }
      fetchData();
    } catch (error) {
      console.error("Demo action error:", error);
      toast.error("Action failed");
    }
  };

  const contextValue = {
    projections,
    metrics,
    actions,
    freshness,
    loading,
    fetchData,
    handleDemoAction,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-container">
        <BrowserRouter>
          <Header freshness={freshness} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<MissionControl />} />
              <Route path="/actions" element={<ActionCenter />} />
              <Route path="/timeline" element={<WhatChanged />} />
              <Route path="/compare" element={<GoldenComparator />} />
              <Route path="/data" element={<DataFreshness />} />
            </Routes>
          </main>
          <DemoControlPanel 
            show={showDemoPanel} 
            onToggle={() => setShowDemoPanel(!showDemoPanel)}
            onAction={handleDemoAction}
            isPaused={freshness?.is_paused}
          />
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </div>
    </AppContext.Provider>
  );
}

function Header({ freshness }) {
  const location = useLocation();
  
  const navItems = [
    { path: "/", label: "Mission Control", icon: Target },
    { path: "/actions", label: "Action Center", icon: ListChecks },
    { path: "/timeline", label: "What Changed", icon: Clock },
    { path: "/compare", label: "Golden Comparator", icon: TrendingUp },
    { path: "/data", label: "Data Feed", icon: Database },
  ];

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo-icon">
            <Activity size={20} />
          </div>
          <div>
            <div className="logo-text">KR AA Run Health</div>
            <div className="logo-subtitle">Kochi Refinery • Acrylic Acid Unit</div>
          </div>
        </div>
        
        <nav className="nav-tabs">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}
              data-testid={`nav-${item.path === "/" ? "home" : item.path.slice(1)}`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <div className="freshness-indicator" data-testid="freshness-indicator">
            <span className={`freshness-dot ${freshness?.is_paused ? "paused" : ""}`}></span>
            <span>
              {freshness?.is_paused ? "Paused" : "Live"} • Day {freshness?.run_day || "—"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default App;
