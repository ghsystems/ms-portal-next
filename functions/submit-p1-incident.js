import {
  authenticate,
  errorResponse,
  HttpError,
  json,
  preflight,
  readJson,
  requireMethod,
} from "../shared/http.js";
import { writeAuditLog } from "../shared/audit-log.js";
import {
  createServiceNowIncident,
  getServiceNowCredentials,
  uploadServiceNowAttachments,
} from "../shared/servicenow.js";
import { validateAttachments } from "./submit-service-request.js";
import { getEmailCredentials, sendTicketConfirmationEmail } from "../shared/email.js";

const SERVICE_NOW_CALLER_SYS_ID = "fecf626693f81a507ddb3f2efaba10a8";

function safeDisplayName(value, fallback) {
  const cleaned = String(value ?? "").replace(/[<>\r\n]/g, " ").trim().slice(0, 80);
  return cleaned || fallback;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    requireMethod(req, "POST");
    const { profile, sb } = await authenticate(req);

    if (!profile.p1_authorized) {
      await writeAuditLog(sb, {
        admin_user_id: profile.auth0_user_id,
        admin_email: profile.email,
        action_type: "access_denied",
        target_type: "endpoint",
        target_label: "/api/submit-p1-incident",
        details: "P1 submission attempted without p1_authorized",
        outcome: "failure",
      });
      throw new HttpError(403, "Forbidden: P1 authorization required");
    }

    let companyName = null;
    if (profile.client_id) {
      const { data: client } = await sb
        .from("clients")
        .select("name")
        .eq("id", profile.client_id)
        .maybeSingle();
      companyName = client?.name ?? null;
    }

    const body = await readJson(req);
    const { subject, description } = body;
    if (!subject?.trim() || !description?.trim()) {
      throw new HttpError(400, "Subject and description are required");
    }

    const files = validateAttachments(body.attachments);

    const creds = getServiceNowCredentials();
    if (!creds) throw new HttpError(503, "ServiceNow is not configured");

    // Requester identity comes from the verified profile, never the request body.
    const requesterEmail = profile.email;
    const requesterName = safeDisplayName(body.requesterName, requesterEmail);

    const incident = await createServiceNowIncident(creds, {
      short_description: `[P1 CRITICAL] ${subject.trim().slice(0, 140)}`,
      description: [
        "*** P1 CRITICAL INCIDENT — PRODUCTION DOWN ***",
        "Submitted through the GlassHouse Systems Client Portal.",
        "Request Type: Incident",
        `Requester: ${requesterName} <${requesterEmail}>`,
        "",
        description,
      ].join("\n"),
      category: "Incident",
      impact: "1",
      urgency: "1",
      caller_id: SERVICE_NOW_CALLER_SYS_ID,
      ...(companyName ? { correlation_id: companyName } : {}),
    });

    const attachmentError = files.length > 0
      ? await uploadServiceNowAttachments(creds, incident.sys_id, files)
      : undefined;

    const emailCreds = getEmailCredentials();
    const emailError = emailCreds
      ? await sendTicketConfirmationEmail(emailCreds, {
          to: requesterEmail,
          ticketNumber: incident.number,
          subject,
          isP1: true,
        })
      : "Email service not configured";

    await writeAuditLog(sb, {
      admin_user_id: profile.auth0_user_id,
      admin_email: profile.email,
      action_type: "submit_p1_incident",
      target_type: "ticket",
      target_label: incident.number,
      details: "P1 critical incident submitted",
    });

    return json(req, {
      success: true,
      ticketNumber: incident.number,
      sysId: incident.sys_id,
      ...(attachmentError ? { attachmentError } : {}),
      ...(emailError ? { emailError } : {}),
    });
  } catch (err) {
    return errorResponse(req, err);
  }
}
