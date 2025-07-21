#!/bin/bash
# OpenSubtitles Uploader - Zero-Downtime Deploy Script
# Syncs from GitHub, builds, and starts the preview server with minimal downtime
# Usage: ./deploy.sh [--force-install] [--skip-build] [--dev] [--clean]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'    # Changed from blue to cyan for better visibility
NC='\033[0m' # No Color

# Configuration
PREVIEW_PORT=4173
DEV_PORT=5173
TEMP_PORT=4174
HEALTH_CHECK_TIMEOUT=30
GRACEFUL_SHUTDOWN_TIMEOUT=10

# Parse command line arguments
FORCE_INSTALL=false
SKIP_BUILD=false
DEV_MODE=false
CLEAN_BUILD=false
BACKGROUND_MODE=true  # Default to background mode

while [[ $# -gt 0 ]]; do
  case $1 in
    --force-install)
      FORCE_INSTALL=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --dev)
      DEV_MODE=true
      shift
      ;;
    --clean)
      CLEAN_BUILD=true
      shift
      ;;
    --background|--bg)
      BACKGROUND_MODE=true
      shift
      ;;
    --foreground|--fg)
      BACKGROUND_MODE=false
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --force-install    Force reinstall all dependencies"
      echo "  --skip-build       Skip the build step"
      echo "  --dev              Start development server instead of production build"
      echo "  --clean            Clean build artifacts before building"
      echo "  --background, --bg Run server in background (default)"
      echo "  --foreground, --fg Run server in foreground (blocks terminal)"
      echo "  -h, --help         Show this help message"
      echo ""
      echo "Default behavior: Runs in background mode"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--force-install] [--skip-build] [--dev] [--clean] [--foreground]"
      exit 1
      ;;
  esac
done

# Function to print colored output
print_step() {
  echo -e "${CYAN}$1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
  local port=$1
  lsof -ti:$port >/dev/null 2>&1
}

# Function to get all PIDs using port (including child processes)
get_all_pids_by_port() {
  local port=$1
  # Get main process and all related vite/esbuild processes
  ps aux | grep -E "(vite.*preview.*--port $port|esbuild.*--service)" | grep -v grep | awk '{print $2}' || echo ""
}

# Function to get PID using port
get_pid_by_port() {
  local port=$1
  lsof -ti:$port 2>/dev/null | head -n1 || echo ""
}

# Function to kill all related processes
kill_all_related_processes() {
  local port=$1
  local pids=$(get_all_pids_by_port $port)
  
  if [ ! -z "$pids" ]; then
    print_step "Found related processes for port $port: $pids"
    for pid in $pids; do
      if kill -0 $pid 2>/dev/null; then
        print_step "Killing process $pid"
        kill -TERM $pid 2>/dev/null || true
      fi
    done
    
    sleep 2
    
    # Force kill any remaining processes
    for pid in $pids; do
      if kill -0 $pid 2>/dev/null; then
        print_warning "Force killing stubborn process $pid"
        kill -9 $pid 2>/dev/null || true
      fi
    done
  fi
}

# Function to wait for port to be available
wait_for_port_available() {
  local port=$1
  local timeout=$2
  local count=0
  
  while port_in_use $port && [ $count -lt $timeout ]; do
    sleep 1
    ((count++))
  done
  
  if port_in_use $port; then
    return 1
  fi
  return 0
}

# Function to wait for server to be ready
wait_for_server_ready() {
  local port=$1
  local timeout=$2
  local count=0
  
  print_step "Waiting for server to be ready on port $port..."
  
  while [ $count -lt $timeout ]; do
    if curl -s -f "http://localhost:$port" >/dev/null 2>&1; then
      print_success "Server is ready!"
      return 0
    fi
    sleep 1
    ((count++))
    if [ $((count % 5)) -eq 0 ]; then
      echo -n "."
    fi
  done
  
  print_error "Server failed to start within $timeout seconds"
  return 1
}

