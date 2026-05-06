// Server-only SMTP mailer reusing the same Workspace App Password creds as Auth.js.
// Used for booking confirmations, balance-due notices, and any future transactional mail.
// Never import from a client component — `nodemailer` is Node-only.
import nodemailer from 'nodemailer';

const FROM_DISPLAY = 'Ashley Lacy Esthetics';

// Build the RFC-2822 From header. EMAIL_FROM may be either a bare email or
// the full `Display Name <addr>` form; if it's bare we attach the display
// name. Storing the bare form in env vars sidesteps the Vercel CLI's
// mishandling of angle brackets.
function fromHeader() {
  const raw = (process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER || '').trim();
  if (!raw) return '';
  if (raw.includes('<')) return raw;
  return `${FROM_DISPLAY} <${raw}>`;
}

let cached = null;

function getTransport() {
  if (cached) return cached;
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT || 465);
  if (!host || !process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD) {
    return null;
  }
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
  return cached;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function dollars(cents) {
  if (typeof cents !== 'number') return '—';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// Square-issued receipt URLs follow a strict format. Validate before rendering
// so smoke-test data or any future bug can't surface a broken link to the
// customer. The path segment after /receipt/preview/ must look like a real
// Square payment id (~20 chars, alphanumeric).
function isValidSquareReceiptUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/(squareup|squareupsandbox)\.com\/receipt\/preview\/[A-Za-z0-9]{16,}$/.test(url);
}

