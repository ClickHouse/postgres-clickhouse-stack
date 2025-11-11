import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

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
      whereClause += ` AND date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND date <= $${paramCount}`;
      params.push(endDate);
    }

    // Total expenses
    const totalResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM expenses ${whereClause}`,
      params
    );

    // Expenses by category
    const categoryResult = await pool.query(
      `SELECT 
        COALESCE(category, 'Uncategorized') as category, 
        COUNT(*) as count, 
        SUM(amount) as total 
       FROM expenses ${whereClause} 
       GROUP BY category 
       ORDER BY total DESC`,
      params
    );

    // Monthly aggregation
    const monthlyResult = await pool.query(
      `SELECT 
        DATE_TRUNC('month', date) as month,
        COUNT(*) as count,
        SUM(amount) as total
       FROM expenses ${whereClause}
       GROUP BY DATE_TRUNC('month', date)
       ORDER BY month DESC`,
      params
    );

    // Daily aggregation for last 30 days (or filtered range)
    const dailyResult = await pool.query(
      `SELECT 
        date,
        COUNT(*) as count,
        SUM(amount) as total
       FROM expenses ${whereClause}
       GROUP BY date
       ORDER BY date DESC
       LIMIT 30`,
      params
    );

    const stats = {
      total: {
        count: parseInt(totalResult.rows[0].count),
        amount: parseFloat(totalResult.rows[0].total)
      },
      byCategory: categoryResult.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count),
        total: parseFloat(row.total)
      })),
      byMonth: monthlyResult.rows.map(row => ({
        month: row.month,
        count: parseInt(row.count),
        total: parseFloat(row.total)
      })),
      daily: dailyResult.rows.map(row => ({
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