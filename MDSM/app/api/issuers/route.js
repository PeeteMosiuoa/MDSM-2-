import { NextResponse } from 'next/server';
import { getRows } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  try {
    const issuers = userId
      ? await getRows(
          'SELECT id, user_id, company_name, approved, created_at FROM issuers WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        )
      : await getRows(
          'SELECT id, user_id, company_name, approved, created_at FROM issuers ORDER BY created_at DESC'
        );

    return NextResponse.json(issuers);
  } catch (error) {
    console.error('Error fetching issuers:', error);
    return NextResponse.json({ error: 'Failed to fetch issuers' }, { status: 500 });
  }
}
