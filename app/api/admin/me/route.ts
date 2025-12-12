import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '../helpers';

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ admin });
}


