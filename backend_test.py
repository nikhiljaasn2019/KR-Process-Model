import requests
import sys
import json
from datetime import datetime

class KRAARunHealthAPITester:
    def __init__(self, base_url="https://aa-runhealth.preview.emergentagent.com"):
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
        self.run_test("API Root", "GET", "", 200)
        
        # Config endpoint
        self.run_test("Golden Config", "GET", "config", 200)
        
        # Runs endpoint
        self.run_test("Runs Data", "GET", "runs", 200)

    def test_metrics_and_projections(self):
        """Test metrics and projections endpoints"""
        print("\n=== Testing Metrics & Projections ===")
        
        # Metrics
        success, metrics_data = self.run_test("Current Metrics", "GET", "metrics", 200)
        if success and metrics_data:
            print(f"   Metrics count: {len(metrics_data.get('metrics', {}))}")
            print(f"   Current day: {metrics_data.get('run_day', 'N/A')}")
        
        # Projections
        success, proj_data = self.run_test("Run Projections", "GET", "projections", 200)
        if success and proj_data:
            print(f"   Current day: {proj_data.get('current_day', 'N/A')}")
            print(f"   Projected total: {proj_data.get('projected_total_days', 'N/A')}")
            print(f"   Gap to golden: {proj_data.get('gap_to_golden', 'N/A')}")

    def test_actions_workflow(self):
        """Test actions endpoints and workflow"""
        print("\n=== Testing Actions Workflow ===")
        
        # Get actions
        success, actions_data = self.run_test("Get Actions", "GET", "actions", 200)
        if success and actions_data:
            actions = actions_data.get('actions', [])
            print(f"   Total actions: {len(actions)}")
            print(f"   Active count: {actions_data.get('active_count', 0)}")
            
            # Test action status update if actions exist
            if actions:
                action_id = actions[0]['id']
                print(f"   Testing status update for action: {action_id}")
                
                # Test acknowledge
                self.run_test(
                    f"Acknowledge Action {action_id}", 
                    "POST", 
                    f"actions/{action_id}/status",
                    200,
                    {"status": "Acknowledged", "note": "Test acknowledgment"}
                )
                
                # Test mark done
                self.run_test(
                    f"Mark Done Action {action_id}", 
                    "POST", 
                    f"actions/{action_id}/status",
                    200,
                    {"status": "Done", "note": "Test completion"}
                )

    def test_timeline_and_comparison(self):
        """Test timeline and golden comparison endpoints"""
        print("\n=== Testing Timeline & Comparison ===")
        
        # Timeline
        success, timeline_data = self.run_test("Timeline Data", "GET", "timeline", 200)
        if success and timeline_data:
            events = timeline_data.get('events', [])
            metrics_trend = timeline_data.get('metrics_trend', [])
            print(f"   Events count: {len(events)}")
            print(f"   Metrics trend points: {len(metrics_trend)}")
        
        # Golden comparison
        success, comp_data = self.run_test("Golden Comparison", "GET", "golden-comparison", 200)
        if success and comp_data:
            comparisons = comp_data.get('comparisons', [])
            deviations = comp_data.get('deviations_count', 0)
            print(f"   Comparisons count: {len(comparisons)}")
            print(f"   Deviations: {deviations}")
        
        # Threats
        self.run_test("Threats Data", "GET", "threats", 200)

    def test_data_freshness(self):
        """Test data freshness endpoint"""
        print("\n=== Testing Data Freshness ===")
        
        success, fresh_data = self.run_test("Data Freshness", "GET", "data-freshness", 200)
        if success and fresh_data:
            print(f"   Run day: {fresh_data.get('run_day', 'N/A')}")
            print(f"   Is paused: {fresh_data.get('is_paused', 'N/A')}")
            print(f"   Confidence: {fresh_data.get('confidence', 'N/A')}")
            print(f"   Stale metrics: {len(fresh_data.get('stale_metrics', []))}")

    def test_day_scenario_selector(self):
        """Test day scenario selector feature - NEW FEATURE"""
        print("\n=== Testing Day Scenario Selector Feature ===")
        
        # Test available days endpoint
        success, days_data = self.run_test("Get Available Days", "GET", "demo/available-days", 200)
        if success and days_data:
            days = days_data.get('days', [])
            print(f"   Available days count: {len(days)}")
            expected_days = [1, 18, 35, 55, 70, 90, 105]
            actual_days = [d['day'] for d in days]
            print(f"   Expected days: {expected_days}")
            print(f"   Actual days: {actual_days}")
            
            # Verify all expected days are present
            missing_days = set(expected_days) - set(actual_days)
            if missing_days:
                print(f"   ❌ Missing days: {missing_days}")
            else:
                print(f"   ✅ All expected days present")
        
        # Test switching to different day scenarios
        test_days = [1, 70, 90, 105]  # Test key scenarios
        for day in test_days:
            success, day_data = self.run_test(
                f"Set Day {day} Scenario", 
                "POST", 
                "demo/set-day",
                200,
                {"day": day}
            )
            if success and day_data:
                print(f"   Day {day} - Current day: {day_data.get('current_day', 'N/A')}")
                print(f"   Day {day} - Description: {day_data.get('description', 'N/A')}")
                print(f"   Day {day} - Actions count: {day_data.get('actions_count', 'N/A')}")
                
                # Verify day-specific characteristics
                if day == 1:
                    # Day 1 should have low risks, 0 actions
                    expected_actions = 0
                    if day_data.get('actions_count', 0) == expected_actions:
                        print(f"   ✅ Day 1: Correct low action count ({expected_actions})")
                    else:
                        print(f"   ❌ Day 1: Expected {expected_actions} actions, got {day_data.get('actions_count', 0)}")
                
                elif day == 70:
                    # Day 70 should have high risks, multiple actions
                    if day_data.get('actions_count', 0) >= 5:
                        print(f"   ✅ Day 70: High action count as expected")
                    else:
                        print(f"   ❌ Day 70: Expected high action count, got {day_data.get('actions_count', 0)}")
                
                elif day == 90:
                    # Day 90 should have high risks, multiple active actions
                    if day_data.get('actions_count', 0) >= 5:
                        print(f"   ✅ Day 90: High action count as expected")
                    else:
                        print(f"   ❌ Day 90: Expected high action count, got {day_data.get('actions_count', 0)}")
        
        # Test actions with impact data after setting to a high-risk day
        print(f"\n   Testing action impact data on Day 70...")
        self.run_test("Set Day 70 for Impact Test", "POST", "demo/set-day", 200, {"day": 70})
        
        success, actions_data = self.run_test("Get Actions with Impact", "GET", "actions", 200)
        if success and actions_data:
            actions = actions_data.get('actions', [])
            if actions:
                action = actions[0]
                impact = action.get('impact', {})
                print(f"   Action ID: {action.get('id', 'N/A')}")
                print(f"   Urgency: {impact.get('urgency', 'N/A')}")
                print(f"   Risk reduction 7d: {impact.get('risk_reduction', {}).get('7_day', 'N/A')}%")
                print(f"   Risk reduction 14d: {impact.get('risk_reduction', {}).get('14_day', 'N/A')}%")
                print(f"   Risk reduction 30d: {impact.get('risk_reduction', {}).get('30_day', 'N/A')}%")
                print(f"   Productivity impact: {impact.get('productivity_impact', 'N/A')[:50]}...")
                print(f"   Run length impact: {impact.get('run_length_impact', 'N/A')[:50]}...")
                
                # Verify impact data structure
                if impact.get('risk_reduction') and impact.get('urgency'):
                    print(f"   ✅ Action impact data structure correct")
                else:
                    print(f"   ❌ Action impact data missing or incomplete")
            else:
                print(f"   ⚠️  No actions found for impact testing")

    def test_demo_controls(self):
        """Test demo control endpoints"""
        print("\n=== Testing Demo Controls ===")
        
        # Advance time
        success, advance_data = self.run_test("Demo Advance Time", "POST", "demo/advance-time", 200)
        if success and advance_data:
            print(f"   New day: {advance_data.get('new_day', 'N/A')}")
        
        # Inject events
        event_types = ["cw_spike", "inhibitor_interruption", "dimer_rise", "dp_increase"]
        for event_type in event_types:
            self.run_test(
                f"Inject {event_type}", 
                "POST", 
                "demo/inject-event",
                200,
                {"event_type": event_type, "duration_steps": 2}
            )
        
        # Resolve action
        self.run_test("Demo Resolve Action", "POST", "demo/resolve-action", 200)
        
        # Pause/Resume
        self.run_test("Demo Pause", "POST", "demo/pause", 200)
        self.run_test("Demo Resume", "POST", "demo/resume", 200)
        
        # Reset (test last to avoid disrupting other tests)
        self.run_test("Demo Reset", "POST", "demo/reset", 200)

    def test_error_cases(self):
        """Test error handling"""
        print("\n=== Testing Error Cases ===")
        
        # Non-existent action
        self.run_test("Non-existent Action", "POST", "actions/INVALID-ID/status", 404, {"status": "Done"})
        
        # Invalid endpoint
        self.run_test("Invalid Endpoint", "GET", "invalid-endpoint", 404)

def main():
    print("🚀 Starting KR AA Run Health OS API Tests")
    print("=" * 50)
    
    tester = KRAARunHealthAPITester()
    
    # Run all test suites
    tester.test_basic_endpoints()
    tester.test_day_scenario_selector()  # NEW: Test day scenario selector feature
    tester.test_metrics_and_projections()
    tester.test_actions_workflow()
    tester.test_timeline_and_comparison()
    tester.test_data_freshness()
    tester.test_demo_controls()
    tester.test_error_cases()
    
    # Print summary
    print("\n" + "=" * 50)
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