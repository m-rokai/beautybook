// Pricing helpers shared by client (booking flow) + server (payments + balance
// link routes). Tiered deposit and cancellation amounts derived from the
// booking *total* — keeps multi-service bookings consistent with the existing
// per-service deposits in lib/demo-data.

const TIERS = [
  { maxCents: 3000, depositCents: 1000, cancellationCents: 1000 }, // < $30
  { maxCents: 6000, depositCents: 1500, cancellationCents: 1500 }, // $30–$59
  { maxCents: 10000, depositCents: 2000, cancellationCents: 1500 }, // $60–$99
];
const HIGH_TIER = { depositCents: 3000, cancellationCents: 2000 }; // $100+

function pickTier(totalCents) {
  for (const t of TIERS) {
    if (totalCents < t.maxCents) return t;
  }
  return HIGH_TIER;
}

export function depositForTotalCents(totalCents) {
  return pickTier(totalCents).depositCents;
}

export function cancellationForTotalCents(totalCents) {
  return pickTier(totalCents).cancellationCents;
}

// Square's note field is capped at 500 chars; quickPay.name at 255. Keep both
// human-readable when a customer chains many services together.
export function truncate(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}
