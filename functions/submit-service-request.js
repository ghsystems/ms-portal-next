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
  isAllowedAttachment,
  MAX_ATTACHMENT_BASE64_LENGTH_PER_FILE,
  MAX_ATTACHMENT_TOTAL_BASE64_LENGTH,
  SNOW_LEVEL,
  uploadServiceNowAttachments,
} from "../shared/servicenow.js";
import { getEmailCredentials, sendTicketConfirmationEmail } from "../shared/email.js";

const SERVICE_NOW_CALLER_SYS_ID = "fecf626693f81a507ddb3f2efaba10a8";
const REQUEST_TYPES = ["Incident", "Change Request", "Service Request"];
const LEVELS = ["High", "Medium", "Low"];

// The requester's display name is cosmetic; the email stamped alongside it is
// always the authenticated caller's. Strip anything that would break the
// "Requester: Name <email>" line that list-tickets parses back out.
function safeDisplayName(value, fallback) {
  const cleaned = String(value ?? "").replace(/[<>\r\n]/g, " ").trim().slice(0, 80);
  return cleaned || fallback;
}

/** Shared by submit-service-request and submit-p1-incident. */
export function validateAttachments(attachments) {
  if (attachments != null && !Array.isArray(attachments)) {
    throw new HttpError(400, "attachments must be an array");
  }
  const files = attachments ?? [];

  for (const file of files) {
    if (!file || typeof file.name !== "string" || typeof file.base64 !== "string") {
      throw new HttpError(400, "Each attachment needs a name and base64 content");
    }
    if (!isAllowedAttachment(file.name)) {
      throw new HttpError(400, `${file.name} is a file type that isn't allowed`);
    }
    if (file.base64.length > MAX_ATTACHMENT_BASE64_LENGTH_PER_FILE) {
      throw new HttpError(400, `${file.name} must be 50 MB or smaller`);
    }
  }

  const total = files.reduce((sum, file) => sum + file.base64.length, 0);
  if (total > MAX_ATTACHMENT_TOTAL_BASE64_LENGTH) {
    throw new HttpError(400, "Attachments must total 150 MB or smaller");
  }
  return files;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    requireMethod(req, "POST");
    // Previously this endpoint fetched the profile but never checked it existed,
    // so any valid tenant token — even one with no portal account — could open
    // ServiceNow incidents.
    const { profile, sb } = await authenticate(req);

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
    const { requestType, category, subject, description, impact, urgency, priority } = body;

    if (!REQUEST_TYPES.includes(requestType)) {
      throw new HttpError(400, "Invalid request type");
    }
    if (!LEVELS.includes(impact) || !LEVELS.includes(urgency)) {
      throw new HttpError(400, "Invalid impact or urgency");
    }
    if (!category?.trim() || !subject?.trim() || !description?.trim()) {
      throw new HttpError(400, "Missing required fields");
    }

    const files = validateAttachments(body.attachments);

    const creds = getServiceNowCredentials();
    if (!creds) throw new HttpError(503, "ServiceNow is not configured");

    // Requester identity comes from the verified profile, never the request body.
    const requesterEmail = profile.email;
    const requesterName = safeDisplayName(body.requesterName, requesterEmail);

    const incident = await createServiceNowIncident(creds, {
      short_description: subject.trim().slice(0, 160),
      description: [
        `Request Type: ${requestType}`,
        `Requester: ${requesterName} <${requesterEmail}>`,
        `Impact: ${impact} | Urgency: ${urgency} | Priority: ${priority ?? "Medium"}`,
        "",
        description,
      ].join("\n"),
      category: requestType,
      subcategory: category,
      impact: SNOW_LEVEL[impact] ?? "2",
      urgency: SNOW_LEVEL[urgency] ?? "2",
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
          isP1: false,
        })
      : "Email service not configured";

    await writeAuditLog(sb, {
      admin_user_id: profile.auth0_user_id,
      admin_email: profile.email,
      action_type: "submit_service_request",
      target_type: "ticket",
      target_label: incident.number,
      details: `${requestType} — ${category}`,
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
