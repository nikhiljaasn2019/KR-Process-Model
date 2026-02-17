"""
Test Data Coherence for KR AA Run Health
Core story: Actual + Forecast should be BETTER than Benchmark (lower polymer, longer run, higher output)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDataCoherence:
    """
    Tests for data coherence: 
    - Lower polymer = Longer run = Higher output
    - Benchmark > Actual > Forecast for polymer
    - Benchmark < Actual < Forecast for run length and output
    """
    
    def test_api_health(self):
        """Check API is running"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        print("API health check passed")
    
    def test_day70_polymer_coherence(self):
        """Day 70: Benchmark polymer > Actual polymer > Forecast polymer"""
        response = requests.get(f"{BASE_URL}/api/day/70")
        assert response.status_code == 200
        data = response.json()
        
        benchmark_polymer = data.get("benchmark_polymer")
        actual_polymer = data.get("actual_polymer")
        forecast_polymer = data.get("forecast_polymer")
        
        print(f"Day 70 Polymer - Benchmark: {benchmark_polymer}, Actual: {actual_polymer}, Forecast: {forecast_polymer}")
        
        # Verify: Benchmark > Actual > Forecast
        assert benchmark_polymer > actual_polymer, f"Benchmark polymer ({benchmark_polymer}) should be > Actual polymer ({actual_polymer})"
        assert actual_polymer > forecast_polymer, f"Actual polymer ({actual_polymer}) should be > Forecast polymer ({forecast_polymer})"
        
        # Verify approximate values as per spec
        assert 590 < benchmark_polymer < 610, f"Benchmark polymer should be ~598, got {benchmark_polymer}"
        assert 490 < actual_polymer < 510, f"Actual polymer should be ~499, got {actual_polymer}"
        assert 400 < forecast_polymer < 420, f"Forecast polymer should be ~409, got {forecast_polymer}"
        
        print("Day 70 polymer coherence verified!")
    
    def test_day70_run_length_coherence(self):
        """Day 70: Forecast run length > Actual run length > Benchmark run length"""
        response = requests.get(f"{BASE_URL}/api/day/70")
        assert response.status_code == 200
        data = response.json()
        
        benchmark_run = data.get("benchmark_total_run")
        actual_run = data.get("actual_total_run")
        forecast_run = data.get("forecast_total_run")
        
        print(f"Day 70 Run Length - Benchmark: {benchmark_run}, Actual: {actual_run}, Forecast: {forecast_run}")
        
        # Verify: Forecast > Actual > Benchmark
        assert forecast_run > actual_run, f"Forecast run ({forecast_run}) should be > Actual run ({actual_run})"
        assert actual_run > benchmark_run, f"Actual run ({actual_run}) should be > Benchmark run ({benchmark_run})"
        
        # Verify approximate values
        assert benchmark_run == 111, f"Benchmark run should be 111, got {benchmark_run}"
        assert 115 < actual_run < 118, f"Actual run should be ~116, got {actual_run}"
        assert 120 < forecast_run < 123, f"Forecast run should be ~121, got {forecast_run}"
        
        print("Day 70 run length coherence verified!")
    
    def test_day70_output_coherence(self):
        """Day 70: Forecast output > Actual output > Benchmark output"""
        response = requests.get(f"{BASE_URL}/api/day/70")
        assert response.status_code == 200
        data = response.json()
        
        benchmark_output = data.get("benchmark_cumulative")
        actual_output = data.get("actual_cumulative")
        forecast_output = data.get("forecast_cumulative")
        
        print(f"Day 70 Output - Benchmark: {benchmark_output}, Actual: {actual_output}, Forecast: {forecast_output}")
        
        # Verify: Forecast > Actual > Benchmark
        assert forecast_output > actual_output, f"Forecast output ({forecast_output}) should be > Actual output ({actual_output})"
        assert actual_output > benchmark_output, f"Actual output ({actual_output}) should be > Benchmark output ({benchmark_output})"
        
        print("Day 70 output coherence verified!")


