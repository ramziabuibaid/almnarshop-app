import { NextResponse } from 'next/server';
import { clearAdminCookieInResponse } from '@/lib/adminAuth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAdminCookieInResponse(response);
  return response;
}