// Shared layout for transactional emails — purple gradient icon block + a
// centered card. `iconSvg` should be inline SVG markup (escaped or trusted
// — we only use it from server-side string templates).
function emailShell({ iconBg, iconSvg, eyebrow, headline, body, ctaUrl, ctaLabel }) {
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#f5f3f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#1a1722;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ece8f3;">
    <tr><td style="padding:36px 32px 8px;text-align:center;">
      <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:18px;background:${iconBg};color:#ffffff;text-align:center;box-shadow:0 8px 24px rgba(184,109,255,0.22);">${iconSvg}</div>
    </td></tr>
    <tr><td style="padding:0 32px 8px;text-align:center;">
      <p style="margin:18px 0 8px;color:#8a3fd0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;">${eyebrow}</p>
      <h1 style="margin:0 0 12px;font-size:26px;font-weight:500;letter-spacing:-0.01em;">${headline}</h1>
    </td></tr>
    <tr><td style="padding:8px 32px;">
      ${body}
    </td></tr>
    ${ctaUrl ? `
    <tr><td style="padding:0 32px 8px;text-align:center;">
      <a href="${ctaUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#b86dff,#8a3fd0);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:999px;box-shadow:0 8px 24px rgba(184,109,255,0.32);letter-spacing:0.01em;">${ctaLabel}</a>
    </td></tr>` : ''}
    <tr><td style="padding:24px 32px 32px;">
      <p style="margin:24px 0 0;color:#8a8196;font-size:12px;line-height:1.55;text-align:center;">
        Inside Muze Office · 6860 Bermuda Rd Ste 200, Las Vegas, NV 89119
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function summaryRow(label, value) {
  return `<tr><td style="color:#6b6478;padding:6px 0;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;line-height:1.5;"><strong>${escapeHtml(value)}</strong></td></tr>`;
}

export async function sendBookingConfirmation(booking) {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mailer] EMAIL_SERVER_* not configured — skipping confirmation email');
    return { skipped: true };
  }

  const to = booking.customerEmail;
  if (!to) return { skipped: true };

  const from = fromHeader();
  const subject = `Booking confirmed — ${booking.serviceName} (${booking.code})`;

  const addOnLine = Array.isArray(booking.addOnNames) && booking.addOnNames.length
    ? `<tr><td style="color:#6b6478;padding:6px 0;">Add-ons</td><td style="padding:6px 0;">${escapeHtml(booking.addOnNames.join(', '))}</td></tr>`
    : '';
  const balanceLine = booking.remainingCents > 0
    ? `<tr><td style="color:#6b6478;padding:6px 0;">Balance due at appointment</td><td style="padding:6px 0;"><strong>${dollars(booking.remainingCents)}</strong></td></tr>`
    : '';
  const receiptUrl = isValidSquareReceiptUrl(booking.depositSquareReceiptUrl)
    ? booking.depositSquareReceiptUrl
    : null;
  const receiptLine = receiptUrl
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(receiptUrl)}" style="color:#7c5cc7;">View Square receipt →</a></p>`
    : '';

  const html = `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#f5f3f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#1a1722;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ece8f3;">
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 8px;color:#8a3fd0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;">Ashley Lacy Esthetics</p>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:500;letter-spacing:-0.01em;">Booking confirmed.</h1>
      <p style="margin:0 0 8px;color:#6b6478;font-size:15px;line-height:1.6;">Hi ${escapeHtml(booking.customerName || 'there')} — your appointment is on the books.</p>
      <p style="margin:0;color:#8a8196;font-size:13px;">Reference <strong style="color:#1a1722;">${escapeHtml(booking.code)}</strong></p>
    </td></tr>
    <tr><td style="padding:24px 32px;">
      <table role="presentation" width="100%" style="border-top:1px solid #ece8f3;font-size:14px;">
        <tr><td style="color:#6b6478;padding:14px 0 6px;vertical-align:top;">Service${booking.serviceName?.includes(' + ') ? 's' : ''}</td><td style="padding:14px 0 6px;line-height:1.5;"><strong>${escapeHtml(booking.serviceName)}</strong></td></tr>
        ${addOnLine}
        <tr><td style="color:#6b6478;padding:6px 0;">Date</td><td style="padding:6px 0;">${escapeHtml(booking.scheduledDate)}</td></tr>
        <tr><td style="color:#6b6478;padding:6px 0;">Time</td><td style="padding:6px 0;">${escapeHtml(booking.scheduledTimeLabel)}</td></tr>
        <tr><td colspan="2" style="border-top:1px solid #ece8f3;height:8px;"></td></tr>
        <tr><td style="color:#6b6478;padding:6px 0;">Service total</td><td style="padding:6px 0;">${dollars(booking.totalCents)}</td></tr>
        <tr><td style="color:#6b6478;padding:6px 0;">Charged today</td><td style="padding:6px 0;"><strong>${dollars(booking.depositCents)}</strong></td></tr>
        ${balanceLine}
      </table>
      ${receiptLine}
    </td></tr>
    <tr><td style="padding:0 32px;">
      <table role="presentation" width="100%" style="border-top:1px solid #ece8f3;font-size:14px;margin-top:8px;">
        <tr><td style="color:#6b6478;padding:14px 0 6px;vertical-align:top;">Where</td><td style="padding:14px 0 6px;line-height:1.5;">
          Inside <a href="https://muzeoffice.com" style="color:#8a3fd0;font-weight:600;">Muze Office</a><br>
          6860 Bermuda Rd, Suite 200<br>
          Las Vegas, NV 89119<br>
          <a href="https://www.google.com/maps/search/?api=1&query=Muze+Office+6860+Bermuda+Rd+Ste+200+Las+Vegas+NV+89119" style="color:#7c5cc7;font-size:13px;">Open in Maps →</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 32px;">
      <p style="margin:24px 0 0;color:#8a8196;font-size:12px;line-height:1.6;">
        Need to reschedule or cancel? Use your reference <strong>${escapeHtml(booking.code)}</strong> at the customer portal — free outside 24 hours of your appointment.
      </p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Ashley Lacy Esthetics — booking confirmed`,
    ``,
    `Hi ${booking.customerName || 'there'},`,
    `Your appointment is confirmed.`,
    ``,
    `Reference:    ${booking.code}`,
    `Service:      ${booking.serviceName}${booking.addOnNames?.length ? ` (+ ${booking.addOnNames.join(', ')})` : ''}`,
    `Date:         ${booking.scheduledDate}`,
    `Time:         ${booking.scheduledTimeLabel}`,
    `Total:        ${dollars(booking.totalCents)}`,
    `Charged:      ${dollars(booking.depositCents)}`,
    booking.remainingCents > 0 ? `Balance due:  ${dollars(booking.remainingCents)} at the appointment` : `Paid in full.`,
    ``,
    `Where:        Inside Muze Office`,
    `              6860 Bermuda Rd, Suite 200`,
    `              Las Vegas, NV 89119`,
    receiptUrl ? `\nReceipt: ${receiptUrl}` : '',
    ``,
    `Need to reschedule? Use reference ${booking.code} at the customer portal — free outside 24 hours.`,
  ].filter(Boolean).join('\n');

  try {
    const info = await transport.sendMail({ from, to, subject, html, text });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] sendBookingConfirmation failed', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Branded admin magic-link email. Each subject carries a unique timestamp so
 * Gmail doesn't bulk-group repeat sign-in attempts (which made every send
 * after the first one disappear into Spam / All Mail without notification).
 */