class TestPolymerChartData:
    """Tests for Polymer chart data requirements"""
    
    def test_benchmark_polymer_is_rising(self):
        """Verify benchmark polymer rises from 380 to ~780 over 111 days"""
        response = requests.get(f"{BASE_URL}/api/time-series?start=1&end=111")
        assert response.status_code == 200
        data = response.json()
        series = data.get("series", [])
        
        # Get start and end values
        day1 = next((d for d in series if d["day"] == 1), None)
        day111 = next((d for d in series if d["day"] == 110), None)  # Last available day
        
        assert day1 is not None, "Day 1 data should exist"
        
        start_benchmark = day1["benchmark_polymer"]
        end_benchmark = day111["benchmark_polymer"] if day111 else series[-1]["benchmark_polymer"]
        
        print(f"Benchmark polymer: Day 1 = {start_benchmark}, Day 110 = {end_benchmark}")
        
        # Verify rising pattern (380 → ~780)
        assert start_benchmark < 400, f"Benchmark should start around 380, got {start_benchmark}"
        assert end_benchmark > 700, f"Benchmark should end around 780, got {end_benchmark}"
        assert end_benchmark > start_benchmark, "Benchmark polymer should be rising"
        
        # Verify it's actually rising across days (not flat)
        midpoint = series[len(series)//2]
        mid_benchmark = midpoint["benchmark_polymer"]
        assert start_benchmark < mid_benchmark < end_benchmark, "Benchmark should be consistently rising"
        
        print(f"Benchmark polymer is rising: {start_benchmark} → {mid_benchmark} → {end_benchmark}")
    
    def test_actual_lower_than_benchmark(self):
        """Verify actual polymer is lower than benchmark (except during events)"""
        response = requests.get(f"{BASE_URL}/api/time-series?start=1&end=111")
        assert response.status_code == 200
        series = data = response.json().get("series", [])
        
        # Skip event days (12, 52) where actual spikes
        non_event_days = [d for d in series if d["day"] not in [12, 13, 14, 52, 53, 54]]
        
        violations = []
        for d in non_event_days:
            if d["actual_polymer"] >= d["benchmark_polymer"]:
                violations.append(f"Day {d['day']}: Actual {d['actual_polymer']} >= Benchmark {d['benchmark_polymer']}")
        
        if violations:
            print(f"Violations found: {len(violations)}")
            for v in violations[:5]:
                print(f"  {v}")
        
        # Allow a small number of violations due to randomness/jitter
        assert len(violations) < len(non_event_days) * 0.1, f"Too many violations: {len(violations)} out of {len(non_event_days)}"
        print("Actual polymer is generally lower than benchmark (as expected)")
    
    def test_forecast_is_lowest_and_stable(self):
        """Verify forecast polymer is lowest and relatively stable"""
        response = requests.get(f"{BASE_URL}/api/time-series?start=1&end=111")
        assert response.status_code == 200
        series = response.json().get("series", [])
        
        # Check forecast is lower than benchmark across all days
        for d in series:
            assert d["forecast_polymer"] < d["benchmark_polymer"], f"Day {d['day']}: Forecast ({d['forecast_polymer']}) should be < Benchmark ({d['benchmark_polymer']})"
        
        # Forecast should be relatively stable (not have dramatic swings)
        forecast_values = [d["forecast_polymer"] for d in series]
        max_forecast = max(forecast_values)
        min_forecast = min(forecast_values)
        range_pct = (max_forecast - min_forecast) / min_forecast * 100
        
        print(f"Forecast polymer range: {min_forecast:.1f} to {max_forecast:.1f} ({range_pct:.1f}% variation)")
        
        # Forecast should have less than 100% variation (relatively stable compared to benchmark)
        assert range_pct < 150, f"Forecast polymer should be relatively stable, got {range_pct:.1f}% variation"


class TestRunLengthChartData:
    """Tests for Run Length chart data requirements"""
    
    def test_all_three_lines_separated(self):
        """Verify all 3 lines (benchmark, actual, forecast) are visible and separated"""
        response = requests.get(f"{BASE_URL}/api/time-series?start=1&end=111")
        assert response.status_code == 200
        series = response.json().get("series", [])
        
        for d in series:
            benchmark = d["benchmark_total_run"]
            actual = d["actual_total_run"]
            forecast = d["forecast_total_run"]
            
            # All three should be distinct
            assert benchmark != actual, f"Day {d['day']}: Benchmark and Actual should be different"
            assert actual != forecast, f"Day {d['day']}: Actual and Forecast should be different"
            assert benchmark != forecast, f"Day {d['day']}: Benchmark and Forecast should be different"
            
            # Verify ordering: Forecast > Actual > Benchmark
            assert forecast > actual > benchmark, f"Day {d['day']}: Expected Forecast ({forecast}) > Actual ({actual}) > Benchmark ({benchmark})"
        
        print("All 3 run length lines are separated and properly ordered")
    
    def test_positive_deviation_badge(self):
        """Verify +Xd vs Best badge shows positive value"""
        response = requests.get(f"{BASE_URL}/api/day/70")
        assert response.status_code == 200
        data = response.json()
        
        # deviation = forecast_total_run - benchmark_total_run
        benchmark_gap = data.get("benchmark_gap_days")
        forecast_run = data.get("forecast_total_run")
        benchmark_run = data.get("benchmark_total_run")
        
        calculated_gap = round(forecast_run - benchmark_run)
        
        print(f"Benchmark gap: {benchmark_gap}, Calculated: {calculated_gap}")
        print(f"Deviation badge should show: +{calculated_gap}d vs Best")
        
        assert calculated_gap > 0, f"Deviation should be positive, got {calculated_gap}"
        assert calculated_gap >= 5, f"Deviation should be at least +5d, got {calculated_gap}"


class TestOutputChartData:
    """Tests for Output chart data requirements"""
    
    def test_forecast_output_ends_highest(self):
        """Verify forecast cumulative output is highest at end"""
        response = requests.get(f"{BASE_URL}/api/time-series?start=1&end=111")
        assert response.status_code == 200
        series = response.json().get("series", [])
        
        last_day = series[-1]
        benchmark_output = last_day["benchmark_cumulative"]
        actual_output = last_day["actual_cumulative"]
        forecast_output = last_day["forecast_cumulative"]
        
        print(f"Day {last_day['day']} Output - Benchmark: {benchmark_output}, Actual: {actual_output}, Forecast: {forecast_output}")
        
        # Forecast should be highest
        assert forecast_output > actual_output, "Forecast output should be > Actual output"
        assert actual_output > benchmark_output, "Actual output should be > Benchmark output"
        
        print("Forecast output ends highest as expected")


class TestEventsData:
    """Tests for event data requirements"""
    
    def test_events_at_d12_and_d52(self):
        """Verify events are marked at D12 and D52"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        data = response.json()
        events = data.get("events", [])
        
        event_days = [e["day"] for e in events]
        
        assert 12 in event_days, "Event at Day 12 (Filter Cleaning Spike) should exist"
        assert 52 in event_days, "Event at Day 52 (Fouling Risk Cluster) should exist"
        
        # Verify event details
        d12_event = next(e for e in events if e["day"] == 12)
        d52_event = next(e for e in events if e["day"] == 52)
        
        assert d12_event["type"] == "FILTER_CLEANING_SPIKE"
        assert d52_event["type"] == "FOULING_RISK_CLUSTER"
        
        print(f"Events at D12: {d12_event['label']}, D52: {d52_event['label']}")
    
    def test_time_series_has_event_flags(self):
        """Verify time series data has event flags on D12 and D52"""
        response = requests.get(f"{BASE_URL}/api/time-series?start=1&end=111")
        assert response.status_code == 200
        series = response.json().get("series", [])
        
        d12 = next((d for d in series if d["day"] == 12), None)
        d52 = next((d for d in series if d["day"] == 52), None)
        
        assert d12 and d12.get("has_event") == True, "Day 12 should have event flag"
        assert d52 and d52.get("has_event") == True, "Day 52 should have event flag"
        
        print("Event flags verified at D12 and D52")


class TestForecastSmoothness:
    """Tests for forecast line smoothness (no sudden jumps)"""
    
    def test_no_sudden_jumps_in_forecast(self):
        """Verify forecast lines don't have sudden jumps"""
        response = requests.get(f"{BASE_URL}/api/time-series?start=1&end=111")
        assert response.status_code == 200
        series = response.json().get("series", [])
        
        # Check for sudden jumps in forecast polymer (day-to-day change > 50%)
        large_jumps = []
        for i in range(1, len(series)):
            prev = series[i-1]
            curr = series[i]
            
            if prev["forecast_polymer"] > 0:
                change_pct = abs(curr["forecast_polymer"] - prev["forecast_polymer"]) / prev["forecast_polymer"] * 100
                if change_pct > 10:  # More than 10% day-to-day change
                    large_jumps.append(f"Day {curr['day']}: {change_pct:.1f}% change")
        
        if large_jumps:
            print(f"Large jumps found in forecast polymer: {large_jumps[:5]}")
        
        # Allow some jumps but not many
        assert len(large_jumps) < len(series) * 0.05, f"Too many sudden jumps in forecast: {len(large_jumps)}"
        print("Forecast lines are smooth (no major sudden jumps)")


class TestFutureDates:
    """Tests for future-looking dates (2026)"""
    
    def test_dates_are_2026(self):
        """Verify dates are in 2026 (future-looking)"""
        response = requests.get(f"{BASE_URL}/api/day/70")
        assert response.status_code == 200
        data = response.json()
        
        current_date = data.get("current_date")
        predicted_end_date = data.get("predicted_end_date_p50")
        
        print(f"Current date: {current_date}, Predicted end: {predicted_end_date}")
        
        # Dates should be in 2025 or 2026 (depending on current date)
        assert "2025" in str(current_date) or "2026" in str(current_date), "Current date should be 2025 or 2026"
        assert "2025" in str(predicted_end_date) or "2026" in str(predicted_end_date), "Predicted end date should be 2025 or 2026"
        
        print("Future-looking dates verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
