import { NextResponse } from 'next/server';
import {
  listAllServices,
  insertService,
  makeUniqueServiceId,
} from '../../../../lib/services-db';
import { getSession } from '../../../../lib/auth-helpers';

const VALID_CATEGORIES = new Set(['skin-care', 'waxing', 'self-care']);

async function requireAdmin() {
  const session = await getSession();
  return session?.user?.isAdmin ? session : null;
}

// GET /api/admin/services — list every service (active + archived).
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const services = await listAllServices();
    return NextResponse.json({ services });
  } catch (err) {
    console.error('[admin/services] list failed', err);
    return NextResponse.json({ error: 'Failed to load services' }, { status: 500 });
  }
}

// POST /api/admin/services — create a new service. Auto-slugs an id from the
// name when one isn't supplied.
export async function POST(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const errors = [];
  if (!body?.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('name is required');
  }
  if (!body?.categoryId || !VALID_CATEGORIES.has(body.categoryId)) {
    errors.push(`categoryId must be one of: ${[...VALID_CATEGORIES].join(', ')}`);
  }
  if (!Number.isInteger(body?.durationMinutes) || body.durationMinutes <= 0) {
    errors.push('durationMinutes must be a positive integer');
  }
  if (!Number.isInteger(body?.priceCents) || body.priceCents < 0) {
    errors.push('priceCents must be a non-negative integer');
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
  }

  try {
    const id = body.id?.trim() || (await makeUniqueServiceId(body.name));
    const service = await insertService({
      id,
      name: body.name.trim(),
      description: typeof body.description === 'string' ? body.description : '',
      categoryId: body.categoryId,
      durationMinutes: body.durationMinutes,
      priceCents: body.priceCents,
      depositCents: Number.isInteger(body.depositCents) ? body.depositCents : null,
      cancellationCents: Number.isInteger(body.cancellationCents) ? body.cancellationCents : null,
      isActive: body.isActive !== false,
      sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder : 999,
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (err) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'A service with that id already exists' }, { status: 409 });
    }
    console.error('[admin/services] create failed', err);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
