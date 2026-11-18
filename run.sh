#!/usr/bin/env bash
set -e

# Lorely Literary Simulation - Orchestration Script
# Usage:
#   ./run.sh              # Run both backend & frontend locally (with Docker PostgreSQL)
#   ./run.sh all          # Run both backend & frontend locally (with Docker PostgreSQL)
#   ./run.sh backend      # Run backend only (Flask on :5000 with Docker PostgreSQL)
#   ./run.sh frontend     # Run frontend only (Vite on :5173)
#   ./run.sh test         # Run full test suite (pytest + vitest)
#   ./run.sh docker       # Build and start via Docker Compose
#   ./run.sh docker-down  # Stop Docker Compose services
#   ./run.sh postgres     # Start PostgreSQL Docker container only
#   ./run.sh migrate      # Migrate relational data to Docker PostgreSQL

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function log_info() {
  echo -e "${CYAN}[Lorely]${NC} $1"
}

function log_success() {
  echo -e "${GREEN}[Lorely ✓]${NC} $1"
}

function log_warn() {
  echo -e "${YELLOW}[Lorely ⚠]${NC} $1"
}

function log_error() {
  echo -e "${RED}[Lorely ✗]${NC} $1"
}

function check_env_files() {
  if [ ! -f "${BACKEND_DIR}/.env" ]; then
    if [ -f "${BACKEND_DIR}/.env.example" ]; then
      log_warn "backend/.env missing. Creating from .env.example..."
      cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
    fi
  fi

  if [ ! -f "${FRONTEND_DIR}/.env" ]; then
    if [ -f "${FRONTEND_DIR}/.env.example" ]; then
      log_warn "frontend/.env missing. Creating from .env.example..."
      cp "${FRONTEND_DIR}/.env.example" "${FRONTEND_DIR}/.env"
    fi
  fi
}

function ensure_backend_venv() {
  if [ ! -d "${BACKEND_DIR}/.venv" ]; then
    log_info "Creating backend Python virtual environment..."
    python3 -m venv "${BACKEND_DIR}/.venv"
    "${BACKEND_DIR}/.venv/bin/pip" install --upgrade pip
    "${BACKEND_DIR}/.venv/bin/pip" install -r "${BACKEND_DIR}/requirements.txt"
  fi
}

function ensure_frontend_deps() {
  if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
    log_info "Installing frontend npm dependencies..."
    (cd "${FRONTEND_DIR}" && npm install)
  fi
}

function ensure_postgres() {
  local port="${POSTGRES_PORT:-5434}"
  log_info "Ensuring PostgreSQL container is running on port ${port}..."

  if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker is not installed or not in PATH."
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not running. Please start Docker."
    exit 1
  fi

  if ! docker ps --format '{{.Names}}' | grep -q "^lorely_postgres$"; then
    log_info "Starting PostgreSQL container via Docker Compose..."
    docker compose up -d postgres
  fi

  # Wait for postgres to be ready (up to 30 seconds)
  local retries=30
  while [ $retries -gt 0 ]; do
    if docker compose exec -T postgres pg_isready -U postgres -d lorely >/dev/null 2>&1; then
      log_success "PostgreSQL is ready and healthy on port ${port}."
      return 0
    fi
    sleep 1
    retries=$((retries - 1))
  done

  log_error "PostgreSQL container did not become ready in time."
  exit 1
}

function run_migrate() {
  check_env_files
  ensure_backend_venv
  ensure_postgres
  log_info "Running SQLite to PostgreSQL migration..."
  (cd "${BACKEND_DIR}" && "${BACKEND_DIR}/.venv/bin/python" scripts/migrate_sqlite_to_postgres.py)
}

function run_backend() {
  check_env_files
  ensure_backend_venv
  ensure_postgres
  log_info "Starting Backend server on http://127.0.0.1:5000 ..."
  (cd "${BACKEND_DIR}" && "${BACKEND_DIR}/.venv/bin/python" run.py)
}

function run_frontend() {
  check_env_files
  ensure_frontend_deps
  log_info "Starting Frontend Vite dev server on http://127.0.0.1:5173 ..."
  (cd "${FRONTEND_DIR}" && npm run dev -- --host 127.0.0.1 --port 5173)
}

function run_all() {
  check_env_files
  ensure_backend_venv
  ensure_frontend_deps
  ensure_postgres

  log_info "Starting both Backend (port 5000) and Frontend (port 5173)..."

  # Trap interrupts to terminate both child jobs
  cleanup() {
    echo ""
    log_info "Shutting down servers..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
    log_success "All servers stopped cleanly."
    exit 0
  }
  trap cleanup SIGINT SIGTERM EXIT

  # Start backend in background
  (cd "${BACKEND_DIR}" && "${BACKEND_DIR}/.venv/bin/python" run.py) &
  BACKEND_PID=$!

  # Give backend a moment to boot
  sleep 2
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    log_error "Backend failed to start. Check error output above."
    exit 1
  fi

  # Start frontend in background
  (cd "${FRONTEND_DIR}" && npm run dev -- --host 127.0.0.1 --port 5173) &
  FRONTEND_PID=$!

  log_success "Lorely is live!"
  echo "  - Reader App:     http://127.0.0.1:5173/"
  echo "  - Admin Portal:   http://127.0.0.1:5173/admin/login"
  echo "  - Backend API:    http://127.0.0.1:5000/api"
  echo "  - Health Check:   http://127.0.0.1:5000/api/health"
  echo "  Press Ctrl+C to terminate both servers."

  wait
}

function run_tests() {
  check_env_files
  ensure_backend_venv
  ensure_frontend_deps

  log_info "Running backend pytest suite..."
  (cd "${BACKEND_DIR}" && "${BACKEND_DIR}/.venv/bin/pytest" tests/)

  log_info "Running frontend vitest suite..."
  (cd "${FRONTEND_DIR}" && npm run test -- --run)

  log_success "All test suites passed!"
}

function run_docker() {
  check_env_files
  log_info "Starting Lorely services via Docker Compose..."
  docker compose up --build
}

function run_docker_down() {
  log_info "Stopping Docker Compose services..."
  docker compose down
}

# Command dispatch
ACTION="${1:-all}"

case "$ACTION" in
  all|"")
    run_all
    ;;
  backend)
    run_backend
    ;;
  frontend)
    run_frontend
    ;;
  test)
    run_tests
    ;;
  docker)
    run_docker
    ;;
  docker-down)
    run_docker_down
    ;;
  postgres)
    ensure_postgres
    ;;
  migrate)
    run_migrate
    ;;
  help|--help|-h)
    echo "Lorely Simulation Runner"
    echo "Usage: ./run.sh [all|backend|frontend|test|docker|docker-down|postgres|migrate|help]"
    ;;
  *)
    log_error "Unknown command: $ACTION"
    echo "Usage: ./run.sh [all|backend|frontend|test|docker|docker-down|postgres|migrate|help]"
    exit 1
    ;;
esac
