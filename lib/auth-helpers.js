import { NextResponse } from 'next/server';
import { auth } from '../auth';

// Use inside Route Handlers: returns null when the caller is an authenticated
// admin, otherwise returns a NextResponse the caller should return directly.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function getSession() {
  return auth();
}
