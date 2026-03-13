import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return NextResponse.json({ user });
  } catch (error: any) {
    const status = error?.status || 401;
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status });
  }
}