# Function to create pid file
create_pid_file() {
  local pid=$1
  local port=$2
  local mode=$3
  
  echo "$pid" > ".server-${port}.pid"
  echo "mode=$mode" >> ".server-${port}.pid"
  echo "started=$(date)" >> ".server-${port}.pid"
}

# Function to remove pid file
remove_pid_file() {
  local port=$1
  rm -f ".server-${port}.pid"
}

# Function to get server info from pid file
get_server_info() {
  local port=$1
  local pid_file=".server-${port}.pid"
  
  if [ -f "$pid_file" ]; then
    local pid=$(head -n1 "$pid_file")
    if kill -0 $pid 2>/dev/null; then
      cat "$pid_file"
      return 0
    else
      rm -f "$pid_file"
    fi
  fi
  return 1
}

# Function to show server status
show_server_status() {
  local port=$1
  
  if get_server_info $port >/dev/null 2>&1; then
    print_success "Server is running on port $port"
    get_server_info $port | while read line; do
      echo "  $line"
    done
    echo "  Check logs: tail -f server-${port}.log"
    echo "  Stop server: kill \$(cat .server-${port}.pid | head -n1)"
  else
    print_warning "No server found on port $port"
  fi
}
# Function to gracefully shutdown server
graceful_shutdown() {
  local pid=$1
  local timeout=$2
  local port=$3
  
  if [ -z "$pid" ]; then
    return 0
  fi
  
  print_step "Gracefully shutting down server (PID: $pid)..."
  
  # Kill all related processes for this port
  if [ ! -z "$port" ]; then
    kill_all_related_processes $port
  fi
  
  # Send SIGTERM to main process
  kill -TERM $pid 2>/dev/null || return 0
  
  # Wait for graceful shutdown
  local count=0
  while kill -0 $pid 2>/dev/null && [ $count -lt $timeout ]; do
    sleep 1
    ((count++))
  done
  
  # Force kill if still running
  if kill -0 $pid 2>/dev/null; then
    print_warning "Force killing main process..."
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
  
  # Remove pid file
  if [ ! -z "$port" ]; then
    remove_pid_file $port
  fi
  
  print_success "Server shutdown complete"
}

# Function to perform zero-downtime deployment
zero_downtime_deploy() {
  local target_port=$1
  local old_pid=$(get_pid_by_port $target_port)
  
  print_step "🔄 Starting zero-downtime deployment on port $target_port..."
  
  # Clean up any existing processes on temp port first
  kill_all_related_processes $TEMP_PORT
  
  # Start new server on temporary port
  print_step "Starting new server on temporary port $TEMP_PORT..."
  npm run preview -- --host 0.0.0.0 --port $TEMP_PORT &
  local new_pid=$!
  
  # Wait for new server to be ready
  if ! wait_for_server_ready $TEMP_PORT $HEALTH_CHECK_TIMEOUT; then
    print_error "New server failed to start"
    kill $new_pid 2>/dev/null || true
    kill_all_related_processes $TEMP_PORT
    return 1
  fi
  
  # If there's an old server, shut it down
  if [ ! -z "$old_pid" ]; then
    graceful_shutdown $old_pid $GRACEFUL_SHUTDOWN_TIMEOUT $target_port
    
    # Wait for port to be available
    if ! wait_for_port_available $target_port 5; then
      print_error "Old server didn't release port $target_port"
      kill $new_pid 2>/dev/null || true
      kill_all_related_processes $TEMP_PORT
      return 1
    fi
  fi
  
  # Stop new server on temp port
  print_step "Stopping temporary server..."
  kill $new_pid 2>/dev/null || true
  kill_all_related_processes $TEMP_PORT
  wait_for_port_available $TEMP_PORT 5
  
  # Start new server on target port
  print_step "Starting new server on target port $target_port..."
  npm run preview -- --host 0.0.0.0 --port $target_port &
  SERVER_PID=$!
  
  # Final health check
  if wait_for_server_ready $target_port $HEALTH_CHECK_TIMEOUT; then
    print_success "Zero-downtime deployment successful!"
    return 0
  else
    print_error "Final server failed to start"
    kill_all_related_processes $target_port
    return 1
  fi
}

