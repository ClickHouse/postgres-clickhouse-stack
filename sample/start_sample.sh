#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SAMPLE_DIR="pg-expense-direct"

echo "DB_SCHEMA: $DB_SCHEMA"

echo -e "${BLUE}Starting Sample Expense Application...${NC}"
echo ""

# Check if we're in the right directory
if [ ! -d "$SAMPLE_DIR" ]; then
    echo -e "${RED}Error: $SAMPLE_DIR directory not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Navigate to sample directory
cd "$SAMPLE_DIR" || exit 2

# Check if PostgreSQL is running
echo -e "${YELLOW}Checking if PostgreSQL is running...${NC}"
if ! pg_isready -h localhost -p 5432 -U admin > /dev/null 2>&1; then
    echo -e "${RED}Error: PostgreSQL is not running${NC}"
    echo -e "Please start the stack first using: ${YELLOW}./start.sh${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL is running${NC}"
echo ""

# Initialize database (create tables)
echo -e "${YELLOW}Running init.sql to create tables..."
export PGPASSWORD=password

if psql -h localhost -p 5432 -U admin -d postgres -f init.sql --no-psqlrc > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Tables created successfully${NC}"
else
    echo -e "${YELLOW}⚠ Table creation encountered issues${NC}"
fi
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"

    if ! npm install; then
        echo -e "${RED}Error: Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# Check if data exists in expenses table
echo -e "${YELLOW}Checking if data exists...${NC}"
ROW_COUNT=$(psql --tuples-only --no-psqlrc --quiet --no-align -h localhost -p 5432 -U admin -d postgres -t -c "SELECT COUNT(*) FROM expenses;" 2>/dev/null | xargs)

if [ -z "$ROW_COUNT" ] || [ "$ROW_COUNT" -eq "0" ]; then
    echo -e "${YELLOW}No data found. Seeding database...${NC}"
    echo -e "${BLUE}This may take a few minutes (default: 1,000,000 rows)${NC}"
    echo -e "${BLUE}To change row count, set SEED_EXPENSE_ROWS environment variable${NC}"
    echo ""

    if ! npm run seed; then
        echo -e "${RED}Error: Failed to seed database${NC}"
        exit 1
    fi
    echo ""
else
    echo -e "${GREEN}✓ Data already exists (${ROW_COUNT} rows)${NC}"
    echo ""
fi

echo -e "${YELLOW}Start the application...${NC}"
npm run dev