export async function sendAdminMagicLink({ to, url, host }) {
  const transport = getTransport();
  if (!transport) {
    throw new Error('EMAIL_SERVER_* not configured');
  }

  const from = fromHeader();
  const sentAt = new Date();
  const stamp = sentAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  });
  const subject = `Sign in to Ashley Lacy Esthetics · ${stamp}`;

  const safeUrl = escapeHtml(url);
  const safeHost = escapeHtml(host || '');

  const html = `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#f5f3f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#1a1722;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ece8f3;">
    <tr><td style="padding:36px 32px 8px;text-align:center;">
      <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:16px;background:linear-gradient(135deg,#b86dff,#8a3fd0);color:#ffffff;font-size:24px;text-align:center;box-shadow:0 8px 24px rgba(184,109,255,0.32);">🔑</div>
    </td></tr>
    <tr><td style="padding:0 32px;text-align:center;">
      <p style="margin:18px 0 8px;color:#8a3fd0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;">Admin access</p>
      <h1 style="margin:0 0 12px;font-size:26px;font-weight:500;letter-spacing:-0.01em;">Sign in to your dashboard.</h1>
      <p style="margin:0 0 28px;color:#6b6478;font-size:15px;line-height:1.6;">Tap the button below to finish signing in. The link works once and expires in 24 hours.</p>
    </td></tr>
    <tr><td style="padding:0 32px 8px;text-align:center;">
      <a href="${safeUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#b86dff,#8a3fd0);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:999px;box-shadow:0 8px 24px rgba(184,109,255,0.32);letter-spacing:0.01em;">Sign in →</a>
    </td></tr>
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0;color:#8a8196;font-size:12px;line-height:1.6;text-align:center;word-break:break-all;">
        Or paste this link into your browser:<br>
        <a href="${safeUrl}" style="color:#7c5cc7;">${safeUrl}</a>
      </p>
    </td></tr>
    <tr><td style="padding:24px 32px 32px;">
      <p style="margin:24px 0 0;color:#8a8196;font-size:12px;line-height:1.55;text-align:center;">
        If you didn&rsquo;t request this, you can safely ignore this email — nobody can sign in without clicking the link above.
      </p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Sign in to Ashley Lacy Esthetics`,
    ``,
    `Tap (or paste) this link to finish signing in:`,
    url,
    ``,
    `The link works once and expires in 24 hours.`,
    ``,
    `If you didn't request this, you can safely ignore this email.`,
    safeHost ? `\nRequested at ${stamp} for ${host}.` : '',
  ].filter(Boolean).join('\n');

  try {
    const info = await transport.sendMail({ from, to, subject, html, text });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] sendAdminMagicLink failed', err);
    throw err;
  }
}

// ── Booking update notice (services or add-ons changed by admin) ──

