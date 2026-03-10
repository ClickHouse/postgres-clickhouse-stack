# Queries

All queries run against the `expenses` table. When `DB_SCHEMA=expense_ch` is set, they run against ClickHouse via the FDW — same SQL, no changes needed.

## `GET /api/expenses` — Recent expenses

```sql
SELECT id, description, amount, category, date, created_at
FROM expenses
ORDER BY date DESC, created_at DESC
LIMIT 100
```

## `POST /api/expenses` — Insert expense

Always writes to PostgreSQL. PeerDB replicates to ClickHouse.

```sql
INSERT INTO expenses (description, amount, category, date)
VALUES ($1, $2, $3, $4)
RETURNING *
```

## `GET /api/expenses/stats` — Analytics (4 queries, each timed)

```sql
-- Total
SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM expenses

-- By category
SELECT COALESCE(category, 'Uncategorized') as category, COUNT(*) as count, SUM(amount) as total
FROM expenses GROUP BY category ORDER BY total DESC

-- By month (PostgreSQL)
SELECT DATE_TRUNC('month', date) as month, COUNT(*) as count, SUM(amount) as total
FROM expenses GROUP BY DATE_TRUNC('month', date) ORDER BY month DESC

-- By month (ClickHouse equivalent)
SELECT toStartOfMonth(date) as month, COUNT(*) as count, SUM(amount) as total
FROM expenses GROUP BY month ORDER BY month DESC

-- Daily (last 30 days)
SELECT date, COUNT(*) as count, SUM(amount) as total
FROM expenses GROUP BY date ORDER BY date DESC LIMIT 30
```
