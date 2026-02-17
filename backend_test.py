import requests
import sys
import json
from datetime import datetime

class KRAARunHealthAPITester:
    def __init__(self, base_url="https://plan-commit-studio.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Non-dict response'}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })

            return success, response.json() if success and response.content else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            return False, {}

    def test_basic_endpoints(self):
        """Test basic API endpoints"""
        print("\n=== Testing Basic Endpoints ===")
        
        # Root endpoint
        success, root_data = self.run_test("API Root", "GET", "", 200)
        if success and root_data:
            print(f"   Message: {root_data.get('message', 'N/A')}")
            print(f"   Status: {root_data.get('status', 'N/A')}")
            print(f"   Version: {root_data.get('version', 'N/A')}")
        
        # Run info endpoint
        success, run_data = self.run_test("Run Info", "GET", "run-info", 200)
        if success and run_data:
            print(f"   Run ID: {run_data.get('run_id', 'N/A')}")
            print(f"   Target days: {run_data.get('target_days', 'N/A')}")
            print(f"   Assets count: {len(run_data.get('assets', []))}")

    def test_day_data_endpoints(self):
        """Test day-specific data endpoints"""
        print("\n=== Testing Day Data Endpoints ===")
        
        # Test different days
        test_days = [1, 30, 70, 110]
        for day in test_days:
            success, day_data = self.run_test(f"Day {day} Data", "GET", f"day/{day}", 200)
            if success and day_data:
                print(f"   Day {day} - Health Score: {day_data.get('run_health_score', 'N/A')}")
                print(f"   Day {day} - Remaining Days: {day_data.get('predicted_remaining_days', 'N/A')}")
                print(f"   Day {day} - Output TPD: {day_data.get('eaa_output_tpd', 'N/A')}")
                print(f"   Day {day} - Drivers count: {len(day_data.get('drivers', []))}")
                print(f"   Day {day} - Actions count: {len(day_data.get('actions', []))}")

    def test_time_series_endpoints(self):
        """Test time series endpoints"""
        print("\n=== Testing Time Series Endpoints ===")
        
        # Time series for range
        success, series_data = self.run_test("Time Series (1-30)", "GET", "time-series?start=1&end=30", 200)
        if success and series_data:
            series = series_data.get('series', [])
            print(f"   Series length: {len(series)}")
            print(f"   Total days: {series_data.get('total_days', 'N/A')}")
            if series:
                print(f"   First day: {series[0].get('day', 'N/A')}")
                print(f"   Last day: {series[-1].get('day', 'N/A')}")
        
        # What changed endpoint
        success, changed_data = self.run_test("What Changed (Day 30)", "GET", "what-changed/30", 200)
        if success and changed_data:
            changes = changed_data.get('changes', [])
            print(f"   Current day: {changed_data.get('current_day', 'N/A')}")
            print(f"   Changes count: {len(changes)}")

    def test_events_endpoint(self):
        """Test events endpoint"""
        print("\n=== Testing Events Endpoint ===")
        
        success, events_data = self.run_test("Events Data", "GET", "events", 200)
        if success and events_data:
            events = events_data.get('events', [])
            shift_logs = events_data.get('shift_logs', [])
            lab_results = events_data.get('lab_results', [])
            pipeline_status = events_data.get('pipeline_status', [])
            
            print(f"   Events count: {len(events)}")
            print(f"   Shift logs count: {len(shift_logs)}")
            print(f"   Lab results count: {len(lab_results)}")
            print(f"   Pipeline status count: {len(pipeline_status)}")
            
            # Check event structure
            if events:
                event = events[0]
                print(f"   First event - Day: {event.get('day', 'N/A')}")
                print(f"   First event - Type: {event.get('type', 'N/A')}")
                print(f"   First event - Severity: {event.get('severity', 'N/A')}")

    def test_simulation_endpoint(self):
        """Test simulation endpoint"""
        print("\n=== Testing Simulation Endpoint ===")
        
        # Test simulation with different parameters
        sim_requests = [
            {
                "day": 30,
                "cleaning_cadence": 0,
                "inhibitor_dose_index": 1.0,
                "flush_frequency": 0,
                "intervention_discipline": "medium"
            },
            {
                "day": 70,
                "cleaning_cadence": 2,
                "inhibitor_dose_index": 1.2,
                "flush_frequency": 1,
                "intervention_discipline": "high"
            }
        ]
        
        for i, sim_data in enumerate(sim_requests):
            success, result = self.run_test(f"Simulation {i+1}", "POST", "simulate", 200, sim_data)
            if success and result:
                baseline = result.get('baseline', {})
                simulated = result.get('simulated', {})
                deltas = result.get('deltas', {})
                
                print(f"   Sim {i+1} - Baseline Health: {baseline.get('run_health_score', 'N/A')}")
                print(f"   Sim {i+1} - Simulated Health: {simulated.get('run_health_score', 'N/A')}")
                print(f"   Sim {i+1} - Health Delta: {deltas.get('health_score', 'N/A')}")
                print(f"   Sim {i+1} - Remaining Days Delta: {deltas.get('remaining_days', 'N/A')}")

    def test_quick_days_endpoint(self):
        """Test quick days endpoint"""
        print("\n=== Testing Quick Days Endpoint ===")
        
        success, quick_data = self.run_test("Quick Days", "GET", "quick-days", 200)
        if success and quick_data:
            days = quick_data.get('days', [])
            print(f"   Quick days count: {len(days)}")
            
            expected_days = [1, 7, 18, 30, 70, 110]
            actual_days = [d.get('day') for d in days]
            print(f"   Expected days: {expected_days}")
            print(f"   Actual days: {actual_days}")
            
            # Verify all expected days are present
            missing_days = set(expected_days) - set(actual_days)
            if missing_days:
                print(f"   ❌ Missing days: {missing_days}")
            else:
                print(f"   ✅ All expected days present")

    def test_intervention_window_endpoint(self):
        """Test intervention window endpoint"""
        print("\n=== Testing Intervention Window Endpoint ===")
        
        # Test intervention windows for different days
        test_days = [30, 70, 90]
        for day in test_days:
            success, window_data = self.run_test(f"Intervention Window Day {day}", "GET", f"intervention-window/{day}", 200)
            if success and window_data:
                print(f"   Day {day} - Current day: {window_data.get('current_day', 'N/A')}")
                print(f"   Day {day} - Window start: {window_data.get('window_start', 'N/A')}")
                print(f"   Day {day} - Window end: {window_data.get('window_end', 'N/A')}")
                print(f"   Day {day} - Urgency: {window_data.get('urgency', 'N/A')}")

    def test_action_status_endpoint(self):
        """Test action status update endpoint"""
        print("\n=== Testing Action Status Endpoint ===")
        
        # Get a day with actions first
        success, day_data = self.run_test("Get Day 70 for Actions", "GET", "day/70", 200)
        if success and day_data:
            actions = day_data.get('actions', [])
            if actions:
                action_id = actions[0].get('id')
                print(f"   Testing with action ID: {action_id}")
                
                # Test status updates
                status_updates = [
                    {"status": "Acknowledged", "note": "Test acknowledgment"},
                    {"status": "Done", "note": "Test completion", "reason_code": "COMPLETED"}
                ]
                
                for update in status_updates:
                    success, result = self.run_test(
                        f"Update Action Status to {update['status']}", 
                        "POST", 
                        f"actions/{action_id}/status",
                        200,
                        update
                    )
                    if success and result:
                        print(f"   Status updated to: {result.get('new_status', 'N/A')}")
                        print(f"   Updated at: {result.get('updated_at', 'N/A')}")
            else:
                print(f"   ⚠️  No actions found on Day 70 for testing")

    def test_error_cases(self):
        """Test error handling"""
        print("\n=== Testing Error Cases ===")
        
        # Invalid day (out of range)
        self.run_test("Invalid Day (0)", "GET", "day/0", 200)  # Should clamp to day 1
        self.run_test("Invalid Day (200)", "GET", "day/200", 200)  # Should clamp to day 111
        
        # Non-existent action
        self.run_test("Non-existent Action", "POST", "actions/INVALID-ID/status", 200, {"status": "Done"})
        
        # Invalid simulation data
        self.run_test("Invalid Simulation", "POST", "simulate", 422, {"invalid": "data"})

def main():
    print("🚀 Starting KR AA Run Health Prototype API Tests")
    print("=" * 60)
    
    tester = KRAARunHealthAPITester()
    
    # Run all test suites
    tester.test_basic_endpoints()
    tester.test_day_data_endpoints()
    tester.test_time_series_endpoints()
    tester.test_events_endpoint()
    tester.test_simulation_endpoint()
    tester.test_quick_days_endpoint()
    tester.test_intervention_window_endpoint()
    tester.test_action_status_endpoint()
    tester.test_error_cases()
    
    # Print summary
    print("\n" + "=" * 60)
    print(f"📊 Test Summary:")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Tests failed: {len(tester.failed_tests)}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests:")
        for i, test in enumerate(tester.failed_tests, 1):
            print(f"   {i}. {test['name']}")
            if 'error' in test:
                print(f"      Error: {test['error']}")
            else:
                print(f"      Expected: {test['expected']}, Got: {test['actual']}")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())