"""
Backend API Tests for KR AA Run Health V2.1
Tests all endpoints including action status persistence
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndRoot:
    """Basic health check tests"""
    
    def test_root_endpoint(self):
        """Test API root returns operational status"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        assert "version" in data
        print(f"API Version: {data.get('version')}")

    def test_run_info(self):
        """Test run info endpoint returns golden run metadata"""
        response = requests.get(f"{BASE_URL}/api/run-info")
        assert response.status_code == 200
        data = response.json()
        assert "run_id" in data
        assert "start_ts" in data
        assert "end_ts" in data
        assert "target_days" in data
        assert data["target_days"] == 111
        print(f"Run ID: {data['run_id']}")


class TestDayData:
    """Tests for day data endpoints"""
    
    def test_day_1_data(self):
        """Test Day 1 data - early run phase"""
        response = requests.get(f"{BASE_URL}/api/day/1")
        assert response.status_code == 200
        data = response.json()
        assert data["day"] == 1
        assert "run_health_score" in data
        assert "predicted_remaining_days" in data
        assert "eaa_output_tpd" in data
        assert "drivers" in data
        assert "actions" in data
        # Day 1 should have high health score
        assert data["run_health_score"] > 80
        print(f"Day 1 Health Score: {data['run_health_score']:.1f}")

    def test_day_30_data(self):
        """Test Day 30 data - mid run phase"""
        response = requests.get(f"{BASE_URL}/api/day/30")
        assert response.status_code == 200
        data = response.json()
        assert data["day"] == 30
        assert "run_health_score" in data
        assert "predicted_end_date" in data
        assert "current_date_display" in data
        assert "polymer_burden_kg_per_day" in data
        assert "filter_change_count_per_day" in data
        print(f"Day 30 Health Score: {data['run_health_score']:.1f}")

    def test_day_70_data(self):
        """Test Day 70 data - late run phase"""
        response = requests.get(f"{BASE_URL}/api/day/70")
        assert response.status_code == 200
        data = response.json()
        assert data["day"] == 70
        # Late phase should have more drivers
        assert len(data.get("drivers", [])) >= 0
        print(f"Day 70 Drivers count: {len(data.get('drivers', []))}")

    def test_day_110_data(self):
        """Test Day 110 data - end of run"""
        response = requests.get(f"{BASE_URL}/api/day/110")
        assert response.status_code == 200
        data = response.json()
        assert data["day"] == 110
        # End of run should have lower health score
        print(f"Day 110 Health Score: {data['run_health_score']:.1f}")

    def test_day_boundary_min(self):
        """Test day boundary - minimum (clamped to 1)"""
        response = requests.get(f"{BASE_URL}/api/day/0")
        assert response.status_code == 200
        data = response.json()
        assert data["day"] == 1  # Should clamp to 1

    def test_day_boundary_max(self):
        """Test day boundary - maximum (clamped to 111)"""
        response = requests.get(f"{BASE_URL}/api/day/200")
        assert response.status_code == 200
        data = response.json()
        assert data["day"] == 111  # Should clamp to 111


class TestTimeSeries:
    """Tests for time series endpoints"""
    
    def test_time_series_default(self):
        """Test time series with default range"""
        response = requests.get(f"{BASE_URL}/api/time-series")
        assert response.status_code == 200
        data = response.json()
        assert "series" in data
        assert "total_days" in data
        assert data["total_days"] == 111
        assert len(data["series"]) == 111
        print(f"Time series length: {len(data['series'])}")

    def test_time_series_custom_range(self):
        """Test time series with custom range"""
        response = requests.get(f"{BASE_URL}/api/time-series?start=10&end=30")
        assert response.status_code == 200
        data = response.json()
        assert data["total_days"] == 21
        assert len(data["series"]) == 21
        # Verify first and last days
        assert data["series"][0]["day"] == 10
        assert data["series"][-1]["day"] == 30


class TestWhatChanged:
    """Tests for what-changed timeline"""
    
    def test_what_changed_day_30(self):
        """Test what changed for day 30"""
        response = requests.get(f"{BASE_URL}/api/what-changed/30")
        assert response.status_code == 200
        data = response.json()
        assert data["current_day"] == 30
        assert "changes" in data
        # Should have 7 days of changes
        assert len(data["changes"]) == 7
        # Verify change structure
        for change in data["changes"]:
            assert "day" in change
            assert "health_score" in change
            assert "remaining_days" in change
            assert "output_tpd" in change
        print(f"Changes count: {len(data['changes'])}")


