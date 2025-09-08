#!/usr/bin/env python3
"""
Comprehensive Automated Test Script for Optipenn CRM
====================================================

This script provides comprehensive automated testing for the Optipenn CRM application,
focusing on B2B enterprise UX requirements with visual testing, error detection,
and detailed reporting.

Features:
- Full application lifecycle testing (launch → interactions → cleanup)
- Browser automation with Selenium WebDriver
- Visual testing with screenshots and analysis
- Performance monitoring and error detection
- Responsive design testing
- Accessibility validation
- B2B enterprise UX focus
- Detailed HTML report generation

Requirements:
- Python 3.8+
- selenium
- pillow (for image processing)
- requests (for API testing)
- psutil (for performance monitoring)

Usage:
    python test_optipenn_app.py [--module MODULE_NAME]
    
Example:
    python test_optipenn_app.py                    # Run all tests
    python test_optipenn_app.py --module login     # Run only login tests
    python test_optipenn_app.py --module dashboard # Run only dashboard tests
"""

import argparse
import base64
import json
import logging
import os
import subprocess
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import urllib.parse

try:
    import requests
    import psutil
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:
    print(f"Error: Missing required dependencies. Please install:")
    print("pip install selenium pillow requests psutil")
    print(f"Specific error: {e}")
    sys.exit(1)

# Configuration
class Config:
    """Test configuration settings"""
    APP_URL = "http://localhost:5000"
    DEMO_MODE = True
    SCREENSHOT_DIR = Path("test_screenshots")
    REPORT_DIR = Path("test_reports")
    TIMEOUT = 10
    LONG_TIMEOUT = 30
    SERVER_STARTUP_TIMEOUT = 60
    
    # Test credentials (demo mode)
    DEMO_EMAIL = "admin@example.com"
    DEMO_PASSWORD = "Admin1234"
    
    # UX Testing criteria
    MIN_LOAD_TIME = 2.0  # seconds
    MOBILE_WIDTH = 375
    TABLET_WIDTH = 768
    DESKTOP_WIDTH = 1920

class TestResult:
    """Container for test results"""
    def __init__(self, name: str, passed: bool = False, error: str = "", 
                 screenshot: str = "", performance: Dict = None, ux_score: int = 0):
        self.name = name
        self.passed = passed
        self.error = error
        self.screenshot = screenshot
        self.performance = performance or {}
        self.ux_score = ux_score
        self.timestamp = datetime.now()

