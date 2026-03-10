import { NextRequest, NextResponse } from 'next/server';
import pool, { query as dbQuery, SOURCE_SCHEMA } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { description, amount, category, date } = await request.json();

    if (!description || !amount) {
      return NextResponse.json(
        { error: 'Description and amount are required' },
        { status: 400 }
      );
    }

    // Writes always go to source (PostgreSQL). PeerDB replicates to ClickHouse.
    const result = await pool.query(
      'INSERT INTO ' + SOURCE_SCHEMA + '.expenses (description, amount, category, date) VALUES ($1, $2, $3, $4) RETURNING *',
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
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    let query = 'SELECT id, description, amount, category, date, created_at FROM expenses WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      query += ' AND date >= $' + paramCount;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ' AND date <= $' + paramCount;
      params.push(endDate);
    }

    if (category) {
      paramCount++;
      query += ' AND category = $' + paramCount;
      params.push(category);
    }

    query += ' ORDER BY date DESC, created_at DESC LIMIT 100';

    const result = await dbQuery(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