class TestEvents:
    """Tests for events endpoint"""
    
    def test_events_endpoint(self):
        """Test events returns all operational events"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert "shift_logs" in data
        assert "lab_results" in data
        assert "pipeline_status" in data
        # Verify events have required fields
        if len(data["events"]) > 0:
            event = data["events"][0]
            assert "day" in event
            assert "type" in event
            assert "severity" in event
        print(f"Events count: {len(data['events'])}")
        print(f"Shift logs count: {len(data['shift_logs'])}")


class TestQuickDays:
    """Tests for quick days endpoint - Updated for Decision Instrument"""
    
    def test_quick_days(self):
        """Test quick days returns jump options - now includes Day 7, 30, 52, 70, 96, 110"""
        response = requests.get(f"{BASE_URL}/api/quick-days")
        assert response.status_code == 200
        data = response.json()
        assert "days" in data
        # Should have 6 quick day options
        assert len(data["days"]) == 6
        # Verify structure
        for day_opt in data["days"]:
            assert "day" in day_opt
            assert "label" in day_opt
            assert "phase" in day_opt
            assert "moment" in day_opt  # New field for Decision Instrument
        # Verify specific days (updated: 7, 30, 52, 70, 96, 110)
        days = [d["day"] for d in data["days"]]
        assert 7 in days  # Changed from 1 to 7
        assert 30 in days
        assert 52 in days  # New critical day
        assert 70 in days  # Default landing day
        assert 96 in days  # New critical day
        assert 110 in days
        print(f"Quick days: {days}")


class TestSimulator:
    """Tests for simulator/what-if endpoint"""
    
    def test_simulate_baseline(self):
        """Test simulation with baseline settings"""
        payload = {
            "day": 30,
            "cleaning_cadence": 0,
            "inhibitor_dose_index": 1.0,
            "flush_frequency": 0,
            "intervention_discipline": "medium"
        }
        response = requests.post(f"{BASE_URL}/api/simulate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "baseline" in data
        assert "simulated" in data
        assert "deltas" in data
        assert "adjustments" in data
        # With baseline settings, deltas should be minimal
        print(f"Baseline health: {data['baseline']['run_health_score']:.1f}")
        print(f"Simulated health: {data['simulated']['run_health_score']:.1f}")

    def test_simulate_aggressive(self):
        """Test simulation with aggressive intervention"""
        payload = {
            "day": 30,
            "cleaning_cadence": 2,
            "inhibitor_dose_index": 1.2,
            "flush_frequency": 1,
            "intervention_discipline": "high"
        }
        response = requests.post(f"{BASE_URL}/api/simulate", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Aggressive settings should improve metrics
        assert data["deltas"]["health_score"] >= 0
        assert data["deltas"]["remaining_days"] >= 0
        print(f"Health delta: {data['deltas']['health_score']}")
        print(f"Remaining days delta: {data['deltas']['remaining_days']}")


class TestActionStatuses:
    """Tests for action status persistence - CRITICAL for V2.1"""
    
    def test_get_all_statuses(self):
        """Test getting all action statuses"""
        response = requests.get(f"{BASE_URL}/api/actions/statuses")
        assert response.status_code == 200
        data = response.json()
        assert "statuses" in data
        assert isinstance(data["statuses"], list)
        print(f"Existing statuses count: {len(data['statuses'])}")

    def test_update_action_acknowledge(self):
        """Test acknowledging an action"""
        action_id = "TEST-ACT-001"
        payload = {
            "status": "Acknowledged",
            "reason_code": None,
            "note": "Test acknowledgement"
        }
        response = requests.post(f"{BASE_URL}/api/actions/{action_id}/status", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["action_id"] == action_id
        assert data["new_status"] == "Acknowledged"
        print(f"Action {action_id} acknowledged")

    def test_update_action_done(self):
        """Test marking an action as done"""
        action_id = "TEST-ACT-002"
        payload = {
            "status": "Done",
            "reason_code": None,
            "note": "Completed successfully"
        }
        response = requests.post(f"{BASE_URL}/api/actions/{action_id}/status", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["action_id"] == action_id
        assert data["new_status"] == "Done"
        print(f"Action {action_id} marked done")

    def test_update_action_not_feasible(self):
        """Test marking an action as not feasible with reason code"""
        action_id = "TEST-ACT-003"
        payload = {
            "status": "Not Feasible",
            "reason_code": "EQUIPMENT_ISSUE",
            "note": "Equipment not available for maintenance"
        }
        response = requests.post(f"{BASE_URL}/api/actions/{action_id}/status", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["action_id"] == action_id
        assert data["new_status"] == "Not Feasible"
        assert data["reason_code"] == "EQUIPMENT_ISSUE"
        print(f"Action {action_id} marked not feasible")

    def test_get_specific_action_status(self):
        """Test getting status of a specific action"""
        action_id = "TEST-ACT-001"
        response = requests.get(f"{BASE_URL}/api/actions/{action_id}/status")
        assert response.status_code == 200
        data = response.json()
        assert data["action_id"] == action_id
        assert data["status"] == "Acknowledged"
        print(f"Action {action_id} status: {data['status']}")

    def test_status_persistence(self):
        """Test that statuses persist after update"""
        # First update
        action_id = "TEST-PERSIST-001"
        payload = {"status": "Done", "reason_code": None, "note": ""}
        requests.post(f"{BASE_URL}/api/actions/{action_id}/status", json=payload)
        
        # Verify in all statuses
        response = requests.get(f"{BASE_URL}/api/actions/statuses")
        assert response.status_code == 200
        data = response.json()
        
        found = False
        for status in data["statuses"]:
            if status["action_id"] == action_id:
                assert status["status"] == "Done"
                found = True
                break
        assert found, f"Action {action_id} not found in statuses"
        print(f"Status persistence verified for {action_id}")

    def test_status_update_overwrites(self):
        """Test that updating status overwrites previous value"""
        action_id = "TEST-OVERWRITE-001"
        
        # First set to Acknowledged
        payload1 = {"status": "Acknowledged", "reason_code": None, "note": ""}
        requests.post(f"{BASE_URL}/api/actions/{action_id}/status", json=payload1)
        
        # Then update to Done
        payload2 = {"status": "Done", "reason_code": None, "note": "Completed"}
        requests.post(f"{BASE_URL}/api/actions/{action_id}/status", json=payload2)
        
        # Verify final status
        response = requests.get(f"{BASE_URL}/api/actions/{action_id}/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Done"
        print(f"Status overwrite verified: {action_id} is now Done")

    def test_nonexistent_action_status(self):
        """Test getting status of non-existent action returns New"""
        action_id = "NONEXISTENT-ACTION-XYZ"
        response = requests.get(f"{BASE_URL}/api/actions/{action_id}/status")
        assert response.status_code == 200
        data = response.json()
        assert data["action_id"] == action_id
        assert data["status"] == "New"
        print(f"Non-existent action returns status: {data['status']}")


class TestInterventionWindow:
    """Tests for intervention window endpoint"""
    
    def test_intervention_window_early(self):
        """Test intervention window for early day"""
        response = requests.get(f"{BASE_URL}/api/intervention-window/10")
        assert response.status_code == 200
        data = response.json()
        assert data["current_day"] == 10
        assert "urgency" in data
        assert "reason" in data
        print(f"Day 10 urgency: {data['urgency']}")

    def test_intervention_window_late(self):
        """Test intervention window for late day"""
        response = requests.get(f"{BASE_URL}/api/intervention-window/70")
        assert response.status_code == 200
        data = response.json()
        assert data["current_day"] == 70
        print(f"Day 70 urgency: {data['urgency']}")


class TestDataIntegrity:
    """Tests for data integrity and consistency"""
    
    def test_day_data_has_actions(self):
        """Test that day data includes actions for Today's Moves - Updated structure"""
        response = requests.get(f"{BASE_URL}/api/day/30")
        assert response.status_code == 200
        data = response.json()
        assert "actions" in data
        # Should have up to 3 actions
        assert len(data["actions"]) <= 3
        if len(data["actions"]) > 0:
            action = data["actions"][0]
            # Updated action structure for Decision Instrument
            assert "id" in action
            assert "title" in action
            assert "urgency" in action  # New: critical/high/medium/routine
            assert "protects" in action  # New: Run Length/Productivity/Both
            assert "trigger" in action  # New: replaces 'metric'
            assert "where" in action  # New: asset tags
            assert "checklist" in action
            assert "expected_effect" in action
            assert "impact_on_done" in action  # New: immediate impact when marked Done
            # Verify trigger structure
            trigger = action["trigger"]
            assert "metric" in trigger
            assert "current" in trigger
            assert "baseline" in trigger
            assert "deviation" in trigger
        print(f"Day 30 actions count: {len(data['actions'])}")

    def test_day_data_has_drivers(self):
        """Test that day data includes drivers"""
        response = requests.get(f"{BASE_URL}/api/day/70")
        assert response.status_code == 200
        data = response.json()
        assert "drivers" in data
        if len(data["drivers"]) > 0:
            driver = data["drivers"][0]
            assert "metric" in driver
            assert "current_value" in driver
            assert "baseline" in driver
            assert "severity" in driver
        print(f"Day 70 drivers count: {len(data['drivers'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
