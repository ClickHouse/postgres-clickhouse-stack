import { NextRequest, NextResponse } from 'next/server';
import { QueryResultRow } from 'pg';
import { query as dbQuery, getBackend } from '@/lib/db';

async function timedQuery<T extends QueryResultRow>(label: string, text: string, params: unknown[]) {
  const start = performance.now();
  const result = await dbQuery<T>(text, params);
  const ms = Math.round(performance.now() - start);
  return { result, timing: { label, ms } };
}

interface TotalRow extends QueryResultRow {
  count: string;
  total: string;
}

interface AggregateRow extends QueryResultRow {
  count: string;
  total: string;
  category?: string;
  month?: string;
  date?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      whereClause += ' AND date >= $' + paramCount;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ' AND date <= $' + paramCount;
      params.push(endDate);
    }

    const totalQuery = await timedQuery<TotalRow>(
      'Total expenses',
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM expenses ' + whereClause,
      params
    );

    const categoryQuery = await timedQuery<AggregateRow>(
      'By category',
      'SELECT COALESCE(category, \'Uncategorized\') as category, COUNT(*) as count, SUM(amount) as total FROM expenses ' + whereClause + ' GROUP BY category ORDER BY total DESC',
      params
    );

    const monthlyQuery = await timedQuery<AggregateRow>(
      'By month',
      'SELECT DATE_TRUNC(\'month\', date) as month, COUNT(*) as count, SUM(amount) as total FROM expenses ' + whereClause + ' GROUP BY DATE_TRUNC(\'month\', date) ORDER BY month DESC',
      params
    );

    const dailyQuery = await timedQuery<AggregateRow>(
      'Daily activity',
      'SELECT date, COUNT(*) as count, SUM(amount) as total FROM expenses ' + whereClause + ' GROUP BY date ORDER BY date DESC LIMIT 30',
      params
    );

    const backend = getBackend();

    const stats = {
      backend,
      queryTimings: [
        totalQuery.timing,
        categoryQuery.timing,
        monthlyQuery.timing,
        dailyQuery.timing,
      ],
      total: {
        count: parseInt(totalQuery.result.rows[0].count),
        amount: parseFloat(totalQuery.result.rows[0].total)
      },
      byCategory: categoryQuery.result.rows.map((row) => ({
        category: row.category,
        count: parseInt(row.count),
        total: parseFloat(row.total)
      })),
      byMonth: monthlyQuery.result.rows.map((row) => ({
        month: row.month,
        count: parseInt(row.count),
        total: parseFloat(row.total)
      })),
      daily: dailyQuery.result.rows.map((row) => ({
        date: row.date,
        count: parseInt(row.count),
        total: parseFloat(row.total)
      }))
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching expense stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