# Function to check if files have changed
files_changed() {
  local files=("$@")
  local state_file="node_modules/.install-state"
  
  if [ ! -f "$state_file" ]; then
    return 0  # State file doesn't exist, assume changed
  fi
  
  for file in "${files[@]}"; do
    if [ -f "$file" ] && [ "$file" -nt "$state_file" ]; then
      return 0  # File is newer than state
    fi
  done
  
  return 1  # No files changed
}

# Function to check if build is needed
build_needed() {
  local build_state="dist/.build-state"
  
  if [ ! -f "$build_state" ] || [ ! -d "dist" ]; then
    return 0  # No build state or dist folder
  fi
  
  # Check if any source files are newer than build state
  if find src public -type f -newer "$build_state" 2>/dev/null | grep -q .; then
    return 0
  fi
  
  # Check if package.json or vite.config.js changed
  for file in "package.json" "vite.config.js" "vite.config.ts"; do
    if [ -f "$file" ] && [ "$file" -nt "$build_state" ]; then
      return 0
    fi
  done
  
  return 1  # No build needed
}

# Function to backup current build
backup_build() {
  if [ -d "dist" ]; then
    print_step "Backing up current build..."
    rm -rf dist.backup
    cp -r dist dist.backup
    print_success "Build backed up"
  fi
}

# Function to restore build from backup
restore_build() {
  if [ -d "dist.backup" ]; then
    print_step "Restoring build from backup..."
    rm -rf dist
    mv dist.backup dist
    print_success "Build restored from backup"
  fi
}

# Function to cleanup on exit
cleanup() {
  if [ ! -z "$SERVER_PID" ] && [ "$BACKGROUND_MODE" = false ]; then
    print_step "Stopping server..."
    graceful_shutdown $SERVER_PID 5 $PREVIEW_PORT
  fi
  
  # Clean up any remaining processes on both ports
  print_step "Cleaning up any remaining processes..."
  kill_all_related_processes $TEMP_PORT
  kill_all_related_processes $PREVIEW_PORT
  kill_all_related_processes $DEV_PORT
}

# Set up cleanup trap
trap cleanup EXIT

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  print_error "package.json not found. Are you in the correct directory?"
  exit 1
fi

# Check if required commands exist
for cmd in git node npm curl lsof; do
  if ! command_exists $cmd; then
    print_error "$cmd is not installed"
    exit 1
  fi
done

print_step "🔄 Pulling latest changes from GitHub..."
print_step "Ensuring we have the absolute latest state from GitHub..."

# Get current commit before update
BEFORE_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
print_step "Current commit: $BEFORE_COMMIT"

# Force fetch everything to avoid stale cache issues
print_step "Force fetching all refs from origin..."
if ! git fetch --all --force --prune; then
  print_error "Failed to fetch from GitHub"
  exit 1
fi

# Show what we're about to reset to
REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "unknown")
print_step "Remote main commit: $REMOTE_COMMIT"

# Force reset to origin/main to ensure we're exactly in sync
print_step "Hard resetting to origin/main..."
if git reset --hard origin/main; then
  AFTER_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  if [ "$BEFORE_COMMIT" != "$AFTER_COMMIT" ]; then
    print_success "Code updated: $BEFORE_COMMIT → $AFTER_COMMIT"
  else
    print_success "Code already up to date: $AFTER_COMMIT"
  fi
else
  print_error "Failed to reset to origin/main"
  exit 1
fi

# Clean any untracked files that might interfere
print_step "Cleaning untracked files..."
git clean -fd

