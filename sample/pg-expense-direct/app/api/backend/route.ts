import { NextRequest, NextResponse } from 'next/server';
import pool, { getBackend, getActiveSchema, useSource, useDestination, SOURCE_SCHEMA, DESTINATION_SCHEMA } from '@/lib/db';

async function schemaHasTable(schema: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = \'expenses\' LIMIT 1',
    [schema]
  );
  return result.rows.length > 0;
}

export async function GET() {
  return NextResponse.json({
    backend: getBackend(),
    schema: getActiveSchema(),
  });
}

export async function POST(request: NextRequest) {
  const { backend } = await request.json();

  if (backend === 'clickhouse') {
    if (!(await schemaHasTable(DESTINATION_SCHEMA))) {
      return NextResponse.json(
        { error: 'Schema "' + DESTINATION_SCHEMA + '" has no expenses table. Run ./run.sh migrate first.' },
        { status: 400 }
      );
    }
    useDestination();
  } else {
    if (!(await schemaHasTable(SOURCE_SCHEMA))) {
      return NextResponse.json(
        { error: 'Schema "' + SOURCE_SCHEMA + '" has no expenses table. Run ./run.sh seed first.' },
        { status: 400 }
      );
    }
    useSource();
  }

  return NextResponse.json({
    backend: getBackend(),
    schema: getActiveSchema(),
  });
}
