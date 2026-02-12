import React, { useContext, useState, useEffect } from "react";
import { AppContext, api } from "../App";
import { useNavigate } from "react-router-dom";
import { 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export default function GoldenComparator() {
  const { loading, actions } = useContext(AppContext);
  const [comparison, setComparison] = useState(null);
  const [runs, setRuns] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [compRes, runsRes] = await Promise.all([
          api.get("/golden-comparison"),
          api.get("/runs")
        ]);
        setComparison(compRes.data);
        setRuns(runsRes.data);
      } catch (error) {
        console.error("Error fetching comparison:", error);
      }
    };
    fetchData();
  }, []);

  if (loading || !comparison) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p className="mt-4">Loading comparison...</p>
      </div>
    );
  }

  const getStatusIcon = (isWithin, deviation) => {
    if (isWithin) {
      return <span className="status-icon ok"><CheckCircle size={14} /></span>;
    }
    if (Math.abs(deviation) > 5) {
      return <span className="status-icon critical"><XCircle size={14} /></span>;
    }
    return <span className="status-icon warning"><AlertTriangle size={14} /></span>;
  };

  return (
    <div data-testid="golden-comparator">
      <div className="section-header">
        <div>
          <h1 className="section-title">Golden Comparator</h1>
          <p className="section-subtitle">
            Day {comparison.run_day} • {comparison.phase} • Comparing against golden baseline
          </p>
        </div>
        <Badge variant={comparison.deviations_count === 0 ? "default" : "destructive"}>
          {comparison.deviations_count} Deviation{comparison.deviations_count !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Comparison Table */}
      <Card className="mb-6" data-testid="comparison-table-card">
        <CardHeader>
          <CardTitle className="text-base">Current vs Golden Baseline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Metric</TableHead>
                <TableHead>Golden Band</TableHead>
                <TableHead>Current Value</TableHead>
                <TableHead>Deviation</TableHead>
                <TableHead>Protects</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.comparisons.map((item) => (
                <TableRow 
                  key={item.metric_key}
                  className={!item.is_within_band ? "bg-rose-50/50" : ""}
                  data-testid={`comparison-row-${item.metric_key}`}
                >
                  <TableCell className="font-medium">{item.metric_name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.golden_band} {item.unit}
                  </TableCell>
                  <TableCell className={`font-mono text-sm ${!item.is_within_band ? "text-rose-600 font-semibold" : ""}`}>
                    {item.current_value} {item.unit}
                  </TableCell>
                  <TableCell className={`font-mono text-sm ${item.deviation > 0 ? "text-rose-600" : item.deviation < 0 ? "text-emerald-600" : ""}`}>
                    {item.deviation > 0 ? "+" : ""}{item.deviation.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {item.protects}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusIcon(item.is_within_band, item.deviation)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Focus Areas */}
      {comparison.focus_areas.length > 0 && (
        <div className="focus-areas" data-testid="focus-areas">
          <div className="focus-areas-header">
            <div className="focus-areas-title">Focus Areas to Match Golden Behavior</div>
            <div className="focus-areas-subtitle">
              Address these deviations to align with golden run parameters at this stage
            </div>
          </div>
          
          <div className="focus-items">
            {comparison.focus_areas.map((item, idx) => (
              <div key={idx} className="focus-item" data-testid={`focus-item-${idx}`}>
                <div className="focus-item-content">
                  <div className="focus-item-metric">{item.metric_name}</div>
                  <div className="focus-item-detail">
                    Current: {item.current_value} {item.unit} • Band: {item.golden_band} {item.unit}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/actions")}
                >
                  View Action
                  <ArrowRight size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {comparison.focus_areas.length === 0 && (
        <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
          <CheckCircle size={32} style={{ color: "var(--accent-good)", marginBottom: "0.75rem" }} />
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Matching Golden Behavior</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            All metrics are within golden bands at this stage of the run.
          </div>
        </div>
      )}

      {/* Run History */}
      {runs && (
        <Card className="mt-6" data-testid="run-history-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={16} />
              Run History Reference
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="run-history-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>End Reason</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Current Run */}
                <TableRow className="current-row">
                  <TableCell className="font-medium">
                    {runs.current.run_id}
                    <Badge className="ml-2" variant="default">Current</Badge>
                  </TableCell>
                  <TableCell className="font-mono">{runs.current.duration_days} days</TableCell>
                  <TableCell>{runs.current.end_reason}</TableCell>
                  <TableCell className="text-muted-foreground">{runs.current.notes}</TableCell>
                </TableRow>
                
                {/* Historical Runs */}
                {runs.historical.map((run) => (
                  <TableRow 
                    key={run.run_id} 
                    className={run.is_golden ? "golden-row" : ""}
                  >
                    <TableCell className="font-medium">
                      {run.run_id}
                      {run.is_golden && (
                        <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200">
                          Golden Reference
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{run.duration_days} days</TableCell>
                    <TableCell>{run.end_reason}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{run.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
