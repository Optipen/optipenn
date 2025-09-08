#!/bin/bash

# Optipenn CRM - Automated Test Suite Launcher
# ===========================================
# This script automatically sets up and runs the comprehensive test suite

set -e

echo "🚀 Optipenn CRM - Automated Test Suite Launcher"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -c2-)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    print_success "Node.js $NODE_VERSION detected"
}

# Check if Python is installed (optional)
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python $PYTHON_VERSION detected (optional Python tests available)"
        return 0
    elif command -v python &> /dev/null; then
        PYTHON_VERSION=$(python --version | cut -d' ' -f2)
        print_success "Python $PYTHON_VERSION detected (optional Python tests available)"
        return 0
    else
        print_warning "Python not found. Only Node.js tests will be available."
        return 1
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    if ! npm install; then
        print_error "Failed to install Node.js dependencies"
        exit 1
    fi
    
    print_success "Node.js dependencies installed"
    
    # Install Playwright browsers
    print_status "Installing Playwright browsers..."
    if ! npx playwright install chromium; then
        print_warning "Failed to install Playwright browsers. You may need to install manually."
    else
        print_success "Playwright browsers installed"
    fi
    
    # Check for Python dependencies if Python is available
    if check_python; then
        if [ -f "requirements.txt" ]; then
            print_status "Installing Python dependencies..."
            if command -v pip3 &> /dev/null; then
                pip3 install -r requirements.txt || print_warning "Failed to install Python dependencies"
            elif command -v pip &> /dev/null; then
                pip install -r requirements.txt || print_warning "Failed to install Python dependencies"
            fi
        fi
    fi
}

# Check if application is running
check_app_running() {
    if curl -s http://localhost:5000/api/health &> /dev/null; then
        print_success "Application is already running on port 5000"
        return 0
    else
        print_status "Application not running, will start in demo mode"
        return 1
    fi
}

# Display usage information
show_usage() {
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --install-only        Only install dependencies, don't run tests"
    echo "  --python              Use Python test suite instead of Node.js"
    echo "  --module MODULE       Run specific test module"
    echo "  --help               Show this help message"
    echo ""
    echo "Available test modules:"
    echo "  login                Test login functionality"
    echo "  dashboard            Test dashboard features"
    echo "  clients              Test client management"
    echo "  quotes               Test quote functionality"
    echo "  statistics           Test analytics and reporting"
    echo "  navigation           Test navigation and UX flow"
    echo "  error                Test error handling"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run all tests (Node.js)"
    echo "  $0 --module dashboard        # Run only dashboard tests"
    echo "  $0 --python                  # Run all tests (Python)"
    echo "  $0 --python --module login   # Run login tests (Python)"
    echo ""
}

# Parse command line arguments
INSTALL_ONLY=false
USE_PYTHON=false
TEST_MODULE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --install-only)
            INSTALL_ONLY=true
            shift
            ;;
        --python)
            USE_PYTHON=true
            shift
            ;;
        --module)
            TEST_MODULE="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_status "Starting Optipenn CRM Test Suite Setup..."
    
    # Check prerequisites
    check_nodejs
    
    # Install dependencies
    install_dependencies
    
    if [ "$INSTALL_ONLY" = true ]; then
        print_success "Dependencies installed successfully!"
        print_status "You can now run tests manually:"
        echo "  Node.js: npm run test:e2e"
        echo "  Python:  python test_optipenn_app.py"
        exit 0
    fi
    
    # Check if app is running
    check_app_running
    
    # Run tests
    print_status "Starting automated tests..."
    echo ""
    
    if [ "$USE_PYTHON" = true ]; then
        if ! check_python; then
            print_error "Python not available, falling back to Node.js tests"
            USE_PYTHON=false
        fi
    fi
    
    # Execute the appropriate test suite
    if [ "$USE_PYTHON" = true ]; then
        print_status "Running Python test suite..."
        if [ -n "$TEST_MODULE" ]; then
            python3 test_optipenn_app.py --module "$TEST_MODULE" || python test_optipenn_app.py --module "$TEST_MODULE"
        else
            python3 test_optipenn_app.py || python test_optipenn_app.py
        fi
    else
        print_status "Running Node.js test suite..."
        if [ -n "$TEST_MODULE" ]; then
            node test-optipenn-app.js --module "$TEST_MODULE"
        else
            node test-optipenn-app.js
        fi
    fi
    
    TEST_EXIT_CODE=$?
    
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        print_success "All tests completed successfully!"
        echo ""
        print_status "Check the following directories for results:"
        echo "  📸 Screenshots: test_screenshots/"
        echo "  📄 Reports:     test_reports/"
        echo ""
        print_status "Open the latest HTML report in your browser for detailed results."
    else
        print_error "Some tests failed. Check the reports for details."
        echo ""
        print_status "Check the following directories for debugging:"
        echo "  📸 Screenshots: test_screenshots/"
        echo "  📄 Reports:     test_reports/"
        echo "  📋 Logs:        test_reports/*.log"
    fi
    
    exit $TEST_EXIT_CODE
}

# Trap to handle script interruption
trap 'print_warning "Test interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"