export function getEmailCredentials() {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.PORTAL_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      return null;
    }

    return { apiKey, fromEmail };
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Best-effort: returns an error message on failure instead of throwing, so a failed
  // confirmation email never rolls back a ticket that was already created successfully.
  export async function sendTicketConfirmationEmail(creds, opts) {
    try {
      const emailSubject = opts.isP1
        ? `[P1 CRITICAL] Ticket ${opts.ticketNumber} received`
        : `Ticket ${opts.ticketNumber} received`;

      const followUp = opts.isP1
        ? "Our team has been notified and will respond as soon as possible."
        : "Our team will follow up shortly.";

      const text = [
        `Your ${opts.isP1 ? "P1 critical incident" : "service request"} has been received.`,
        "",
        `Ticket number: ${opts.ticketNumber}`,
        `Subject: ${opts.subject}`,
        "",
        followUp,
        "",
        "GlassHouse Systems Client Portal",
      ].join("\n");

      const accent = opts.isP1 ? "#e11d48" : "#059669";
      const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;padding:32px 16px;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#0f172a;padding:20px 28px;">
            <img src="https://ms-portal-orcin.vercel.app/ghsystems.png" alt="GlassHouse Systems" height="28" style="display:block;height:28px;" />
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 16px;font-size:16px;color:#0f172a;">
              Your ${opts.isP1 ? "<strong>P1 critical incident</strong>" : "service request"} has been received.
            </p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:13px;">Ticket number</td>
                <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(opts.ticketNumber)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:13px;">Subject</td>
                <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(opts.subject)}</td>
              </tr>
            </table>
            <p style="margin:0;padding:12px 16px;border-radius:10px;background:${accent}1a;color:${accent};font-size:13px;font-weight:600;">
              ${followUp}
            </p>
          </div>
          <div style="padding:16px 28px;border-top:1px solid #e5e7eb;color:#94a3b8;font-size:12px;">
            GlassHouse Systems Client Portal
          </div>
        </div>
      </div>`;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.apiKey}`,
        },
        body: JSON.stringify({
          from: creds.fromEmail,
          to: [opts.to],
          subject: emailSubject,
          text,
          html,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return err.message ?? `Email service returned ${resp.status}`;
      }

      return undefined;
    } catch (err) {
      return err instanceof Error ? err.message : "Confirmation email failed";
    }
  }
