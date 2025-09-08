#!/usr/bin/env node

/**
 * Simple Test Runner for Optipenn CRM
 * ===================================
 * 
 * A simplified version of the comprehensive test suite that can run 
 * with basic Node.js without additional dependencies.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if we have the required dependencies
function checkDependencies() {
    try {
        require.resolve('playwright');
        return 'playwright';
    } catch (e) {
        try {
            require.resolve('puppeteer');
            return 'puppeteer';
        } catch (e) {
            return null;
        }
    }
}

async function startApp() {
    console.log('🚀 Starting Optipenn CRM in demo mode...');
    
    // Check if app is already running
    try {
        const response = await fetch('http://localhost:5000/api/health');
        if (response.ok) {
            console.log('✅ Application is already running');
            return null;
        }
    } catch (e) {
        // App not running, start it
    }
    
    console.log('📝 Note: Please start the application manually with:');
    console.log('   npm run demo');
    console.log('   Then run this test again.');
    
    throw new Error('Application not running. Please start it first.');
}

async function runBasicTests() {
    console.log('\n🧪 Running basic functionality tests...\n');
    
    const tests = [
        { name: 'Health Check', url: 'http://localhost:5000/api/health' },
        { name: 'Frontend Load', url: 'http://localhost:5000/' },
        { name: 'Login Page', url: 'http://localhost:5000/login' },
        { name: 'Clients Page', url: 'http://localhost:5000/clients' },
        { name: 'Quotes Page', url: 'http://localhost:5000/quotes' },
        { name: 'Statistics Page', url: 'http://localhost:5000/statistics' }
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            const startTime = Date.now();
            const response = await fetch(test.url);
            const loadTime = Date.now() - startTime;
            
            const status = response.ok ? '✅ PASS' : '❌ FAIL';
            const result = `${status} - ${test.name} (${loadTime}ms) - Status: ${response.status}`;
            
            console.log(result);
            results.push({
                name: test.name,
                passed: response.ok,
                loadTime,
                status: response.status
            });
            
        } catch (error) {
            console.log(`❌ FAIL - ${test.name} - Error: ${error.message}`);
            results.push({
                name: test.name,
                passed: false,
                error: error.message
            });
        }
    }
    
    return results;
}

function generateSimpleReport(results) {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const avgLoadTime = results
        .filter(r => r.loadTime)
        .reduce((sum, r) => sum + r.loadTime, 0) / results.filter(r => r.loadTime).length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);
    console.log(`Average Load Time: ${Math.round(avgLoadTime)}ms`);
    
    if (avgLoadTime > 2000) {
        console.log('\n⚠️  WARNING: Some pages are loading slowly (>2s)');
        console.log('   Consider optimizing for better user experience');
    }
    
    if (passed === total) {
        console.log('\n🎉 All basic tests passed! Your application is functional.');
        console.log('\n💡 For comprehensive testing including UX analysis, install dependencies:');
        console.log('   npm install playwright');
        console.log('   npm run test:e2e');
    } else {
        console.log('\n🔧 Some tests failed. Check the application setup and try again.');
    }
    
    return passed === total ? 0 : 1;
}

async function main() {
    console.log('🏢 Optipenn CRM - Basic Test Suite');
    console.log('==================================\n');
    
    const browserEngine = checkDependencies();
    
    if (!browserEngine) {
        console.log('📝 Note: Running basic functionality tests only');
        console.log('   For full UI testing, install: npm install playwright\n');
    } else {
        console.log(`🌐 Browser engine available: ${browserEngine}`);
        console.log('   For full UI testing, run: npm run test:e2e\n');
    }
    
    let serverProcess = null;
    
    try {
        serverProcess = await startApp();
        const results = await runBasicTests();
        const exitCode = generateSimpleReport(results);
        
        if (serverProcess) {
            console.log('\n🛑 Stopping server...');
            serverProcess.kill();
        }
        
        process.exit(exitCode);
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        
        if (serverProcess) {
            serverProcess.kill();
        }
        
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Test interrupted by user');
    process.exit(1);
});

if (require.main === module) {
    main();
}

module.exports = { main, runBasicTests, generateSimpleReport };