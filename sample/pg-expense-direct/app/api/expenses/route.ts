import { NextRequest, NextResponse } from 'next/server';
import pool, { pgPool } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { description, amount, category, date } = await request.json();

    if (!description || !amount) {
      return NextResponse.json(
        { error: 'Description and amount are required' },
        { status: 400 }
      );
    }

    // INSERT operations should always use PostgreSQL (not ClickHouse)
    // ClickHouse is optimized for analytics/SELECT queries, not transactional operations
    const result = await pgPool.query(
      'INSERT INTO expenses (description, amount, category, date) VALUES ($1, $2, $3, $4) RETURNING *',
      [description, parseFloat(amount), category || null, date || new Date().toISOString().split('T')[0]]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  let query = '';
  let params: any[] = [];
  
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    query = 'SELECT * FROM expenses WHERE 1=1';
    params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      query += ` AND date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND date <= $${paramCount}`;
      params.push(endDate);
    }

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    // Conditional ordering based on database type
    const useClickHouse = process.env.USE_CLICKHOUSE === 'true';
    if (useClickHouse) {
      // CONVERTED TO CLICKHOUSE: 2024-12-19
      // ClickHouse requires ORDER BY for optimal performance with MergeTree tables
      query += ' ORDER BY date DESC, id DESC';
    } else {
      query += ' ORDER BY date DESC, created_at DESC';
    }

    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    
    // Enhanced error reporting for ClickHouse issues
    if (process.env.USE_CLICKHOUSE === 'true') {
      console.error('ClickHouse query error details:', {
        query,
        params,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}