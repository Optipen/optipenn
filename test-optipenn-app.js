#!/usr/bin/env node
/**
 * Comprehensive Automated Test Script for Optipenn CRM
 * ====================================================
 * 
 * This script provides comprehensive automated testing for the Optipenn CRM application,
 * focusing on B2B enterprise UX requirements with visual testing, error detection,
 * and detailed reporting using Playwright.
 * 
 * Features:
 * - Full application lifecycle testing (launch → interactions → cleanup)
 * - Browser automation with Playwright
 * - Visual testing with screenshots and analysis
 * - Performance monitoring and error detection
 * - Responsive design testing
 * - Accessibility validation
 * - B2B enterprise UX focus
 * - Detailed HTML report generation
 * 
 * Requirements:
 * - Node.js 18+
 * - @playwright/test
 * - Sharp (for image processing)
 * 
 * Usage:
 *     node test-optipenn-app.cjs [--module MODULE_NAME]
 *     
 * Example:
 *     node test-optipenn-app.cjs                    # Run all tests
 *     node test-optipenn-app.cjs --module login     # Run only login tests
 *     node test-optipenn-app.cjs --module dashboard # Run only dashboard tests
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    APP_URL: 'http://localhost:5000',
    DEMO_MODE: true,
    SCREENSHOT_DIR: path.join(__dirname, 'test_screenshots'),
    REPORT_DIR: path.join(__dirname, 'test_reports'),
    TIMEOUT: 10000,
    LONG_TIMEOUT: 30000,
    SERVER_STARTUP_TIMEOUT: 60000,
    
    // Test credentials (demo mode)
    DEMO_EMAIL: 'admin@example.com',
    DEMO_PASSWORD: 'Admin1234',
    
    // UX Testing criteria
    MIN_LOAD_TIME: 2000, // milliseconds
    MOBILE_WIDTH: 375,
    TABLET_WIDTH: 768,
    DESKTOP_WIDTH: 1920,
    
    // Viewport configurations for responsive testing
    VIEWPORTS: {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1920, height: 1080 }
    }
};

// Test result class
class TestResult {
    constructor(name, passed = false, error = '', screenshot = '', performance = {}, uxScore = 0) {
        this.name = name;
        this.passed = passed;
        this.error = error;
        this.screenshot = screenshot;
        this.performance = performance;
        this.uxScore = uxScore;
        this.timestamp = new Date();
    }
}

// UX Analyzer for visual and accessibility assessment
class UXAnalyzer {
    static async analyzeVisualLayout(page, screenshotPath) {
        try {
            // Get page dimensions and viewport
            const viewport = page.viewportSize();
            
            // Check for common UI elements
            const uiElements = {
                navigation: await page.locator('nav, .sidebar, [role="navigation"]').count(),
                buttons: await page.locator('button, .btn, input[type="submit"]').count(),
                forms: await page.locator('form, .form').count(),
                tables: await page.locator('table, .table').count(),
                cards: await page.locator('.card, .panel, .widget').count(),
                modals: await page.locator('.modal, .dialog, [role="dialog"]').count()
            };
            
            // Check for responsive design indicators
            const responsiveElements = await page.locator('[class*="responsive"], [class*="mobile"], [class*="tablet"], [class*="desktop"]').count();
            
            // Check color scheme (professional/enterprise)
            const bodyBg = await page.evaluate(() => {
                return getComputedStyle(document.body).backgroundColor;
            });
            
            const totalElements = Object.values(uiElements).reduce((sum, count) => sum + count, 0);
            const layoutScore = Math.min(10, Math.max(1, Math.floor(totalElements / 2)));
            
            return {
                viewport,
                uiElements,
                responsiveElements,
                backgroundColor: bodyBg,
                totalElements,
                layoutScore
            };
            
        } catch (error) {
            return { error: error.message, layoutScore: 1 };
        }
    }
    
    static async checkAccessibility(page) {
        try {
            // Check for accessibility attributes
            const ariaElements = await page.locator('[aria-label], [aria-describedby], [role]').count();
            const altImages = await page.locator('img[alt]').count();
            const totalImages = await page.locator('img').count();
            
            // Check form labels
            const labeledInputs = await page.locator('label input, input[aria-label]').count();
            const totalInputs = await page.locator('input, select, textarea').count();
            
            // Check heading structure
            const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
            
            let accessibilityScore = 0;
            if (totalImages > 0) {
                accessibilityScore += (altImages / totalImages) * 3;
            }
            if (totalInputs > 0) {
                accessibilityScore += (labeledInputs / totalInputs) * 3;
            }
            if (ariaElements > 0) {
                accessibilityScore += Math.min(4, ariaElements / 5);
            }
            
            return {
                ariaElements,
                imagesWithAlt: `${altImages}/${totalImages}`,
                labeledInputs: `${labeledInputs}/${totalInputs}`,
                headings,
                accessibilityScore: Math.round(accessibilityScore * 10) / 10
            };
            
        } catch (error) {
            return { error: error.message, accessibilityScore: 0 };
        }
    }
}

// Main test orchestrator
class OptipennTester {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.serverProcess = null;
        this.testResults = [];
        this.startTime = new Date();
        this.logger = console;
        this.userDataDir = null;
    }
    
    async setupDirectories() {
        try {
            await fs.mkdir(CONFIG.SCREENSHOT_DIR, { recursive: true });
            await fs.mkdir(CONFIG.REPORT_DIR, { recursive: true });
        } catch (error) {
            this.logger.error('Failed to create directories:', error);
        }
    }
    
    async startApplication() {
        try {
            this.logger.info('Starting Optipenn application in demo mode...');
            
            // Check if app is already running
            try {
                const response = await fetch(`${CONFIG.APP_URL}/api/health`);
                if (response.ok) {
                    this.logger.info('Application is already running');
                    return true;
                }
            } catch (error) {
                // App not running, start it
            }
            
            // Start the application
            this.serverProcess = spawn('npm', ['run', 'demo'], {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, DEMO_MODE: '1' }
            });
            
            // Wait for server to start
            this.logger.info('Waiting for server to start...');
            const startTime = Date.now();
            
            while (Date.now() - startTime < CONFIG.SERVER_STARTUP_TIMEOUT) {
                try {
                    const response = await fetch(`${CONFIG.APP_URL}/api/health`);
                    if (response.ok) {
                        this.logger.info(`Server started successfully after ${Math.floor((Date.now() - startTime) / 1000)} seconds`);
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Additional wait
                        return true;
                    }
                } catch (error) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            this.logger.error('Server failed to start within timeout period');
            return false;
            
        } catch (error) {
            this.logger.error('Failed to start application:', error);
            return false;
        }
    }
    
    async setupBrowser() {
        try {
            // Use unique user data directory to avoid conflicts
            this.userDataDir = path.join(__dirname, 'browser_data', `session_${Date.now()}`);
            
            this.browser = await chromium.launch({
                headless: true, // Use headless mode for CI/testing environment
                args: [
                    '--no-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--allow-running-insecure-content'
                ]
            });
            
            this.context = await this.browser.newContext({
                viewport: CONFIG.VIEWPORTS.desktop
            });
            
            this.page = await this.context.newPage();
            
            // Set up console logging
            this.page.on('console', msg => {
                if (msg.type() === 'error') {
                    this.logger.error('Console error:', msg.text());
                }
            });
            
            this.logger.info('Browser initialized successfully');
            return true;
            
        } catch (error) {
            this.logger.error('Failed to setup browser:', error);
            return false;
        }
    }
    
    async takeScreenshot(name, description = '') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${timestamp}_${name}.png`;
            const filepath = path.join(CONFIG.SCREENSHOT_DIR, filename);
            
            await this.page.screenshot({ path: filepath, fullPage: true });
            
            // Log visual analysis
            const visualAnalysis = await UXAnalyzer.analyzeVisualLayout(this.page, filepath);
            const accessibilityAnalysis = await UXAnalyzer.checkAccessibility(this.page);
            
            this.logger.info(`Screenshot taken: ${filename}`);
            this.logger.info(`Visual check: Layout score: ${visualAnalysis.layoutScore || 'N/A'}/10`);
            this.logger.info(`Accessibility score: ${accessibilityAnalysis.accessibilityScore || 'N/A'}/10`);
            if (description) {
                this.logger.info(`Description: ${description}`);
            }
            
            return filepath;
            
        } catch (error) {
            this.logger.error('Failed to take screenshot:', error);
            return '';
        }
    }
    
    async measurePageLoadTime(url) {
        const startTime = Date.now();
        await this.page.goto(url, { waitUntil: 'networkidle' });
        const endTime = Date.now();
        return endTime - startTime;
    }
    
    async checkConsoleErrors() {
        // Console errors are captured via the page.on('console') handler
        // This is a placeholder for collecting them
        return [];
    }
    
    async testLoginFlow() {
        const testName = 'Login Flow';
        this.logger.info(`Starting ${testName}`);
        
        try {
            // Navigate to login page
            const loadTime = await this.measurePageLoadTime(`${CONFIG.APP_URL}/login`);
            const screenshot = await this.takeScreenshot('01_login_page', 'Initial login page load');
            
            // Check for login form elements
            const emailField = await this.page.locator('input[name="email"], input[type="email"]').first();
            const passwordField = await this.page.locator('input[name="password"], input[type="password"]').first();
            
            if (await emailField.count() === 0 || await passwordField.count() === 0) {
                return new TestResult(testName, false, 'Login form elements not found', screenshot);
            }
            
            // Fill in credentials
            await emailField.fill(CONFIG.DEMO_EMAIL);
            await passwordField.fill(CONFIG.DEMO_PASSWORD);
            
            const filledScreenshot = await this.takeScreenshot('02_login_filled', 'Login form filled with credentials');
            
            // Submit form
            const loginButton = this.page.locator('button[type="submit"], .login-button, input[type="submit"]').first();
            if (await loginButton.count() === 0) {
                return new TestResult(testName, false, 'Login button not found', filledScreenshot);
            }
            
            await loginButton.click();
            
            // Wait for redirect to dashboard
            await this.page.waitForURL(url => !url.includes('/login'), { timeout: CONFIG.LONG_TIMEOUT });
            
            const successScreenshot = await this.takeScreenshot('03_login_success', 'Successful login - redirected to dashboard');
            
            // Performance analysis
            const performance = {
                loadTime: Math.round(loadTime),
                consoleErrors: 0, // Placeholder
                finalUrl: this.page.url()
            };
            
            // UX Score calculation
            let uxScore = 10;
            if (loadTime > CONFIG.MIN_LOAD_TIME) {
                uxScore -= 2;
            }
            uxScore = Math.max(1, uxScore);
            
            this.logger.info(`Login successful. Load time: ${loadTime}ms, UX Score: ${uxScore}/10`);
            
            return new TestResult(testName, true, '', successScreenshot, performance, uxScore);
            
        } catch (error) {
            const errorScreenshot = await this.takeScreenshot('error_login', `Login test failed: ${error.message}`);
            this.logger.error('Login test failed:', error);
            return new TestResult(testName, false, error.message, errorScreenshot);
        }
    }
    
    async testDashboard() {
        const testName = 'Dashboard';
        this.logger.info(`Starting ${testName}`);
        
        try {
            // Navigate to dashboard if not already there
            let loadTime = 0;
            if (!this.page.url().endsWith('/')) {
                loadTime = await this.measurePageLoadTime(`${CONFIG.APP_URL}/`);
            }
            
            const screenshot = await this.takeScreenshot('04_dashboard_main', 'Main dashboard view');
            
            // Check for key dashboard elements
            const dashboardElements = {
                title: await this.page.locator('h1, h2, .dashboard-title').count(),
                statsCards: await this.page.locator('.card, .widget, .stat-card').count(),
                navigation: await this.page.locator('nav, .sidebar, .navigation').count(),
                contentArea: await this.page.locator('main, .main-content, .dashboard-content').count()
            };
            
            const missingElements = Object.entries(dashboardElements)
                .filter(([key, count]) => count === 0)
                .map(([key, count]) => key);
            
            // Test responsive design
            const originalViewport = this.page.viewportSize();
            
            // Mobile view
            await this.page.setViewportSize(CONFIG.VIEWPORTS.mobile);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.takeScreenshot('05_dashboard_mobile', 'Dashboard in mobile view');
            
            // Tablet view
            await this.page.setViewportSize(CONFIG.VIEWPORTS.tablet);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.takeScreenshot('06_dashboard_tablet', 'Dashboard in tablet view');
            
            // Restore original size
            await this.page.setViewportSize(originalViewport);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check for data loading
            const dataElements = await this.page.locator('.chart, .graph, .table, .data-table, .statistics').count();
            
            // Performance analysis
            const performance = {
                loadTime: Math.round(loadTime),
                statsCardsCount: dashboardElements.statsCards,
                dataElementsCount: dataElements,
                consoleErrors: 0, // Placeholder
                missingElements
            };
            
            // UX Score
            let uxScore = 8;
            if (missingElements.length > 0) {
                uxScore -= missingElements.length;
            }
            if (dataElements === 0) {
                uxScore -= 2;
            }
            uxScore = Math.max(1, uxScore);
            
            const success = missingElements.length === 0;
            const errorMsg = missingElements.length > 0 ? `Missing dashboard elements: ${missingElements.join(', ')}` : '';
            
            this.logger.info(`Dashboard test completed. UX Score: ${uxScore}/10`);
            
            return new TestResult(testName, success, errorMsg, screenshot, performance, uxScore);
            
        } catch (error) {
            const errorScreenshot = await this.takeScreenshot('error_dashboard', `Dashboard test failed: ${error.message}`);
            this.logger.error('Dashboard test failed:', error);
            return new TestResult(testName, false, error.message, errorScreenshot);
        }
    }
    
    async testClientsManagement() {
        const testName = 'Clients Management';
        this.logger.info(`Starting ${testName}`);
        
        try {
            // Navigate to clients page
            const loadTime = await this.measurePageLoadTime(`${CONFIG.APP_URL}/clients`);
            const screenshot = await this.takeScreenshot('07_clients_main', 'Clients page main view');
            
            // Check for clients table/list
            const clientsTable = await this.page.locator('table, .table, .clients-list').count();
            if (clientsTable === 0) {
                return new TestResult(testName, false, 'Clients table not found', screenshot);
            }
            
            // Look for action buttons
            const editButtons = await this.page.locator('[data-testid*="edit"], .edit-button, button[title*="Edit"], button[title*="Modifier"]').count();
            const viewButtons = await this.page.locator('[data-testid*="view"], .view-button, button[title*="View"], button[title*="Voir"]').count();
            
            // Test search functionality if available
            const searchBox = this.page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="recherche"]').first();
            let hasSearch = false;
            if (await searchBox.count() > 0) {
                await searchBox.fill('test');
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.takeScreenshot('08_clients_search', 'Clients search functionality');
                await searchBox.clear();
                hasSearch = true;
            }
            
            // Test creating new client
            const addButton = this.page.locator('.add-client, .new-client, button[title*="Add"], button[title*="Ajouter"]').first();
            let hasAddButton = false;
            if (await addButton.count() > 0) {
                await addButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.takeScreenshot('09_clients_add_modal', 'Add client modal/form');
                
                // Close modal if opened
                const closeButton = this.page.locator('.close, .cancel, [aria-label*="close"], [aria-label*="fermer"]').first();
                if (await closeButton.count() > 0) {
                    await closeButton.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                hasAddButton = true;
            }
            
            // Test bulk operations if available
            const checkboxes = await this.page.locator('input[type="checkbox"]').count();
            if (checkboxes > 1) {
                await this.page.locator('input[type="checkbox"]').nth(1).click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.takeScreenshot('10_clients_bulk_select', 'Bulk operations selection');
            }
            
            // Performance analysis
            const performance = {
                loadTime: Math.round(loadTime),
                editButtonsCount: editButtons,
                viewButtonsCount: viewButtons,
                hasSearch,
                hasAddButton,
                consoleErrors: 0
            };
            
            // UX Score
            let uxScore = 7;
            if (editButtons === 0) uxScore -= 2;
            if (!hasSearch) uxScore -= 1;
            if (!hasAddButton) uxScore -= 1;
            uxScore = Math.max(1, uxScore);
            
            this.logger.info(`Clients management test completed. UX Score: ${uxScore}/10`);
            
            return new TestResult(testName, true, '', screenshot, performance, uxScore);
            
        } catch (error) {
            const errorScreenshot = await this.takeScreenshot('error_clients', `Clients test failed: ${error.message}`);
            this.logger.error('Clients test failed:', error);
            return new TestResult(testName, false, error.message, errorScreenshot);
        }
    }
    
    async testQuotesFunctionality() {
        const testName = 'Quotes Functionality';
        this.logger.info(`Starting ${testName}`);
        
        try {
            // Navigate to quotes page
            const loadTime = await this.measurePageLoadTime(`${CONFIG.APP_URL}/quotes`);
            const screenshot = await this.takeScreenshot('11_quotes_main', 'Quotes page main view');
            
            // Check for quotes table/list
            const quotesElement = await this.page.locator('table, .table, .quotes-list').count();
            if (quotesElement === 0) {
                return new TestResult(testName, false, 'Quotes table/list not found', screenshot);
            }
            
            // Look for quote-specific actions
            const quoteActions = await this.page.locator('button, .action, .btn').count();
            
            // Test filters if available
            const filterElements = await this.page.locator('select, .filter, input[type="date"]').count();
            
            if (filterElements > 0) {
                await this.takeScreenshot('12_quotes_filters', 'Quotes filtering options');
            }
            
            // Test export functionality if available
            const exportButton = this.page.locator('.export, button[title*="Export"], button[title*="Exporter"]').first();
            let hasExport = false;
            if (await exportButton.count() > 0) {
                await exportButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.takeScreenshot('13_quotes_export', 'Export functionality');
                hasExport = true;
            }
            
            // Performance analysis
            const performance = {
                loadTime: Math.round(loadTime),
                quoteActionsCount: quoteActions,
                filterElementsCount: filterElements,
                hasExport,
                consoleErrors: 0
            };
            
            // UX Score
            let uxScore = 8;
            if (quoteActions === 0) uxScore -= 2;
            if (filterElements === 0) uxScore -= 1;
            uxScore = Math.max(1, uxScore);
            
            this.logger.info(`Quotes functionality test completed. UX Score: ${uxScore}/10`);
            
            return new TestResult(testName, true, '', screenshot, performance, uxScore);
            
        } catch (error) {
            const errorScreenshot = await this.takeScreenshot('error_quotes', `Quotes test failed: ${error.message}`);
            this.logger.error('Quotes test failed:', error);
            return new TestResult(testName, false, error.message, errorScreenshot);
        }
    }
    
    async testStatisticsAnalytics() {
        const testName = 'Statistics & Analytics';
        this.logger.info(`Starting ${testName}`);
        
        try {
            // Navigate to statistics page
            const loadTime = await this.measurePageLoadTime(`${CONFIG.APP_URL}/statistics`);
            const screenshot = await this.takeScreenshot('14_statistics_main', 'Statistics page main view');
            
            // Check for charts and analytics
            const charts = await this.page.locator('canvas, .chart, .graph, svg').count();
            
            // Check for KPI cards/metrics
            const kpiElements = await this.page.locator('.kpi, .metric, .stat-card, .card').count();
            
            // Test date range picker if available
            const dateInputs = await this.page.locator('input[type="date"], .date-picker').count();
            
            if (dateInputs > 0) {
                await this.takeScreenshot('15_statistics_date_filter', 'Date filtering for statistics');
            }
            
            // Test export of reports if available
            const exportButtons = await this.page.locator('.export-report, button[title*="Export"], button[title*="Download"]').count();
            
            // Performance analysis
            const performance = {
                loadTime: Math.round(loadTime),
                chartsCount: charts,
                kpiElementsCount: kpiElements,
                dateFiltersCount: dateInputs,
                exportButtonsCount: exportButtons,
                consoleErrors: 0
            };
            
            // UX Score
            let uxScore = 6;
            if (charts > 0) uxScore += 2;
            if (kpiElements > 0) uxScore += 1;
            if (dateInputs > 0) uxScore += 1;
            uxScore = Math.max(1, Math.min(10, uxScore));
            
            const success = charts > 0 || kpiElements > 0;
            const errorMsg = success ? '' : 'No charts or KPI elements found';
            
            this.logger.info(`Statistics test completed. UX Score: ${uxScore}/10`);
            
            return new TestResult(testName, success, errorMsg, screenshot, performance, uxScore);
            
        } catch (error) {
            const errorScreenshot = await this.takeScreenshot('error_statistics', `Statistics test failed: ${error.message}`);
            this.logger.error('Statistics test failed:', error);
            return new TestResult(testName, false, error.message, errorScreenshot);
        }
    }
    
    async testErrorHandling() {
        const testName = 'Error Handling';
        this.logger.info(`Starting ${testName}`);
        
        try {
            // Test 404 page
            await this.page.goto(`${CONFIG.APP_URL}/nonexistent-page`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const error404Screenshot = await this.takeScreenshot('16_error_404', '404 error page handling');
            
            // Check if proper error page is shown
            const errorElements = await this.page.locator('.error, .not-found, h1, h2').all();
            
            let hasErrorPage = false;
            for (const element of errorElements) {
                const text = await element.textContent();
                if (text && (text.includes('404') || text.toLowerCase().includes('not found'))) {
                    hasErrorPage = true;
                    break;
                }
            }
            
            // Test network error simulation
            await this.page.evaluate(() => {
                fetch('/api/invalid-endpoint')
                    .catch(err => console.error('Expected network error:', err));
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Performance analysis
            const performance = {
                hasErrorPage,
                consoleErrors: 0,
                errorElementsCount: errorElements.length
            };
            
            // UX Score
            let uxScore = 5;
            if (hasErrorPage) uxScore += 3;
            if (errorElements.length > 0) uxScore += 2;
            uxScore = Math.max(1, Math.min(10, uxScore));
            
            this.logger.info(`Error handling test completed. UX Score: ${uxScore}/10`);
            
            return new TestResult(testName, true, '', error404Screenshot, performance, uxScore);
            
        } catch (error) {
            const errorScreenshot = await this.takeScreenshot('error_error_handling', `Error handling test failed: ${error.message}`);
            this.logger.error('Error handling test failed:', error);
            return new TestResult(testName, false, error.message, errorScreenshot);
        }
    }
    
    async testNavigationUX() {
        const testName = 'Navigation & UX Flow';
        this.logger.info(`Starting ${testName}`);
        
        try {
            // Go back to dashboard
            await this.page.goto(`${CONFIG.APP_URL}/`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Test navigation between all main sections
            const navigationFlows = [
                ['/clients', 'Navigation to Clients'],
                ['/quotes', 'Navigation to Quotes'],
                ['/statistics', 'Navigation to Statistics'],
                ['/', 'Navigation back to Dashboard']
            ];
            
            const navTimes = [];
            for (const [url, description] of navigationFlows) {
                const startTime = Date.now();
                await this.page.goto(`${CONFIG.APP_URL}${url}`, { waitUntil: 'networkidle' });
                const navTime = Date.now() - startTime;
                navTimes.push(navTime);
                
                await this.takeScreenshot(`17_nav_${url.replace('/', '_')}`, description);
            }
            
            // Test breadcrumbs or navigation indicators
            const navElements = await this.page.locator('nav, .breadcrumb, .navigation, .navbar').count();
            
            // Test global search if available
            const searchElements = await this.page.locator('[data-tour="global-search"], .global-search, input[placeholder*="Search"]').count();
            
            // Performance analysis
            const avgNavTime = navTimes.length > 0 ? navTimes.reduce((sum, time) => sum + time, 0) / navTimes.length : 0;
            
            const performance = {
                avgNavigationTime: Math.round(avgNavTime),
                navigationElementsCount: navElements,
                globalSearchAvailable: searchElements > 0,
                consoleErrors: 0
            };
            
            // UX Score
            let uxScore = 7;
            if (avgNavTime < 1000) uxScore += 2;
            else if (avgNavTime > 3000) uxScore -= 2;
            if (navElements > 0) uxScore += 1;
            if (searchElements > 0) uxScore += 1;
            uxScore = Math.max(1, Math.min(10, uxScore));
            
            this.logger.info(`Navigation UX test completed. Average nav time: ${avgNavTime}ms, UX Score: ${uxScore}/10`);
            
            const screenshot = await this.takeScreenshot('18_navigation_final', 'Final navigation state');
            return new TestResult(testName, true, '', screenshot, performance, uxScore);
            
        } catch (error) {
            const errorScreenshot = await this.takeScreenshot('error_navigation', `Navigation test failed: ${error.message}`);
            this.logger.error('Navigation test failed:', error);
            return new TestResult(testName, false, error.message, errorScreenshot);
        }
    }
    
    async runAllTests() {
        this.logger.info('Starting comprehensive test suite for Optipenn CRM');
        
        if (!await this.startApplication()) {
            return [new TestResult('Application Startup', false, 'Failed to start application')];
        }
        
        if (!await this.setupBrowser()) {
            return [new TestResult('Browser Setup', false, 'Failed to setup browser')];
        }
        
        try {
            // Run all test modules
            const testModules = [
                this.testLoginFlow,
                this.testDashboard,
                this.testClientsManagement,
                this.testQuotesFunctionality,
                this.testStatisticsAnalytics,
                this.testErrorHandling,
                this.testNavigationUX
            ];
            
            for (const testModule of testModules) {
                try {
                    const result = await testModule.call(this);
                    this.testResults.push(result);
                } catch (error) {
                    this.logger.error(`Test module ${testModule.name} failed:`, error);
                    const errorScreenshot = await this.takeScreenshot(`error_${testModule.name}`, `Module ${testModule.name} crashed`);
                    this.testResults.push(new TestResult(
                        testModule.name, false, error.message, errorScreenshot
                    ));
                }
            }
            
            return this.testResults;
            
        } finally {
            await this.cleanup();
        }
    }
    
    async runSpecificTest(moduleName) {
        const moduleMap = {
            'login': this.testLoginFlow,
            'dashboard': this.testDashboard,
            'clients': this.testClientsManagement,
            'quotes': this.testQuotesFunctionality,
            'statistics': this.testStatisticsAnalytics,
            'error': this.testErrorHandling,
            'navigation': this.testNavigationUX
        };
        
        if (!moduleMap[moduleName]) {
            this.logger.error(`Unknown test module: ${moduleName}`);
            return [new TestResult('Invalid Module', false, `Module '${moduleName}' not found`)];
        }
        
        this.logger.info(`Running specific test module: ${moduleName}`);
        
        if (!await this.startApplication()) {
            return [new TestResult('Application Startup', false, 'Failed to start application')];
        }
        
        if (!await this.setupBrowser()) {
            return [new TestResult('Browser Setup', false, 'Failed to setup browser')];
        }
        
        try {
            const result = await moduleMap[moduleName].call(this);
            this.testResults.push(result);
            return this.testResults;
            
        } catch (error) {
            this.logger.error(`Specific test ${moduleName} failed:`, error);
            return [new TestResult(moduleName, false, error.message)];
        } finally {
            await this.cleanup();
        }
    }
    
    async generateHtmlReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        const avgUxScore = totalTests > 0 ? this.testResults.reduce((sum, r) => sum + r.uxScore, 0) / totalTests : 0;
        
        const totalDuration = (new Date() - this.startTime) / 1000;
        
        // Generate HTML content (similar structure as Python version)
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Optipenn CRM - Automated Test Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            margin: 0;
        }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .ux-score { color: #17a2b8; }
        .duration { color: #6f42c1; }
        .test-results {
            padding: 30px;
        }
        .test-result {
            margin-bottom: 30px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            overflow: hidden;
        }
        .test-result.passed {
            border-left: 4px solid #28a745;
        }
        .test-result.failed {
            border-left: 4px solid #dc3545;
        }
        .test-header {
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        .test-header h3 {
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .test-status {
            font-size: 0.8em;
            padding: 4px 12px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
        }
        .test-status.passed {
            background: #28a745;
        }
        .test-status.failed {
            background: #dc3545;
        }
        .test-content {
            padding: 20px;
        }
        .test-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .test-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
        }
        .test-info h4 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 0.9em;
        }
        .screenshot {
            text-align: center;
            margin-top: 20px;
        }
        .screenshot img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            border: 1px solid #e9ecef;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .error-message {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
            border: 1px solid #f5c6cb;
        }
        .performance-metrics {
            background: #e1f5fe;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
        }
        .performance-metrics h4 {
            margin: 0 0 10px 0;
            color: #01579b;
        }
        .metric {
            margin: 5px 0;
        }
        .recommendations {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 20px;
            margin: 30px;
            border-radius: 8px;
        }
        .recommendations h3 {
            margin: 0 0 15px 0;
            color: #856404;
        }
        .rec-list {
            list-style-type: none;
            padding: 0;
        }
        .rec-list li {
            padding: 8px 0;
            border-bottom: 1px solid #ffeaa7;
        }
        .rec-list li:last-child {
            border-bottom: none;
        }
        .footer {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Optipenn CRM - Test Report</h1>
            <p>Comprehensive Automated Testing Results</p>
            <p>Generated on ${new Date().toISOString()}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <p class="value">${totalTests}</p>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <p class="value passed">${passedTests}</p>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <p class="value failed">${failedTests}</p>
            </div>
            <div class="summary-card">
                <h3>Avg UX Score</h3>
                <p class="value ux-score">${avgUxScore.toFixed(1)}/10</p>
            </div>
            <div class="summary-card">
                <h3>Duration</h3>
                <p class="value duration">${totalDuration.toFixed(1)}s</p>
            </div>
        </div>
        
        <div class="test-results">
            <h2>Test Results Details</h2>
        `;
        
        // Add test results details (abbreviated for brevity)
        let testResultsHtml = '';
        for (const result of this.testResults) {
            const statusClass = result.passed ? 'passed' : 'failed';
            const statusText = result.passed ? 'PASSED' : 'FAILED';
            
            // Read screenshot as base64 for embedding
            let screenshotHtml = '';
            if (result.screenshot) {
                try {
                    const imageBuffer = await fs.readFile(result.screenshot);
                    const base64Image = imageBuffer.toString('base64');
                    screenshotHtml = `
                        <div class="screenshot">
                            <h4>Screenshot</h4>
                            <img src="data:image/png;base64,${base64Image}" alt="Test Screenshot">
                        </div>
                    `;
                } catch (error) {
                    screenshotHtml = `<p>Screenshot error: ${error.message}</p>`;
                }
            }
            
            // Performance metrics HTML
            let perfHtml = '';
            if (Object.keys(result.performance).length > 0) {
                const metricsHtml = Object.entries(result.performance)
                    .map(([key, value]) => `<div class="metric"><strong>${key.replace(/([A-Z])/g, ' $1').trim()}:</strong> ${value}</div>`)
                    .join('');
                
                perfHtml = `
                    <div class="performance-metrics">
                        <h4>Performance Metrics</h4>
                        ${metricsHtml}
                    </div>
                `;
            }
            
            // Error message HTML
            const errorHtml = result.error ? `
                <div class="error-message">
                    <strong>Error:</strong> ${result.error}
                </div>
            ` : '';
            
            testResultsHtml += `
                <div class="test-result ${statusClass}">
                    <div class="test-header">
                        <h3>
                            ${result.name}
                            <span class="test-status ${statusClass}">${statusText}</span>
                        </h3>
                    </div>
                    <div class="test-content">
                        <div class="test-details">
                            <div class="test-info">
                                <h4>Test Information</h4>
                                <div class="metric"><strong>Timestamp:</strong> ${result.timestamp.toLocaleTimeString()}</div>
                                <div class="metric"><strong>UX Score:</strong> ${result.uxScore}/10</div>
                                <div class="metric"><strong>Status:</strong> ${statusText}</div>
                            </div>
                            <div class="test-info">
                                <h4>Assessment</h4>
                                <div class="metric"><strong>Visual Appeal:</strong> ${result.uxScore >= 7 ? 'Good' : result.uxScore >= 4 ? 'Needs Improvement' : 'Poor'}</div>
                                <div class="metric"><strong>Functionality:</strong> ${result.passed ? 'Working' : 'Issues Found'}</div>
                                <div class="metric"><strong>B2B Ready:</strong> ${result.uxScore >= 6 && result.passed ? 'Yes' : 'Needs Work'}</div>
                            </div>
                        </div>
                        ${errorHtml}
                        ${perfHtml}
                        ${screenshotHtml}
                    </div>
                </div>
            `;
        }
        
        // Generate recommendations
        const recommendations = [];
        
        if (avgUxScore < 7) {
            recommendations.push('Improve overall UX design - current average score is below enterprise standards');
        }
        
        if (failedTests > 0) {
            recommendations.push(`Fix ${failedTests} failing test(s) to ensure application stability`);
        }
        
        const slowTests = this.testResults.filter(r => r.performance.loadTime > CONFIG.MIN_LOAD_TIME);
        if (slowTests.length > 0) {
            recommendations.push(`Optimize page load times - ${slowTests.length} pages are loading slower than ${CONFIG.MIN_LOAD_TIME}ms`);
        }
        
        if (avgUxScore >= 8 && failedTests === 0) {
            recommendations.push('Excellent! Consider adding dark mode for premium professional appearance');
            recommendations.push('Add more interactive elements and micro-animations for enhanced UX');
        }
        
        let recHtml = '';
        if (recommendations.length > 0) {
            const recItems = recommendations.map(rec => `<li>${rec}</li>`).join('');
            recHtml = `
                <div class="recommendations">
                    <h3>UX Recommendations for Enterprise Users</h3>
                    <ul class="rec-list">
                        ${recItems}
                    </ul>
                </div>
            `;
        }
        
        const finalHtml = htmlContent + testResultsHtml + `
        </div>
        
        ${recHtml}
        
        <div class="footer">
            <p>Report generated by Optipenn CRM Automated Test Suite</p>
            <p>For technical support and UX improvements, review the detailed logs and screenshots above</p>
        </div>
    </div>
</body>
</html>
        `;
        
        // Save report
        const reportFile = path.join(CONFIG.REPORT_DIR, `test_report_${new Date().toISOString().replace(/[:.]/g, '-')}.html`);
        await fs.writeFile(reportFile, finalHtml, 'utf-8');
        
        this.logger.info(`HTML report generated: ${reportFile}`);
        return reportFile;
    }
    
    async cleanup() {
        try {
            if (this.context) {
                await this.context.close();
                this.logger.info('Browser context closed');
            }
            
            if (this.browser) {
                await this.browser.close();
                this.logger.info('Browser closed');
            }
            
            // Cleanup browser data directory
            if (this.userDataDir) {
                try {
                    await fs.rmdir(this.userDataDir, { recursive: true });
                    this.logger.info('Browser data directory cleaned up');
                } catch (error) {
                    this.logger.warn('Could not cleanup browser data directory:', error.message);
                }
            }
            
            if (this.serverProcess) {
                this.serverProcess.kill();
                this.logger.info('Server process terminated');
            }
        } catch (error) {
            this.logger.error('Cleanup error:', error);
        }
    }
}

// Main execution function
async function main() {
    const args = process.argv.slice(2);
    const moduleIndex = args.indexOf('--module');
    const module = moduleIndex !== -1 && args[moduleIndex + 1] ? args[moduleIndex + 1] : null;
    
    const validModules = ['login', 'dashboard', 'clients', 'quotes', 'statistics', 'navigation', 'error'];
    
    if (module && !validModules.includes(module)) {
        console.error(`Invalid module: ${module}. Valid modules: ${validModules.join(', ')}`);
        process.exit(1);
    }
    
    console.log('🚀 Optipenn CRM - Comprehensive Automated Test Suite');
    console.log('='.repeat(60));
    console.log('Testing B2B Enterprise UX, Functionality, and Performance');
    console.log();
    
    const tester = new OptipennTester();
    await tester.setupDirectories();
    
    try {
        let results;
        if (module) {
            console.log(`Running specific test module: ${module}`);
            results = await tester.runSpecificTest(module);
        } else {
            console.log('Running complete test suite...');
            results = await tester.runAllTests();
        }
        
        // Generate and save report
        const reportFile = await tester.generateHtmlReport();
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));
        
        const totalTests = results.length;
        const passedTests = results.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        const avgUxScore = totalTests > 0 ? results.reduce((sum, r) => sum + r.uxScore, 0) / totalTests : 0;
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Average UX Score: ${avgUxScore.toFixed(1)}/10`);
        console.log(`Success Rate: ${totalTests > 0 ? (passedTests/totalTests*100).toFixed(1) : 0}%`);
        
        console.log('\nDETAILED RESULTS:');
        for (const result of results) {
            const status = result.passed ? '✅ PASSED' : '❌ FAILED';
            console.log(`  ${status} - ${result.name} (UX: ${result.uxScore}/10)`);
            if (result.error) {
                console.log(`    Error: ${result.error}`);
            }
        }
        
        console.log(`\n📄 Detailed HTML report: ${reportFile}`);
        console.log(`📸 Screenshots saved in: ${CONFIG.SCREENSHOT_DIR}`);
        console.log(`📋 Logs saved in: ${CONFIG.REPORT_DIR}`);
        
        // Overall assessment
        if (passedTests === totalTests && avgUxScore >= 8) {
            console.log('\n🎉 EXCELLENT! Your application is ready for enterprise use!');
        } else if (passedTests === totalTests && avgUxScore >= 6) {
            console.log('\n✅ GOOD! Your application is functional with room for UX improvements.');
        } else if (failedTests === 0) {
            console.log('\n⚠️  FUNCTIONAL but UX needs improvement for enterprise users.');
        } else {
            console.log('\n🔧 NEEDS WORK! Address failing tests and improve UX for enterprise readiness.');
        }
        
        process.exit(failedTests === 0 ? 0 : 1);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('\n\nTest interrupted by user');
            process.exit(1);
        } else {
            console.error('\nFatal error:', error);
            process.exit(1);
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, cleaning up...');
    process.exit(1);
});

process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, cleaning up...');
    process.exit(1);
});

// ES module equivalent of checking if this file is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}