export async function sendBookingUpdateNotice(booking, { changes = [] } = {}) {
  const transport = getTransport();
  if (!transport) return { skipped: true };
  if (!booking?.customerEmail) return { skipped: true };

  const subject = `Update to your booking — ${booking.code}`;
  const stamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  });

  const changeLines = changes.length
    ? `<ul style="padding-left:18px;margin:12px 0;color:#1a1722;font-size:14px;line-height:1.6;">${changes
        .map((c) => `<li>${escapeHtml(c)}</li>`)
        .join('')}</ul>`
    : '';

  const balanceLine =
    booking.remainingCents > 0
      ? `<p style="margin:14px 0 0;color:#6b6478;font-size:14px;line-height:1.55;">A balance of <strong style="color:#1a1722;">${dollars(booking.remainingCents)}</strong> will be due at your appointment.</p>`
      : '';

  const body = `
    <p style="margin:0 0 8px;color:#6b6478;font-size:15px;line-height:1.65;text-align:center;">
      Hi ${escapeHtml(booking.customerName || 'there')} — we made a change to your booking on ${escapeHtml(stamp)}.
    </p>
    <table role="presentation" width="100%" style="margin-top:20px;border-top:1px solid #ece8f3;font-size:14px;">
      ${summaryRow('Reference', booking.code)}
      ${summaryRow('Service' + (booking.serviceName?.includes(' + ') ? 's' : ''), booking.serviceName)}
      ${booking.addOnNames?.length ? summaryRow('Add-ons', booking.addOnNames.join(', ')) : ''}
      ${summaryRow('Date', booking.scheduledDate)}
      ${summaryRow('Time', booking.scheduledTimeLabel)}
      ${summaryRow('New total', dollars(booking.totalCents))}
      ${summaryRow('Already paid', dollars(booking.depositCents))}
    </table>
    ${changeLines}
    ${balanceLine}
  `;

  const html = emailShell({
    iconBg: 'linear-gradient(135deg,#b86dff,#8a3fd0)',
    iconSvg: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    eyebrow: 'Booking updated',
    headline: 'Your booking changed.',
    body,
  });

  const text = [
    `Ashley Lacy Esthetics — booking updated`,
    ``,
    `Hi ${booking.customerName || 'there'},`,
    `Your booking was updated on ${stamp}.`,
    ``,
    `Reference:    ${booking.code}`,
    `Service:      ${booking.serviceName}${booking.addOnNames?.length ? ` (+ ${booking.addOnNames.join(', ')})` : ''}`,
    `Date:         ${booking.scheduledDate}`,
    `Time:         ${booking.scheduledTimeLabel}`,
    `New total:    ${dollars(booking.totalCents)}`,
    `Already paid: ${dollars(booking.depositCents)}`,
    booking.remainingCents > 0 ? `Balance:      ${dollars(booking.remainingCents)} due at appointment` : '',
    changes.length ? `\nChanges:\n${changes.map((c) => `  · ${c}`).join('\n')}` : '',
    ``,
    `Reply to this email if anything looks off.`,
  ].filter(Boolean).join('\n');

  try {
    const info = await transport.sendMail({ from: fromHeader(), to: booking.customerEmail, subject, html, text });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] sendBookingUpdateNotice failed', err);
    return { ok: false, error: err.message };
  }
}

// ── Cancellation notice ──

export async function sendBookingCancellationNotice(booking, { refundCents = 0 } = {}) {
  const transport = getTransport();
  if (!transport) return { skipped: true };
  if (!booking?.customerEmail) return { skipped: true };

  const subject = `Booking cancelled — ${booking.code}`;
  const refundLine =
    refundCents > 0
      ? `<p style="margin:14px 0 0;color:#1a1722;font-size:14px;line-height:1.55;">A refund of <strong>${dollars(refundCents)}</strong> has been issued to your original payment method. It typically appears within 5–10 business days.</p>`
      : '';

  const body = `
    <p style="margin:0 0 8px;color:#6b6478;font-size:15px;line-height:1.65;text-align:center;">
      Hi ${escapeHtml(booking.customerName || 'there')} — your appointment has been cancelled.
    </p>
    <table role="presentation" width="100%" style="margin-top:20px;border-top:1px solid #ece8f3;font-size:14px;">
      ${summaryRow('Reference', booking.code)}
      ${summaryRow('Service' + (booking.serviceName?.includes(' + ') ? 's' : ''), booking.serviceName)}
      ${summaryRow('Was scheduled for', `${booking.scheduledDate} · ${booking.scheduledTimeLabel}`)}
    </table>
    ${refundLine}
    <p style="margin:18px 0 0;color:#6b6478;font-size:14px;line-height:1.55;text-align:center;">
      Want to rebook? <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://beauty-booking-three.vercel.app'}/booking" style="color:#7c5cc7;">Pick a new time</a>.
    </p>
  `;

  const html = emailShell({
    iconBg: 'linear-gradient(135deg,#f87171,#b91c1c)',
    iconSvg: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    eyebrow: 'Booking cancelled',
    headline: 'Your appointment was cancelled.',
    body,
  });

  const text = [
    `Ashley Lacy Esthetics — booking cancelled`,
    ``,
    `Hi ${booking.customerName || 'there'},`,
    `Your appointment has been cancelled.`,
    ``,
    `Reference: ${booking.code}`,
    `Service:   ${booking.serviceName}`,
    `Was for:   ${booking.scheduledDate} · ${booking.scheduledTimeLabel}`,
    refundCents > 0 ? `Refund:    ${dollars(refundCents)} issued to your card (5–10 business days)` : '',
    ``,
    `Want to rebook? https://beauty-booking-three.vercel.app/booking`,
  ].filter(Boolean).join('\n');

  try {
    const info = await transport.sendMail({ from: fromHeader(), to: booking.customerEmail, subject, html, text });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] sendBookingCancellationNotice failed', err);
    return { ok: false, error: err.message };
  }
}