class UXAnalyzer:
    """Analyzes UX aspects of screenshots and page elements"""
    
    @staticmethod
    def analyze_visual_layout(driver, screenshot_path: str) -> Dict[str, Any]:
        """Analyze visual layout and design quality"""
        try:
            # Get page dimensions and viewport
            viewport_size = driver.execute_script("return {width: window.innerWidth, height: window.innerHeight}")
            
            # Check for common UI elements
            ui_elements = {
                'navigation': len(driver.find_elements(By.CSS_SELECTOR, "nav, .sidebar, [role='navigation']")),
                'buttons': len(driver.find_elements(By.CSS_SELECTOR, "button, .btn, input[type='submit']")),
                'forms': len(driver.find_elements(By.CSS_SELECTOR, "form, .form")),
                'tables': len(driver.find_elements(By.CSS_SELECTOR, "table, .table")),
                'cards': len(driver.find_elements(By.CSS_SELECTOR, ".card, .panel, .widget")),
                'modals': len(driver.find_elements(By.CSS_SELECTOR, ".modal, .dialog, [role='dialog']"))
            }
            
            # Check for responsive design indicators
            responsive_elements = len(driver.find_elements(By.CSS_SELECTOR, 
                "[class*='responsive'], [class*='mobile'], [class*='tablet'], [class*='desktop']"))
            
            # Check color scheme (professional/enterprise)
            body_bg = driver.execute_script("return getComputedStyle(document.body).backgroundColor")
            
            analysis = {
                'viewport': viewport_size,
                'ui_elements': ui_elements,
                'responsive_elements': responsive_elements,
                'background_color': body_bg,
                'total_elements': sum(ui_elements.values()),
                'layout_score': min(10, max(1, sum(ui_elements.values()) // 2))
            }
            
            return analysis
            
        except Exception as e:
            return {'error': str(e), 'layout_score': 1}
    
    @staticmethod
    def check_accessibility(driver) -> Dict[str, Any]:
        """Check basic accessibility features"""
        try:
            # Check for accessibility attributes
            aria_elements = len(driver.find_elements(By.CSS_SELECTOR, "[aria-label], [aria-describedby], [role]"))
            alt_images = len(driver.find_elements(By.CSS_SELECTOR, "img[alt]"))
            total_images = len(driver.find_elements(By.CSS_SELECTOR, "img"))
            
            # Check form labels
            labeled_inputs = len(driver.find_elements(By.CSS_SELECTOR, "label input, input[aria-label]"))
            total_inputs = len(driver.find_elements(By.CSS_SELECTOR, "input, select, textarea"))
            
            # Check heading structure
            headings = len(driver.find_elements(By.CSS_SELECTOR, "h1, h2, h3, h4, h5, h6"))
            
            accessibility_score = 0
            if total_images > 0:
                accessibility_score += (alt_images / total_images) * 3
            if total_inputs > 0:
                accessibility_score += (labeled_inputs / total_inputs) * 3
            if aria_elements > 0:
                accessibility_score += min(4, aria_elements / 5)
                
            return {
                'aria_elements': aria_elements,
                'images_with_alt': f"{alt_images}/{total_images}",
                'labeled_inputs': f"{labeled_inputs}/{total_inputs}",
                'headings': headings,
                'accessibility_score': round(accessibility_score, 1)
            }
            
        except Exception as e:
            return {'error': str(e), 'accessibility_score': 0}

class OptipennTester:
    """Main test orchestrator for Optipenn CRM"""
    
    def __init__(self):
        self.driver = None
        self.server_process = None
        self.test_results: List[TestResult] = []
        self.start_time = datetime.now()
        self.user_data_dir = None
        self.setup_directories()
        self.setup_logging()
        
    def setup_directories(self):
        """Create necessary directories for test artifacts"""
        Config.SCREENSHOT_DIR.mkdir(exist_ok=True)
        Config.REPORT_DIR.mkdir(exist_ok=True)
        
    def setup_logging(self):
        """Configure logging for the test session"""
        log_file = Config.REPORT_DIR / f"test_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def start_application(self) -> bool:
        """Start the Optipenn application in demo mode"""
        try:
            self.logger.info("Starting Optipenn application in demo mode...")
            
            # Check if app is already running
            try:
                response = requests.get(f"{Config.APP_URL}/api/health", timeout=5)
                if response.status_code == 200:
                    self.logger.info("Application is already running")
                    return True
            except requests.exceptions.RequestException:
                pass
            
            # Start the application
            cmd = ["npm", "run", "demo"]
            self.server_process = subprocess.Popen(
                cmd,
                cwd=Path.cwd(),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Wait for server to start
            self.logger.info("Waiting for server to start...")
            for attempt in range(Config.SERVER_STARTUP_TIMEOUT):
                try:
                    response = requests.get(f"{Config.APP_URL}/api/health", timeout=2)
                    if response.status_code == 200:
                        self.logger.info(f"Server started successfully after {attempt + 1} seconds")
                        time.sleep(2)  # Additional wait for full startup
                        return True
                except requests.exceptions.RequestException:
                    time.sleep(1)
                    
            self.logger.error("Server failed to start within timeout period")
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to start application: {e}")
            return False
    
    def setup_browser(self) -> bool:
        """Initialize the Chrome WebDriver with optimal settings"""
        try:
            chrome_options = Options()
            chrome_options.add_argument('--headless')  # Use headless mode for CI/testing
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            
            # Create unique user data directory to avoid conflicts
            user_data_dir = Path(__file__).parent / 'browser_data' / f'session_{int(time.time() * 1000)}'
            user_data_dir.mkdir(parents=True, exist_ok=True)
            chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
            
            # Enterprise-focused settings
            chrome_options.add_argument('--disable-web-security')
            chrome_options.add_argument('--allow-running-insecure-content')
            chrome_options.add_experimental_option('useAutomationExtension', False)
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            
            # Store user data dir for cleanup
            self.user_data_dir = user_data_dir
            
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.implicitly_wait(Config.TIMEOUT)
            
            self.logger.info("Browser initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to setup browser: {e}")
            return False
    
    def take_screenshot(self, name: str, description: str = "") -> str:
        """Take a screenshot and return the file path"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{name}.png"
            filepath = Config.SCREENSHOT_DIR / filename
            
            self.driver.save_screenshot(str(filepath))
            
            # Log visual analysis
            visual_analysis = UXAnalyzer.analyze_visual_layout(self.driver, str(filepath))
            accessibility_analysis = UXAnalyzer.check_accessibility(self.driver)
            
            self.logger.info(f"Screenshot taken: {filename}")
            self.logger.info(f"Visual check: Layout score: {visual_analysis.get('layout_score', 'N/A')}/10")
            self.logger.info(f"Accessibility score: {accessibility_analysis.get('accessibility_score', 'N/A')}/10")
            if description:
                self.logger.info(f"Description: {description}")
                
            return str(filepath)
            
        except Exception as e:
            self.logger.error(f"Failed to take screenshot: {e}")
            return ""
    
    def wait_for_element(self, by: By, selector: str, timeout: int = None) -> Optional[Any]:
        """Wait for an element to be present and return it"""
        try:
            wait = WebDriverWait(self.driver, timeout or Config.TIMEOUT)
            return wait.until(EC.presence_of_element_located((by, selector)))
        except TimeoutException:
            return None
    
    def wait_for_clickable(self, by: By, selector: str, timeout: int = None) -> Optional[Any]:
        """Wait for an element to be clickable and return it"""
        try:
            wait = WebDriverWait(self.driver, timeout or Config.TIMEOUT)
            return wait.until(EC.element_to_be_clickable((by, selector)))
        except TimeoutException:
            return None
    
    def measure_page_load_time(self, url: str) -> float:
        """Measure page load time"""
        start_time = time.time()
        self.driver.get(url)
        
        # Wait for page to be fully loaded
        WebDriverWait(self.driver, Config.LONG_TIMEOUT).until(
            lambda driver: driver.execute_script("return document.readyState") == "complete"
        )
        
        end_time = time.time()
        return end_time - start_time
    
    def check_console_errors(self) -> List[str]:
        """Check for JavaScript console errors"""
        try:
            logs = self.driver.get_log('browser')
            errors = [log['message'] for log in logs if log['level'] == 'SEVERE']
            return errors
        except Exception:
            return []
    
    def test_login_flow(self) -> TestResult:
        """Test the complete login flow"""
        test_name = "Login Flow"
        self.logger.info(f"Starting {test_name}")
        
        try:
            # Navigate to login page
            load_time = self.measure_page_load_time(f"{Config.APP_URL}/login")
            screenshot = self.take_screenshot("01_login_page", "Initial login page load")
            
            # Check for login form elements
            email_field = self.wait_for_element(By.NAME, "email")
            password_field = self.wait_for_element(By.NAME, "password")
            
            if not email_field or not password_field:
                return TestResult(test_name, False, "Login form elements not found", screenshot)
            
            # Fill in credentials
            email_field.clear()
            email_field.send_keys(Config.DEMO_EMAIL)
            
            password_field.clear()
            password_field.send_keys(Config.DEMO_PASSWORD)
            
            screenshot = self.take_screenshot("02_login_filled", "Login form filled with credentials")
            
            # Submit form
            login_button = self.wait_for_clickable(By.CSS_SELECTOR, "button[type='submit'], .login-button, input[type='submit']")
            if not login_button:
                return TestResult(test_name, False, "Login button not found", screenshot)
            
            login_button.click()
            
            # Wait for redirect to dashboard
            WebDriverWait(self.driver, Config.LONG_TIMEOUT).until(
                lambda driver: "/login" not in driver.current_url
            )
            
            screenshot = self.take_screenshot("03_login_success", "Successful login - redirected to dashboard")
            
            # Check for console errors
            console_errors = self.check_console_errors()
            
            # Performance analysis
            performance = {
                'load_time': round(load_time, 2),
                'console_errors': len(console_errors),
                'final_url': self.driver.current_url
            }
            
            # UX Score calculation
            ux_score = 10
            if load_time > Config.MIN_LOAD_TIME:
                ux_score -= 2
            if console_errors:
                ux_score -= len(console_errors)
            ux_score = max(1, ux_score)
            
            self.logger.info(f"Login successful. Load time: {load_time:.2f}s, UX Score: {ux_score}/10")
            
            return TestResult(test_name, True, "", screenshot, performance, ux_score)
            
        except Exception as e:
            error_screenshot = self.take_screenshot("error_login", f"Login test failed: {str(e)}")
            self.logger.error(f"Login test failed: {e}")
            return TestResult(test_name, False, str(e), error_screenshot)
    
    def test_dashboard(self) -> TestResult:
        """Test dashboard functionality and UI"""
        test_name = "Dashboard"
        self.logger.info(f"Starting {test_name}")
        
        try:
            # Navigate to dashboard if not already there
            if self.driver.current_url != f"{Config.APP_URL}/":
                load_time = self.measure_page_load_time(f"{Config.APP_URL}/")
            else:
                load_time = 0
            
            screenshot = self.take_screenshot("04_dashboard_main", "Main dashboard view")
            
            # Check for key dashboard elements
            dashboard_elements = {
                'title': self.wait_for_element(By.CSS_SELECTOR, "h1, h2, .dashboard-title"),
                'stats_cards': self.driver.find_elements(By.CSS_SELECTOR, ".card, .widget, .stat-card"),
                'navigation': self.wait_for_element(By.CSS_SELECTOR, "nav, .sidebar, .navigation"),
                'content_area': self.wait_for_element(By.CSS_SELECTOR, "main, .main-content, .dashboard-content")
            }
            
            missing_elements = [key for key, element in dashboard_elements.items() if not element]
            
            # Test responsive design
            original_size = self.driver.get_window_size()
            
            # Mobile view
            self.driver.set_window_size(Config.MOBILE_WIDTH, 800)
            time.sleep(1)
            mobile_screenshot = self.take_screenshot("05_dashboard_mobile", "Dashboard in mobile view")
            
            # Tablet view
            self.driver.set_window_size(Config.TABLET_WIDTH, 1024)
            time.sleep(1)
            tablet_screenshot = self.take_screenshot("06_dashboard_tablet", "Dashboard in tablet view")
            
            # Restore original size
            self.driver.set_window_size(original_size['width'], original_size['height'])
            time.sleep(1)
            
            # Check for data loading
            data_elements = self.driver.find_elements(By.CSS_SELECTOR, 
                ".chart, .graph, .table, .data-table, .statistics")
            
            # Performance analysis
            console_errors = self.check_console_errors()
            performance = {
                'load_time': round(load_time, 2),
                'stats_cards_count': len(dashboard_elements.get('stats_cards', [])),
                'data_elements_count': len(data_elements),
                'console_errors': len(console_errors),
                'missing_elements': missing_elements
            }
            
            # UX Score
            ux_score = 8
            if missing_elements:
                ux_score -= len(missing_elements)
            if len(data_elements) == 0:
                ux_score -= 2
            if console_errors:
                ux_score -= len(console_errors)
            ux_score = max(1, ux_score)
            
            success = len(missing_elements) == 0
            error_msg = f"Missing dashboard elements: {missing_elements}" if missing_elements else ""
            
            self.logger.info(f"Dashboard test completed. UX Score: {ux_score}/10")
            
            return TestResult(test_name, success, error_msg, screenshot, performance, ux_score)
            
        except Exception as e:
            error_screenshot = self.take_screenshot("error_dashboard", f"Dashboard test failed: {str(e)}")
            self.logger.error(f"Dashboard test failed: {e}")
            return TestResult(test_name, False, str(e), error_screenshot)
    
    def test_clients_management(self) -> TestResult:
        """Test clients page and management features"""
        test_name = "Clients Management"
        self.logger.info(f"Starting {test_name}")
        
        try:
            # Navigate to clients page
            load_time = self.measure_page_load_time(f"{Config.APP_URL}/clients")
            screenshot = self.take_screenshot("07_clients_main", "Clients page main view")
            
            # Check for clients table/list
            clients_table = self.wait_for_element(By.CSS_SELECTOR, "table, .table, .clients-list")
            if not clients_table:
                return TestResult(test_name, False, "Clients table not found", screenshot)
            
            # Look for action buttons (Edit, View, Delete)
            edit_buttons = self.driver.find_elements(By.CSS_SELECTOR, 
                "[data-testid*='edit'], .edit-button, button[title*='Edit'], button[title*='Modifier']")
            view_buttons = self.driver.find_elements(By.CSS_SELECTOR, 
                "[data-testid*='view'], .view-button, button[title*='View'], button[title*='Voir']")
            
            # Test search functionality if available
            search_box = self.driver.find_element(By.CSS_SELECTOR, 
                "input[type='search'], input[placeholder*='search'], input[placeholder*='recherche']") if self.driver.find_elements(By.CSS_SELECTOR, 
                "input[type='search'], input[placeholder*='search'], input[placeholder*='recherche']") else None
            
            if search_box:
                search_box.send_keys("test")
                time.sleep(1)
                search_screenshot = self.take_screenshot("08_clients_search", "Clients search functionality")
                search_box.clear()
            
            # Test creating new client (look for Add/Create button)
            add_button = self.driver.find_element(By.CSS_SELECTOR, 
                ".add-client, .new-client, button[title*='Add'], button[title*='Ajouter']") if self.driver.find_elements(By.CSS_SELECTOR, 
                ".add-client, .new-client, button[title*='Add'], button[title*='Ajouter']") else None
            
            if add_button:
                add_button.click()
                time.sleep(2)
                modal_screenshot = self.take_screenshot("09_clients_add_modal", "Add client modal/form")
                
                # Close modal if opened
                close_button = self.driver.find_element(By.CSS_SELECTOR, 
                    ".close, .cancel, [aria-label*='close'], [aria-label*='fermer']") if self.driver.find_elements(By.CSS_SELECTOR, 
                    ".close, .cancel, [aria-label*='close'], [aria-label*='fermer']") else None
                if close_button:
                    close_button.click()
                    time.sleep(1)
            
            # Test bulk operations if available
            checkboxes = self.driver.find_elements(By.CSS_SELECTOR, "input[type='checkbox']")
            if len(checkboxes) > 1:  # At least one client checkbox plus potential select-all
                checkboxes[1].click()  # Select first client
                time.sleep(1)
                bulk_screenshot = self.take_screenshot("10_clients_bulk_select", "Bulk operations selection")
            
            # Performance analysis
            console_errors = self.check_console_errors()
            performance = {
                'load_time': round(load_time, 2),
                'edit_buttons_count': len(edit_buttons),
                'view_buttons_count': len(view_buttons),
                'has_search': search_box is not None,
                'has_add_button': add_button is not None,
                'console_errors': len(console_errors)
            }
            
            # UX Score
            ux_score = 7
            if len(edit_buttons) == 0:
                ux_score -= 2
            if not search_box:
                ux_score -= 1
            if not add_button:
                ux_score -= 1
            if console_errors:
                ux_score -= len(console_errors)
            ux_score = max(1, ux_score)
            
            self.logger.info(f"Clients management test completed. UX Score: {ux_score}/10")
            
            return TestResult(test_name, True, "", screenshot, performance, ux_score)
            
        except Exception as e:
            error_screenshot = self.take_screenshot("error_clients", f"Clients test failed: {str(e)}")
            self.logger.error(f"Clients test failed: {e}")
            return TestResult(test_name, False, str(e), error_screenshot)
    
    def test_quotes_functionality(self) -> TestResult:
        """Test quotes/devis page and functionality"""
        test_name = "Quotes Functionality"
        self.logger.info(f"Starting {test_name}")
        
        try:
            # Navigate to quotes page
            load_time = self.measure_page_load_time(f"{Config.APP_URL}/quotes")
            screenshot = self.take_screenshot("11_quotes_main", "Quotes page main view")
            
            # Check for quotes table/list
            quotes_element = self.wait_for_element(By.CSS_SELECTOR, "table, .table, .quotes-list")
            if not quotes_element:
                return TestResult(test_name, False, "Quotes table/list not found", screenshot)
            
            # Look for quote-specific actions
            quote_actions = self.driver.find_elements(By.CSS_SELECTOR, 
                "button, .action, .btn") 
            
            # Test filters if available
            filter_elements = self.driver.find_elements(By.CSS_SELECTOR, 
                "select, .filter, input[type='date']")
            
            if filter_elements:
                filter_screenshot = self.take_screenshot("12_quotes_filters", "Quotes filtering options")
            
            # Test export functionality if available
            export_button = self.driver.find_element(By.CSS_SELECTOR, 
                ".export, button[title*='Export'], button[title*='Exporter']") if self.driver.find_elements(By.CSS_SELECTOR, 
                ".export, button[title*='Export'], button[title*='Exporter']") else None
            
            if export_button:
                export_button.click()
                time.sleep(2)
                export_screenshot = self.take_screenshot("13_quotes_export", "Export functionality")
            
            # Performance analysis
            console_errors = self.check_console_errors()
            performance = {
                'load_time': round(load_time, 2),
                'quote_actions_count': len(quote_actions),
                'filter_elements_count': len(filter_elements),
                'has_export': export_button is not None,
                'console_errors': len(console_errors)
            }
            
            # UX Score
            ux_score = 8
            if len(quote_actions) == 0:
                ux_score -= 2
            if len(filter_elements) == 0:
                ux_score -= 1
            if console_errors:
                ux_score -= len(console_errors)
            ux_score = max(1, ux_score)
            
            self.logger.info(f"Quotes functionality test completed. UX Score: {ux_score}/10")
            
            return TestResult(test_name, True, "", screenshot, performance, ux_score)
            
        except Exception as e:
            error_screenshot = self.take_screenshot("error_quotes", f"Quotes test failed: {str(e)}")
            self.logger.error(f"Quotes test failed: {e}")
            return TestResult(test_name, False, str(e), error_screenshot)
    
    def test_statistics_analytics(self) -> TestResult:
        """Test statistics/analytics page"""
        test_name = "Statistics & Analytics"
        self.logger.info(f"Starting {test_name}")
        
        try:
            # Navigate to statistics page
            load_time = self.measure_page_load_time(f"{Config.APP_URL}/statistics")
            screenshot = self.take_screenshot("14_statistics_main", "Statistics page main view")
            
            # Check for charts and analytics
            charts = self.driver.find_elements(By.CSS_SELECTOR, 
                "canvas, .chart, .graph, svg")
            
            # Check for KPI cards/metrics
            kpi_elements = self.driver.find_elements(By.CSS_SELECTOR, 
                ".kpi, .metric, .stat-card, .card")
            
            # Test date range picker if available
            date_inputs = self.driver.find_elements(By.CSS_SELECTOR, 
                "input[type='date'], .date-picker")
            
            if date_inputs:
                date_screenshot = self.take_screenshot("15_statistics_date_filter", "Date filtering for statistics")
            
            # Test export of reports if available
            export_buttons = self.driver.find_elements(By.CSS_SELECTOR, 
                ".export-report, button[title*='Export'], button[title*='Download']")
            
            # Performance analysis
            console_errors = self.check_console_errors()
            performance = {
                'load_time': round(load_time, 2),
                'charts_count': len(charts),
                'kpi_elements_count': len(kpi_elements),
                'date_filters_count': len(date_inputs),
                'export_buttons_count': len(export_buttons),
                'console_errors': len(console_errors)
            }
            
            # UX Score
            ux_score = 6
            if len(charts) > 0:
                ux_score += 2
            if len(kpi_elements) > 0:
                ux_score += 1
            if len(date_inputs) > 0:
                ux_score += 1
            if console_errors:
                ux_score -= len(console_errors)
            ux_score = max(1, min(10, ux_score))
            
            success = len(charts) > 0 or len(kpi_elements) > 0
            error_msg = "No charts or KPI elements found" if not success else ""
            
            self.logger.info(f"Statistics test completed. UX Score: {ux_score}/10")
            
            return TestResult(test_name, success, error_msg, screenshot, performance, ux_score)
            
        except Exception as e:
            error_screenshot = self.take_screenshot("error_statistics", f"Statistics test failed: {str(e)}")
            self.logger.error(f"Statistics test failed: {e}")
            return TestResult(test_name, False, str(e), error_screenshot)
    
    def test_error_handling(self) -> TestResult:
        """Test application error handling"""
        test_name = "Error Handling"
        self.logger.info(f"Starting {test_name}")
        
        try:
            # Test 404 page
            self.driver.get(f"{Config.APP_URL}/nonexistent-page")
            time.sleep(2)
            error_404_screenshot = self.take_screenshot("16_error_404", "404 error page handling")
            
            # Check if proper error page is shown
            error_elements = self.driver.find_elements(By.CSS_SELECTOR, 
                ".error, .not-found, h1, h2")
            
            has_error_page = any("404" in elem.text or "not found" in elem.text.lower() 
                               for elem in error_elements if elem.text)
            
            # Test network error simulation (invalid API call)
            self.driver.execute_script("""
                fetch('/api/invalid-endpoint')
                .catch(err => console.error('Expected network error:', err));
            """)
            time.sleep(2)
            
            # Check console for error handling
            console_errors = self.check_console_errors()
            
            # Performance analysis
            performance = {
                'has_error_page': has_error_page,
                'console_errors': len(console_errors),
                'error_elements_count': len(error_elements)
            }
            
            # UX Score
            ux_score = 5
            if has_error_page:
                ux_score += 3
            if len(error_elements) > 0:
                ux_score += 2
            ux_score = max(1, min(10, ux_score))
            
            self.logger.info(f"Error handling test completed. UX Score: {ux_score}/10")
            
            return TestResult(test_name, True, "", error_404_screenshot, performance, ux_score)
            
        except Exception as e:
            error_screenshot = self.take_screenshot("error_error_handling", f"Error handling test failed: {str(e)}")
            self.logger.error(f"Error handling test failed: {e}")
            return TestResult(test_name, False, str(e), error_screenshot)
    
    def test_navigation_ux(self) -> TestResult:
        """Test overall navigation and UX flow"""
        test_name = "Navigation & UX Flow"
        self.logger.info(f"Starting {test_name}")
        
        try:
            # Go back to dashboard
            self.driver.get(f"{Config.APP_URL}/")
            time.sleep(2)
            
            # Test navigation between all main sections
            navigation_flows = [
                ("/clients", "Navigation to Clients"),
                ("/quotes", "Navigation to Quotes"), 
                ("/statistics", "Navigation to Statistics"),
                ("/", "Navigation back to Dashboard")
            ]
            
            nav_times = []
            for url, description in navigation_flows:
                start_time = time.time()
                self.driver.get(f"{Config.APP_URL}{url}")
                WebDriverWait(self.driver, Config.TIMEOUT).until(
                    lambda driver: driver.execute_script("return document.readyState") == "complete"
                )
                nav_time = time.time() - start_time
                nav_times.append(nav_time)
                
                screenshot = self.take_screenshot(f"17_nav_{url.replace('/', '_')}", description)
            
            # Test breadcrumbs or navigation indicators
            nav_elements = self.driver.find_elements(By.CSS_SELECTOR, 
                "nav, .breadcrumb, .navigation, .navbar")
            
            # Test global search if available
            search_elements = self.driver.find_elements(By.CSS_SELECTOR, 
                "[data-tour='global-search'], .global-search, input[placeholder*='Search']")
            
            # Performance analysis
            avg_nav_time = sum(nav_times) / len(nav_times) if nav_times else 0
            console_errors = self.check_console_errors()
            
            performance = {
                'avg_navigation_time': round(avg_nav_time, 2),
                'navigation_elements_count': len(nav_elements),
                'global_search_available': len(search_elements) > 0,
                'console_errors': len(console_errors)
            }
            
            # UX Score
            ux_score = 7
            if avg_nav_time < 1.0:
                ux_score += 2
            elif avg_nav_time > 3.0:
                ux_score -= 2
            if len(nav_elements) > 0:
                ux_score += 1
            if len(search_elements) > 0:
                ux_score += 1
            if console_errors:
                ux_score -= len(console_errors)
            ux_score = max(1, min(10, ux_score))
            
            self.logger.info(f"Navigation UX test completed. Average nav time: {avg_nav_time:.2f}s, UX Score: {ux_score}/10")
            
            return TestResult(test_name, True, "", screenshot, performance, ux_score)
            
        except Exception as e:
            error_screenshot = self.take_screenshot("error_navigation", f"Navigation test failed: {str(e)}")
            self.logger.error(f"Navigation test failed: {e}")
            return TestResult(test_name, False, str(e), error_screenshot)
    
    def run_all_tests(self) -> List[TestResult]:
        """Run all test modules"""
        self.logger.info("Starting comprehensive test suite for Optipenn CRM")
        
        if not self.start_application():
            return [TestResult("Application Startup", False, "Failed to start application")]
        
        if not self.setup_browser():
            return [TestResult("Browser Setup", False, "Failed to setup browser")]
        
        try:
            # Run all test modules
            test_modules = [
                self.test_login_flow,
                self.test_dashboard,
                self.test_clients_management,
                self.test_quotes_functionality,
                self.test_statistics_analytics,
                self.test_error_handling,
                self.test_navigation_ux
            ]
            
            for test_module in test_modules:
                try:
                    result = test_module()
                    self.test_results.append(result)
                except Exception as e:
                    self.logger.error(f"Test module {test_module.__name__} failed: {e}")
                    self.test_results.append(TestResult(
                        test_module.__name__, False, str(e), 
                        self.take_screenshot(f"error_{test_module.__name__}", f"Module {test_module.__name__} crashed")
                    ))
            
            return self.test_results
            
        finally:
            self.cleanup()
    
    def run_specific_test(self, module_name: str) -> List[TestResult]:
        """Run a specific test module"""
        module_map = {
            'login': self.test_login_flow,
            'dashboard': self.test_dashboard,
            'clients': self.test_clients_management,
            'quotes': self.test_quotes_functionality,
            'statistics': self.test_statistics_analytics,
            'error': self.test_error_handling,
            'navigation': self.test_navigation_ux
        }
        
        if module_name not in module_map:
            self.logger.error(f"Unknown test module: {module_name}")
            return [TestResult("Invalid Module", False, f"Module '{module_name}' not found")]
        
        self.logger.info(f"Running specific test module: {module_name}")
        
        if not self.start_application():
            return [TestResult("Application Startup", False, "Failed to start application")]
        
        if not self.setup_browser():
            return [TestResult("Browser Setup", False, "Failed to setup browser")]
        
        try:
            result = module_map[module_name]()
            self.test_results.append(result)
            return self.test_results
            
        except Exception as e:
            self.logger.error(f"Specific test {module_name} failed: {e}")
            return [TestResult(module_name, False, str(e))]
        
        finally:
            self.cleanup()
    
    def generate_html_report(self) -> str:
        """Generate comprehensive HTML report"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result.passed)
        failed_tests = total_tests - passed_tests
        avg_ux_score = sum(result.ux_score for result in self.test_results) / total_tests if total_tests > 0 else 0
        
        total_duration = (datetime.now() - self.start_time).total_seconds()
        
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Optipenn CRM - Automated Test Report</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }}
        .header p {{
            margin: 10px 0 0 0;
            opacity: 0.9;
        }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }}
        .summary-card {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .summary-card h3 {{
            margin: 0 0 10px 0;
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        .summary-card .value {{
            font-size: 2em;
            font-weight: bold;
            margin: 0;
        }}
        .passed {{ color: #28a745; }}
        .failed {{ color: #dc3545; }}
        .ux-score {{ color: #17a2b8; }}
        .duration {{ color: #6f42c1; }}
        .test-results {{
            padding: 30px;
        }}
        .test-result {{
            margin-bottom: 30px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            overflow: hidden;
        }}
        .test-result.passed {{
            border-left: 4px solid #28a745;
        }}
        .test-result.failed {{
            border-left: 4px solid #dc3545;
        }}
        .test-header {{
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }}
        .test-header h3 {{
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }}
        .test-status {{
            font-size: 0.8em;
            padding: 4px 12px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
        }}
        .test-status.passed {{
            background: #28a745;
        }}
        .test-status.failed {{
            background: #dc3545;
        }}
        .test-content {{
            padding: 20px;
        }}
        .test-details {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }}
        .test-info {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
        }}
        .test-info h4 {{
            margin: 0 0 10px 0;
            color: #666;
            font-size: 0.9em;
        }}
        .screenshot {{
            text-align: center;
            margin-top: 20px;
        }}
        .screenshot img {{
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            border: 1px solid #e9ecef;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .error-message {{
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
            border: 1px solid #f5c6cb;
        }}
        .performance-metrics {{
            background: #e1f5fe;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
        }}
        .performance-metrics h4 {{
            margin: 0 0 10px 0;
            color: #01579b;
        }}
        .metric {{
            margin: 5px 0;
        }}
        .recommendations {{
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 20px;
            margin: 30px;
            border-radius: 8px;
        }}
        .recommendations h3 {{
            margin: 0 0 15px 0;
            color: #856404;
        }}
        .rec-list {{
            list-style-type: none;
            padding: 0;
        }}
        .rec-list li {{
            padding: 8px 0;
            border-bottom: 1px solid #ffeaa7;
        }}
        .rec-list li:last-child {{
            border-bottom: none;
        }}
        .footer {{
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            color: #666;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Optipenn CRM - Test Report</h1>
            <p>Comprehensive Automated Testing Results</p>
            <p>Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <p class="value">{total_tests}</p>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <p class="value passed">{passed_tests}</p>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <p class="value failed">{failed_tests}</p>
            </div>
            <div class="summary-card">
                <h3>Avg UX Score</h3>
                <p class="value ux-score">{avg_ux_score:.1f}/10</p>
            </div>
            <div class="summary-card">
                <h3>Duration</h3>
                <p class="value duration">{total_duration:.1f}s</p>
            </div>
        </div>
        
        <div class="test-results">
            <h2>Test Results Details</h2>
        """
        
        for result in self.test_results:
            status_class = "passed" if result.passed else "failed"
            status_text = "PASSED" if result.passed else "FAILED"
            
            # Convert screenshot path to base64 for embedding
            screenshot_html = ""
            if result.screenshot and os.path.exists(result.screenshot):
                try:
                    with open(result.screenshot, "rb") as img_file:
                        img_data = base64.b64encode(img_file.read()).decode()
                        screenshot_html = f"""
                        <div class="screenshot">
                            <h4>Screenshot</h4>
                            <img src="data:image/png;base64,{img_data}" alt="Test Screenshot">
                        </div>
                        """
                except Exception as e:
                    screenshot_html = f"<p>Screenshot error: {e}</p>"
            
            # Performance metrics HTML
            perf_html = ""
            if result.performance:
                metrics_html = ""
                for key, value in result.performance.items():
                    metrics_html += f'<div class="metric"><strong>{key.replace("_", " ").title()}:</strong> {value}</div>'
                
                perf_html = f"""
                <div class="performance-metrics">
                    <h4>Performance Metrics</h4>
                    {metrics_html}
                </div>
                """
            
            # Error message HTML
            error_html = ""
            if result.error:
                error_html = f"""
                <div class="error-message">
                    <strong>Error:</strong> {result.error}
                </div>
                """
            
            html_content += f"""
            <div class="test-result {status_class}">
                <div class="test-header">
                    <h3>
                        {result.name}
                        <span class="test-status {status_class}">{status_text}</span>
                    </h3>
                </div>
                <div class="test-content">
                    <div class="test-details">
                        <div class="test-info">
                            <h4>Test Information</h4>
                            <div class="metric"><strong>Timestamp:</strong> {result.timestamp.strftime('%H:%M:%S')}</div>
                            <div class="metric"><strong>UX Score:</strong> {result.ux_score}/10</div>
                            <div class="metric"><strong>Status:</strong> {status_text}</div>
                        </div>
                        <div class="test-info">
                            <h4>Assessment</h4>
                            <div class="metric"><strong>Visual Appeal:</strong> {'Good' if result.ux_score >= 7 else 'Needs Improvement' if result.ux_score >= 4 else 'Poor'}</div>
                            <div class="metric"><strong>Functionality:</strong> {'Working' if result.passed else 'Issues Found'}</div>
                            <div class="metric"><strong>B2B Ready:</strong> {'Yes' if result.ux_score >= 6 and result.passed else 'Needs Work'}</div>
                        </div>
                    </div>
                    {error_html}
                    {perf_html}
                    {screenshot_html}
                </div>
            </div>
            """
        
        # Generate recommendations
        recommendations = []
        
        if avg_ux_score < 7:
            recommendations.append("Improve overall UX design - current average score is below enterprise standards")
        
        if failed_tests > 0:
            recommendations.append(f"Fix {failed_tests} failing test(s) to ensure application stability")
        
        # Performance-based recommendations
        slow_tests = [r for r in self.test_results if r.performance.get('load_time', 0) > Config.MIN_LOAD_TIME]
        if slow_tests:
            recommendations.append(f"Optimize page load times - {len(slow_tests)} pages are loading slower than {Config.MIN_LOAD_TIME}s")
        
        # Console error recommendations
        console_error_tests = [r for r in self.test_results if r.performance.get('console_errors', 0) > 0]
        if console_error_tests:
            recommendations.append(f"Fix JavaScript console errors found in {len(console_error_tests)} test(s)")
        
        if avg_ux_score >= 8 and failed_tests == 0:
            recommendations.append("Excellent! Consider adding dark mode for premium professional appearance")
            recommendations.append("Add more interactive elements and micro-animations for enhanced UX")
        
        rec_html = ""
        if recommendations:
            rec_items = "".join([f"<li>{rec}</li>" for rec in recommendations])
            rec_html = f"""
            <div class="recommendations">
                <h3>UX Recommendations for Enterprise Users</h3>
                <ul class="rec-list">
                    {rec_items}
                </ul>
            </div>
            """
        
        html_content += f"""
        </div>
        
        {rec_html}
        
        <div class="footer">
            <p>Report generated by Optipenn CRM Automated Test Suite</p>
            <p>For technical support and UX improvements, review the detailed logs and screenshots above</p>
        </div>
    </div>
</body>
</html>
        """
        
        # Save report
        report_file = Config.REPORT_DIR / f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        self.logger.info(f"HTML report generated: {report_file}")
        return str(report_file)
    
    def cleanup(self):
        """Clean up resources"""
        try:
            if self.driver:
                self.driver.quit()
                self.logger.info("Browser closed")
            
            # Cleanup browser data directory
            if self.user_data_dir and self.user_data_dir.exists():
                try:
                    import shutil
                    shutil.rmtree(self.user_data_dir)
                    self.logger.info("Browser data directory cleaned up")
                except Exception as e:
                    self.logger.warn(f"Could not cleanup browser data directory: {e}")
            
            if self.server_process:
                self.server_process.terminate()
                try:
                    self.server_process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    self.server_process.kill()
                self.logger.info("Server process terminated")
                
        except Exception as e:
            self.logger.error(f"Cleanup error: {e}")

def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(
        description="Comprehensive Automated Test Suite for Optipenn CRM",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test_optipenn_app.py                    # Run all tests
  python test_optipenn_app.py --module login     # Test only login functionality
  python test_optipenn_app.py --module dashboard # Test only dashboard
  python test_optipenn_app.py --module clients   # Test only clients management
  python test_optipenn_app.py --module quotes    # Test only quotes functionality
  python test_optipenn_app.py --module statistics # Test only statistics/analytics
  python test_optipenn_app.py --module navigation # Test only navigation UX
  python test_optipenn_app.py --module error     # Test only error handling
        """
    )
    
    parser.add_argument(
        '--module', 
        type=str, 
        help='Run specific test module (login, dashboard, clients, quotes, statistics, navigation, error)',
        choices=['login', 'dashboard', 'clients', 'quotes', 'statistics', 'navigation', 'error']
    )
    
    args = parser.parse_args()
    
    print("🚀 Optipenn CRM - Comprehensive Automated Test Suite")
    print("=" * 60)
    print("Testing B2B Enterprise UX, Functionality, and Performance")
    print()
    
    tester = OptipennTester()
    
    try:
        if args.module:
            print(f"Running specific test module: {args.module}")
            results = tester.run_specific_test(args.module)
        else:
            print("Running complete test suite...")
            results = tester.run_all_tests()
        
        # Generate and save report
        report_file = tester.generate_html_report()
        
        # Print summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r.passed)
        failed_tests = total_tests - passed_tests
        avg_ux_score = sum(r.ux_score for r in results) / total_tests if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Average UX Score: {avg_ux_score:.1f}/10")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        print("\nDETAILED RESULTS:")
        for result in results:
            status = "✅ PASSED" if result.passed else "❌ FAILED"
            print(f"  {status} - {result.name} (UX: {result.ux_score}/10)")
            if result.error:
                print(f"    Error: {result.error}")
        
        print(f"\n📄 Detailed HTML report: {report_file}")
        print(f"📸 Screenshots saved in: {Config.SCREENSHOT_DIR}")
        print(f"📋 Logs saved in: {Config.REPORT_DIR}")
        
        # Overall assessment
        if passed_tests == total_tests and avg_ux_score >= 8:
            print("\n🎉 EXCELLENT! Your application is ready for enterprise use!")
        elif passed_tests == total_tests and avg_ux_score >= 6:
            print("\n✅ GOOD! Your application is functional with room for UX improvements.")
        elif failed_tests == 0:
            print("\n⚠️  FUNCTIONAL but UX needs improvement for enterprise users.")
        else:
            print("\n🔧 NEEDS WORK! Address failing tests and improve UX for enterprise readiness.")
        
        return 0 if failed_tests == 0 else 1
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        return 1
    except Exception as e:
        print(f"\nFatal error: {e}")
        traceback.print_exc()
        return 1
    finally:
        tester.cleanup()

if __name__ == "__main__":
    sys.exit(main())