import { eq, asc, and } from 'drizzle-orm';
import { db } from './db';
import { services } from './db/schema';

// Mirror of the legacy categories enum from the static catalog. Categories
// affect site IA + the booking-flow tabs, so they're intentionally fixed in
// code; only the services within each category are editable from /admin.
export const SERVICE_CATEGORIES = [
  { id: 'skin-care', name: 'Skin Care' },
  { id: 'waxing', name: 'Waxing' },
  { id: 'self-care', name: 'Self Care' },
];

const CATEGORY_INDEX = new Map(SERVICE_CATEGORIES.map((c, i) => [c.id, i]));

// Convert a DB row → the shape the booking + home-page components already
// understand (matches the legacy static `service` object). priceNum, deposit,
// cancellationFee, duration are all derived strings/numbers.
function toUiService(row) {
  const dollars = Math.round(row.priceCents / 100);
  const formatDur = (mins) => {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
    }
    return `${mins} min`;
  };
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    duration: formatDur(row.durationMinutes),
    durationMinutes: row.durationMinutes,
    price: `$${dollars}`,
    priceNum: dollars,
    priceCents: row.priceCents,
    deposit: row.depositCents != null ? `$${Math.round(row.depositCents / 100)}` : null,
    depositCents: row.depositCents,
    cancellationFee:
      row.cancellationCents != null ? `$${Math.round(row.cancellationCents / 100)}` : null,
    cancellationCents: row.cancellationCents,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    categoryId: row.categoryId,
  };
}

// Public catalog: only active services, ordered by category enum then sortOrder.
// Returns the legacy [{ id, name, services }] shape so the booking flow + home
// menu render unchanged.
export async function listActiveServiceCategories() {
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.sortOrder), asc(services.name));
  const grouped = SERVICE_CATEGORIES.map((cat) => ({
    id: cat.id,
    name: cat.name,
    services: rows.filter((r) => r.categoryId === cat.id).map(toUiService),
  }));
  // Drop categories that ended up empty (e.g. all services in that category got disabled).
  return grouped.filter((g) => g.services.length > 0);
}

// Flat list of every active service for lookup by id (used by API routes).
export async function listActiveServices() {
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.isActive, true));
  return rows.map(toUiService);
}

// Map id → service for fast catalog lookups in the availability API etc.
export async function getServiceMap() {
  const list = await listActiveServices();
  return new Map(list.map((s) => [s.id, s]));
}

// Admin: list everything (active + inactive) for the /admin/services editor.
export async function listAllServices() {
  const rows = await db
    .select()
    .from(services)
    .orderBy(asc(services.categoryId), asc(services.sortOrder), asc(services.name));
  // Sort categories by the canonical order so the editor groups consistently.
  return rows
    .map(toUiService)
    .sort((a, b) => {
      const ca = CATEGORY_INDEX.get(a.categoryId) ?? 999;
      const cb = CATEGORY_INDEX.get(b.categoryId) ?? 999;
      if (ca !== cb) return ca - cb;
      return a.sortOrder - b.sortOrder;
    });
}

export async function getServiceById(id) {
  const rows = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return rows[0] ? toUiService(rows[0]) : null;
}

// Admin mutations — id is required for create (we keep slug-style ids for
// continuity with existing booking rows that reference services by id).
export async function insertService(values) {
  const inserted = await db
    .insert(services)
    .values({
      id: values.id,
      name: values.name,
      description: values.description ?? '',
      categoryId: values.categoryId,
      durationMinutes: values.durationMinutes,
      priceCents: values.priceCents,
      depositCents: values.depositCents ?? null,
      cancellationCents: values.cancellationCents ?? null,
      isActive: values.isActive ?? true,
      sortOrder: values.sortOrder ?? 999,
    })
    .returning();
  return inserted[0] ? toUiService(inserted[0]) : null;
}

export async function updateService(id, patch) {
  const allowed = {};
  for (const key of [
    'name',
    'description',
    'categoryId',
    'durationMinutes',
    'priceCents',
    'depositCents',
    'cancellationCents',
    'isActive',
    'sortOrder',
  ]) {
    if (patch[key] !== undefined) allowed[key] = patch[key];
  }
  if (Object.keys(allowed).length === 0) return getServiceById(id);
  allowed.updatedAt = new Date();
  const updated = await db
    .update(services)
    .set(allowed)
    .where(eq(services.id, id))
    .returning();
  return updated[0] ? toUiService(updated[0]) : null;
}

// Soft-delete: keep historical bookings able to resolve their service by id.
export async function archiveService(id) {
  const updated = await db
    .update(services)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(services.id, id))
    .returning();
  return updated[0] ? toUiService(updated[0]) : null;
}

// Build a slug from a service name, suffixing if it collides with an existing id.
export async function makeUniqueServiceId(name) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'service';
  let candidate = base;
  let n = 2;
  while (await getServiceById(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}