# Verify we're truly in sync
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)
if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
  print_success "✅ Verified: Local and remote are in perfect sync ($LOCAL_COMMIT)"
else
  print_error "❌ Sync verification failed: Local=$LOCAL_COMMIT, Remote=$REMOTE_COMMIT"
  exit 1
fi

print_step "📦 Checking dependencies..."
if [ "$FORCE_INSTALL" = true ] || files_changed "package.json" "package-lock.json"; then
  print_step "📦 Installing/updating dependencies..."
  
  # Clean install for reliability
  if [ -f "package-lock.json" ]; then
    npm ci --silent
  else
    npm install --silent
  fi
  
  # Create state file
  touch node_modules/.install-state
  print_success "Dependencies installed successfully"
else
  print_success "Dependencies are up to date"
fi

# Clean build artifacts if requested
if [ "$CLEAN_BUILD" = true ]; then
  print_step "🧹 Cleaning build artifacts..."
  rm -rf dist
  rm -rf node_modules/.vite
  print_success "Build artifacts cleaned"
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")

# Development mode (no zero-downtime needed)
if [ "$DEV_MODE" = true ]; then
  print_step "🏗️  Starting development server..."
  
  # Kill existing dev server if running
  local dev_pid=$(get_pid_by_port $DEV_PORT)
  if [ ! -z "$dev_pid" ]; then
    graceful_shutdown $dev_pid 5 $DEV_PORT
  fi
  
  print_success "Development server will be available at http://localhost:$DEV_PORT with version $VERSION"
  
  if [ "$BACKGROUND_MODE" = true ]; then
    print_step "Starting development server in background..."
    nohup npm run dev -- --host 0.0.0.0 --port $DEV_PORT > "server-${DEV_PORT}.log" 2>&1 &
    SERVER_PID=$!
    create_pid_file $SERVER_PID $DEV_PORT "development"
    print_success "Development server started in background (PID: $SERVER_PID)"
    show_server_status $DEV_PORT
    exit 0
  else
    print_warning "Running in foreground mode - Press Ctrl+C to stop the server"
    exec npm run dev -- --host 0.0.0.0 --port $DEV_PORT
  fi
fi

# Build step with backup
if [ "$SKIP_BUILD" = false ]; then
  if [ "$CLEAN_BUILD" = true ] || build_needed; then
    print_step "🏗️  Building production version..."
    
    # Backup current build
    backup_build
    
    # Set production environment for API key embedding
    export NODE_ENV=production
    
    if npm run build; then
      # Create build state file
      mkdir -p dist
      touch dist/.build-state
      print_success "Build completed successfully"
      
      # Remove backup on successful build
      rm -rf dist.backup
    else
      print_error "Build failed"
      restore_build
      exit 1
    fi
  else
    print_success "Build is up to date, skipping..."
  fi
fi

# Check if dist folder exists
if [ ! -d "dist" ]; then
  print_error "dist folder not found. Build may have failed."
  exit 1
fi

# Perform zero-downtime deployment
if zero_downtime_deploy $PREVIEW_PORT; then
  print_success "🎉 Deployment completed successfully!"
  print_success "Server is running at http://localhost:$PREVIEW_PORT with version $VERSION"
  
  if [ "$BACKGROUND_MODE" = true ]; then
    # Create pid file and log file for background mode
    create_pid_file $SERVER_PID $PREVIEW_PORT "production"
    
    # Redirect output to log file
    exec > "server-${PREVIEW_PORT}.log" 2>&1
    
    print_success "Server started in background (PID: $SERVER_PID)"
    show_server_status $PREVIEW_PORT
    
    # Don't cleanup on exit in background mode
    trap - EXIT
    
    # Detach from terminal
    disown
    exit 0
  else
    print_warning "Running in foreground mode - Press Ctrl+C to stop the server"
    
    # Wait for server to finish
    wait $SERVER_PID
  fi
else
  print_error "Deployment failed"
  exit 1
fi