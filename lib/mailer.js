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
