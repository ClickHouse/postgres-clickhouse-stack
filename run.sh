#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Ensure we're in the project root
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

check_service() {
    local service_name=$1
    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        local health=$(docker compose ps --format json "$service_name" 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1)
        local state=$(docker compose ps --format json "$service_name" 2>/dev/null | grep -o '"State":"[^"]*"' | head -1)

        if echo "$health" | grep -q "healthy"; then
            return 0
        elif [ -z "$health" ] || echo "$health" | grep -q '""'; then
            if echo "$state" | grep -q "running"; then
                return 0
            fi
        fi

        attempt=$((attempt + 1))
        sleep 2
    done

    return 1
}

cmd_start() {
    echo -e "${BLUE}Starting PeerDB + PostgreSQL + ClickHouse Stack...${NC}"
    echo ""

    docker compose up -d

    echo ""
    echo -e "${YELLOW}Waiting for services to start...${NC}"

    for svc in postgres clickhouse peerdb-ui catalog expense-app; do
        echo -ne "${YELLOW}Waiting for ${svc}...${NC}\r"
        if check_service "$svc"; then
            echo -e "${GREEN}✓ ${svc}${NC}                    "
        else
            echo -e "${YELLOW}⚠ ${svc} (may need more time)${NC}"
        fi
    done

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   Stack is up and running!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Sample App:${NC}"
    echo -e "   URL: http://localhost:18080"
    echo -e "   Seed data: ${YELLOW}./run.sh seed${NC}"
    echo ""
    echo -e "${BLUE}PeerDB UI:${NC}"
    echo -e "   URL: http://localhost:13000"
    echo ""
    echo -e "${BLUE}ClickHouse UI (HTTP Interface):${NC}"
    echo -e "   URL: http://localhost:18123/play"
    echo ""
    echo -e "${BLUE}ClickHouse Client:${NC}"
    echo -e "   Command: ${YELLOW}./run.sh clickhouse${NC}"
    echo ""
    echo -e "${BLUE}PostgreSQL:${NC}"
    echo -e "   Command: ${YELLOW}./run.sh psql${NC}"
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}To view logs:${NC} docker compose logs -f"
    echo -e "${YELLOW}To stop:${NC} ./run.sh stop"
    echo ""
}

cmd_stop() {
    echo -e "${BLUE}Stopping stack...${NC}"
    docker compose down
}

cmd_clean() {
    echo -e "${BLUE}Stopping stack and removing all data...${NC}"
    docker compose down --volumes --remove-orphans
}

cmd_seed() {
    if ! docker compose ps --status running expense-app 2>/dev/null | grep -q expense-app; then
        echo -e "${RED}Error: Sample app is not running${NC}"
        echo -e "Please start the stack first using: ${YELLOW}./run.sh start${NC}"
        exit 1
    fi
    local rows="${1:-}"
    if [ -n "$rows" ]; then
        echo -e "${BLUE}Seeding sample database with ${rows} rows...${NC}"
        docker compose exec -e SEED_EXPENSE_ROWS="$rows" expense-app npm run seed
    else
        echo -e "${BLUE}Seeding sample database...${NC}"
        docker compose exec expense-app npm run seed
    fi
}

cmd_migrate() {
    ./sample/migrate_data.sh
}

cmd_use_clickhouse() {
    echo -e "${BLUE}Switching to ClickHouse (via FDW)...${NC}"
    curl -s -X POST http://localhost:18080/api/backend \
      -H 'Content-Type: application/json' \
      -d '{"backend":"clickhouse"}' > /dev/null
    echo -e "${GREEN}✓ Now querying ClickHouse${NC}"
}

cmd_use_postgres() {
    echo -e "${BLUE}Switching to PostgreSQL...${NC}"
    curl -s -X POST http://localhost:18080/api/backend \
      -H 'Content-Type: application/json' \
      -d '{"backend":"postgres"}' > /dev/null
    echo -e "${GREEN}✓ Now querying PostgreSQL${NC}"
}

cmd_psql() {
    if ! docker compose ps --status running postgres 2>/dev/null | grep -q postgres; then
        echo -e "${RED}Error: PostgreSQL is not running${NC}"
        echo -e "Please start the stack first using: ${YELLOW}./run.sh start${NC}"
        exit 1
    fi
    docker compose exec postgres psql -U admin -d postgres "$@"
}

cmd_clickhouse() {
    if ! docker compose ps --status running clickhouse 2>/dev/null | grep -q clickhouse; then
        echo -e "${RED}Error: ClickHouse is not running${NC}"
        echo -e "Please start the stack first using: ${YELLOW}./run.sh start${NC}"
        exit 1
    fi
    docker compose exec clickhouse clickhouse-client --password clickhouse "$@"
}

open_url() {
    if command -v open &> /dev/null; then
        open "$1"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$1"
    elif command -v cmd.exe &> /dev/null; then
        cmd.exe /c start "$1"
    else
        echo -e "${YELLOW}Open in your browser: ${NC}$1"
    fi
}

cmd_open() {
    local target="${1:-app}"
    case "$target" in
        app)        open_url "http://localhost:18080" ;;
        analytics)  open_url "http://localhost:18080/analytics" ;;
        peerdb)     open_url "http://localhost:13000" ;;
        clickhouse) open_url "http://localhost:18123/play" ;;
        *)
            echo "Usage: ./run.sh open [app|analytics|peerdb|clickhouse]"
            exit 1
            ;;
    esac
}

cmd_help() {
    echo "Usage: ./run.sh <command>"
    echo ""
    echo "Commands:"
    echo "  start       Start the stack"
    echo "  stop        Stop the stack (keeps data)"
    echo "  clean       Stop the stack and remove all data"
    echo "  seed [rows] Seed the sample database (default: 10,000,000 rows)"
    echo "  migrate       Set up PeerDB replication and ClickHouse FDW"
    echo "  use-postgres  Switch sample app to query PostgreSQL"
    echo "  use-clickhouse Switch sample app to query ClickHouse"
    echo "  psql        Open a PostgreSQL shell"
    echo "  clickhouse  Open a ClickHouse shell"
    echo "  open [target] Open in browser (app|analytics|peerdb|clickhouse)"
    echo "  help        Show this help message"
}

case "${1:-}" in
    start)      cmd_start ;;
    stop)       cmd_stop ;;
    clean)      cmd_clean ;;
    seed)       shift; cmd_seed "$@" ;;
    migrate)       cmd_migrate ;;
    use-postgres)  cmd_use_postgres ;;
    use-clickhouse) cmd_use_clickhouse ;;
    psql)       shift; cmd_psql "$@" ;;
    clickhouse) shift; cmd_clickhouse "$@" ;;
    open)       shift; cmd_open "$@" ;;
    help)    cmd_help ;;
    *)
        cmd_help
        exit 1
        ;;
esac
