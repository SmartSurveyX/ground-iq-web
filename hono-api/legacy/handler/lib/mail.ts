/**
 * Transactional email via Resend (https://resend.com).
 *
 * RESEND_API_KEY comes from the service env file. When it is missing the
 * helper logs and returns { sent: false } — email is best-effort, never a
 * reason for an API call to fail.
 *
 * Sender: smartsurveyx.com is verified in Resend, so mail may go to any
 * recipient from any address on the domain. MAIL_FROM (env) overrides the
 * default sender if a different address is preferred.
 */

const RESEND_API = "https://api.resend.com/emails";
const DEFAULT_FROM = "Smart Survey X <no-reply@smartsurveyx.com>";
const NOTIFY_TO = "smartsurveyx@gmail.com";

export type MailResult = { sent: boolean; id?: string; error?: string };

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}): Promise<MailResult> {
  const key = (Deno.env.get("RESEND_API_KEY") || "").trim();
  const envFrom = (Deno.env.get("MAIL_FROM") || "").trim();
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];
  const valid = to.filter((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t));
  if (!key || !valid.length) return { sent: false, error: key ? "no valid recipient" : "RESEND_API_KEY not set" };
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.from || envFrom || DEFAULT_FROM,
        to: valid,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (res.status !== 200) {
      console.error("resend send failed:", res.status, JSON.stringify(data).slice(0, 200));
      return { sent: false, error: String(data.message || `HTTP ${res.status}`) };
    }
    return { sent: true, id: data.id };
  } catch (e) {
    console.error("resend send error:", (e as Error)?.message || e);
    return { sent: false, error: (e as Error)?.message || "send failed" };
  }
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Credentials email for a newly created portal account. */
export function credentialsEmailHtml(opts: {
  name: string;
  username: string;
  password: string;
  role: string;
  loginUrl: string;
}): string {
  const roleLabel = opts.role === "sub_client_admin" ? "Sub Client Admin" : "Account";
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px">
      <h2 style="color:#1f4e9c;margin:0 0 8px">Smart Survey X — ${esc(roleLabel)} access</h2>
      <p>Hello ${esc(opts.name)},</p>
      <p>An account has been created for you. Sign in at
        <a href="${esc(opts.loginUrl)}">${esc(opts.loginUrl)}</a></p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Username</td>
            <td><b>${esc(opts.username)}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Password</td>
            <td><b>${esc(opts.password)}</b></td></tr>
      </table>
      <p style="color:#b91c1c">Please change this password after your first sign-in
        (Organization → profile). This message was sent by the Smart Survey X team.</p>
    </div>`;
}

/** Notify the platform inbox about a landing-page contact request. */
export function contactRequestNotifyHtml(opts: {
  name: string;
  email: string;
  purpose: string;
  message: string;
}): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
      <h2 style="color:#1f4e9c;margin:0 0 8px">New contact request</h2>
      <p><b>${esc(opts.name)}</b> &lt;${esc(opts.email)}&gt; — ${esc(opts.purpose)}</p>
      <p style="white-space:pre-wrap;background:#f8fafc;padding:10px;border-radius:8px">${esc(opts.message)}</p>
    </div>`;
}

export { NOTIFY_TO };
