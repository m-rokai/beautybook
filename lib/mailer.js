// Server-only SMTP mailer reusing the same Workspace App Password creds as Auth.js.
// Used for booking confirmations, balance-due notices, and any future transactional mail.
// Never import from a client component — `nodemailer` is Node-only.
import nodemailer from 'nodemailer';

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

export async function sendBookingConfirmation(booking) {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mailer] EMAIL_SERVER_* not configured — skipping confirmation email');
    return { skipped: true };
  }

  const to = booking.customerEmail;
  if (!to) return { skipped: true };

  const from = process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER;
  const subject = `Booking confirmed — ${booking.serviceName} (${booking.code})`;

  const addOnLine = Array.isArray(booking.addOnNames) && booking.addOnNames.length
    ? `<tr><td style="color:#6b6478;padding:6px 0;">Add-ons</td><td style="padding:6px 0;">${escapeHtml(booking.addOnNames.join(', '))}</td></tr>`
    : '';
  const balanceLine = booking.remainingCents > 0
    ? `<tr><td style="color:#6b6478;padding:6px 0;">Balance due at appointment</td><td style="padding:6px 0;"><strong>${dollars(booking.remainingCents)}</strong></td></tr>`
    : '';
  const receiptLine = booking.depositSquareReceiptUrl
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(booking.depositSquareReceiptUrl)}" style="color:#7c5cc7;">View Square receipt →</a></p>`
    : '';

  const html = `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#f5f3f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#1a1722;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ece8f3;">
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 8px;color:#b8903e;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;">Ashley Lacy Aesthetics</p>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:500;letter-spacing:-0.01em;">Booking confirmed.</h1>
      <p style="margin:0 0 8px;color:#6b6478;font-size:15px;line-height:1.6;">Hi ${escapeHtml(booking.customerName || 'there')} — your appointment is on the books.</p>
      <p style="margin:0;color:#8a8196;font-size:13px;">Reference <strong style="color:#1a1722;">${escapeHtml(booking.code)}</strong></p>
    </td></tr>
    <tr><td style="padding:24px 32px;">
      <table role="presentation" width="100%" style="border-top:1px solid #ece8f3;font-size:14px;">
        <tr><td style="color:#6b6478;padding:14px 0 6px;">Service</td><td style="padding:14px 0 6px;"><strong>${escapeHtml(booking.serviceName)}</strong></td></tr>
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
    <tr><td style="padding:0 32px 32px;">
      <p style="margin:24px 0 0;color:#8a8196;font-size:12px;line-height:1.6;">
        Need to reschedule or cancel? Use your reference <strong>${escapeHtml(booking.code)}</strong> at the customer portal — free outside 24 hours of your appointment.
      </p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Ashley Lacy Aesthetics — booking confirmed`,
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
    booking.depositSquareReceiptUrl ? `\nReceipt: ${booking.depositSquareReceiptUrl}` : '',
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