// ── 24-hour reminder ──

export async function sendBookingReminder(booking) {
  const transport = getTransport();
  if (!transport) return { skipped: true };
  if (!booking?.customerEmail) return { skipped: true };

  const subject = `Tomorrow at ${booking.scheduledTimeLabel} — Ashley Lacy Esthetics`;

  const balanceLine =
    booking.remainingCents > 0
      ? `<p style="margin:14px 0 0;color:#1a1722;font-size:14px;line-height:1.55;">Balance due at appointment: <strong>${dollars(booking.remainingCents)}</strong>. We accept card or cash.</p>`
      : `<p style="margin:14px 0 0;color:#4ade80;font-size:14px;line-height:1.55;text-align:center;">Paid in full — nothing to bring.</p>`;

  const body = `
    <p style="margin:0 0 8px;color:#6b6478;font-size:15px;line-height:1.65;text-align:center;">
      Hi ${escapeHtml(booking.customerName || 'there')} — see you tomorrow.
    </p>
    <table role="presentation" width="100%" style="margin-top:20px;border-top:1px solid #ece8f3;font-size:14px;">
      ${summaryRow('Service' + (booking.serviceName?.includes(' + ') ? 's' : ''), booking.serviceName)}
      ${booking.addOnNames?.length ? summaryRow('Add-ons', booking.addOnNames.join(', ')) : ''}
      ${summaryRow('When', `${booking.scheduledDate} at ${booking.scheduledTimeLabel}`)}
      ${summaryRow('Where', 'Inside Muze Office · 6860 Bermuda Rd Ste 200, Las Vegas, NV 89119')}
      ${summaryRow('Reference', booking.code)}
    </table>
    ${balanceLine}
    <p style="margin:18px 0 0;color:#8a8196;font-size:13px;line-height:1.55;text-align:center;">
      Need to reschedule? Use code <strong style="color:#1a1722;">${escapeHtml(booking.code)}</strong> at the customer portal — free outside 24 hours.
    </p>
  `;

  const html = emailShell({
    iconBg: 'linear-gradient(135deg,#b86dff,#8a3fd0)',
    iconSvg: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    eyebrow: 'See you tomorrow',
    headline: 'Your appointment is tomorrow.',
    body,
    ctaUrl: 'https://www.google.com/maps/search/?api=1&query=Muze+Office+6860+Bermuda+Rd+Ste+200+Las+Vegas+NV+89119',
    ctaLabel: 'Open in Maps',
  });

  const text = [
    `Ashley Lacy Esthetics — reminder for tomorrow`,
    ``,
    `Hi ${booking.customerName || 'there'},`,
    `See you tomorrow at ${booking.scheduledTimeLabel}.`,
    ``,
    `Service:   ${booking.serviceName}${booking.addOnNames?.length ? ` (+ ${booking.addOnNames.join(', ')})` : ''}`,
    `When:      ${booking.scheduledDate} at ${booking.scheduledTimeLabel}`,
    `Where:     Inside Muze Office`,
    `           6860 Bermuda Rd Ste 200, Las Vegas, NV 89119`,
    `Reference: ${booking.code}`,
    booking.remainingCents > 0 ? `\nBalance:   ${dollars(booking.remainingCents)} due at appointment` : `\nPaid in full.`,
    ``,
    `Need to reschedule? Use code ${booking.code} at the customer portal — free outside 24 hours.`,
  ].filter(Boolean).join('\n');

  try {
    const info = await transport.sendMail({ from: fromHeader(), to: booking.customerEmail, subject, html, text });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] sendBookingReminder failed', err);
    return { ok: false, error: err.message };
  }
}
