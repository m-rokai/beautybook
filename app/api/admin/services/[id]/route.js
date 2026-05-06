import { NextResponse } from 'next/server';
import {
  archiveService,
  getServiceById,
  updateService,
} from '../../../../../lib/services-db';
import { getSession } from '../../../../../lib/auth-helpers';

const VALID_CATEGORIES = new Set(['skin-care', 'waxing', 'self-care']);

async function requireAdmin() {
  const session = await getSession();
  return session?.user?.isAdmin ? session : null;
}

// PATCH /api/admin/services/:id — update any subset of fields. All fields
// optional; sends null on the validator if you want to clear an override.
export async function PATCH(request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing service id' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate any fields that were supplied — leave undefined fields alone.
  const errors = [];
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    errors.push('name must be a non-empty string');
  }
  if (body.categoryId !== undefined && !VALID_CATEGORIES.has(body.categoryId)) {
    errors.push(`categoryId must be one of: ${[...VALID_CATEGORIES].join(', ')}`);
  }
  if (body.durationMinutes !== undefined && (!Number.isInteger(body.durationMinutes) || body.durationMinutes <= 0)) {
    errors.push('durationMinutes must be a positive integer');
  }
  if (body.priceCents !== undefined && (!Number.isInteger(body.priceCents) || body.priceCents < 0)) {
    errors.push('priceCents must be a non-negative integer');
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
  }

  try {
    const existing = await getServiceById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
    const service = await updateService(id, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
      ...(body.priceCents !== undefined ? { priceCents: body.priceCents } : {}),
      ...(body.depositCents !== undefined ? { depositCents: body.depositCents } : {}),
      ...(body.cancellationCents !== undefined ? { cancellationCents: body.cancellationCents } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    });
    return NextResponse.json({ service });
  } catch (err) {
    console.error('[admin/services/:id] update failed', err);
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

// DELETE /api/admin/services/:id — soft-delete (sets is_active=false). Keeps
// historical bookings able to resolve their service by id.
export async function DELETE(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing service id' }, { status: 400 });
  }

  try {
    const existing = await getServiceById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
    const service = await archiveService(id);
    return NextResponse.json({ service });
  } catch (err) {
    console.error('[admin/services/:id] delete failed', err);
    return NextResponse.json({ error: 'Failed to archive service' }, { status: 500 });
  }
}
