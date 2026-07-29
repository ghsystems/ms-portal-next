import { authenticate, errorResponse, HttpError, json, preflight, requireMethod } from "../shared/http.js";
import {
  getServiceNowComments,
  getServiceNowCredentials,
  queryServiceNowIncidents,
  SNOW_LEVEL_REVERSE,
  SNOW_STATE_TO_PORTAL_STATUS,
} from "../shared/servicenow.js";

const METHODS = "GET, OPTIONS";
const REQUEST_TYPES = ["Incident", "Change Request", "Service Request"];

// ServiceNow's OOB priority field (1=Critical .. 5=Planning) — more authoritative
// than recomputing from impact/urgency, since ServiceNow already derives it.
const SNOW_PRIORITY_TO_PORTAL = {
  "1": "Critical",
  "2": "High",
  "3": "Medium",
  "4": "Low",
  "5": "Low",
};

// submit-service-request/submit-p1-incident stamp these lines into the description at
// creation time, since ServiceNow's `category` choice field and `caller_id` reference
// field silently drop values that don't match its own constraints (custom request-type
// strings, plain-email caller lookups). Parsing them back is more reliable than trusting
// those fields round-tripped.
function parseDescriptionField(description, label) {
  return description.match(new RegExp(`^${label}: (.+)$`, "m"))?.[1]?.trim() || null;
}

function normalizeServiceNowDate(value) {
  if (!value) return value;
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
}

function mapIncident(row) {
  const description = row.description || "";

  const parsedRequestType = parseDescriptionField(description, "Request Type");
  const requestType = parsedRequestType && REQUEST_TYPES.includes(parsedRequestType)
    ? parsedRequestType
    : REQUEST_TYPES.includes(row.category)
      ? row.category
      : "Service Request";

  const requesterMatch = description.match(/^Requester: (.+?) <(.+?)>$/m);
  const requester = requesterMatch?.[1] || row["caller_id.name"] || "Unknown";

  return {
    id: row.number,
    sysId: row.sys_id,
    subject: row.short_description || "(no subject)",
    description,
    requestType,
    category: row.subcategory || "General",
    status: SNOW_STATE_TO_PORTAL_STATUS[row.state] ?? "Open",
    impact: SNOW_LEVEL_REVERSE[row.impact] ?? "Medium",
    urgency: SNOW_LEVEL_REVERSE[row.urgency] ?? "Medium",
    priority: SNOW_PRIORITY_TO_PORTAL[row.priority] ?? "Medium",
    requester,
    createdAt: normalizeServiceNowDate(row.opened_at),
    updatedAt: normalizeServiceNowDate(row.sys_updated_on),
  };
}

// ServiceNow encoded queries use ^ as the term separator and , inside value lists,
// so a value carrying either could widen the filter past this client's own tickets.
function assertSafeQueryValue(value, label) {
  if (typeof value !== "string" || !value || /[\^,=<>]/.test(value)) {
    throw new HttpError(500, `Client configuration error (${label})`);
  }
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    requireMethod(req, "GET");
    const { profile, sb } = await authenticate(req);

    if (!profile.client_id) throw new HttpError(403, "No client assigned to this account.");
    if (!profile.email || !/^[^\s^,=<>]+@[^\s^,=<>]+$/.test(profile.email)) {
      throw new HttpError(500, "Account email is missing or invalid.");
    }

    const { data: client } = await sb
      .from("clients")
      .select("name, servicenow_company_sys_id")
      .eq("id", profile.client_id)
      .maybeSingle();

    if (!client) throw new HttpError(500, "Client configuration error.");

    const creds = getServiceNowCredentials();
    if (!creds) throw new HttpError(503, "ServiceNow is not configured");

    const companySysId = client.servicenow_company_sys_id;
    const isValidSysId = companySysId && /^[0-9a-fA-F]{32}$/.test(companySysId);
    // ponytail: until real ServiceNow company sys_ids are set per client, fall back to
    // matching the mock company name stamped on `correlation_id` at ticket creation.
    let companyFilter = null;
    if (isValidSysId) {
      companyFilter = `company=${companySysId}`;
    } else if (client.name) {
      assertSafeQueryValue(client.name, "client name");
      companyFilter = `correlation_id=${client.name}`;
    }

    const sysparmQuery = companyFilter
      ? `${companyFilter}^ORcaller_id.email=${profile.email}`
      : `caller_id.email=${profile.email}`;

    const rows = await queryServiceNowIncidents(creds, sysparmQuery);
    const tickets = rows.map(mapIncident);

    const sysId = new URL(req.url).searchParams.get("sys_id");

    if (sysId) {
      if (!/^[0-9a-fA-F]{32}$/.test(sysId)) throw new HttpError(400, "Invalid ticket id");

      const matchedRow = rows.find((row) => row.sys_id === sysId);
      if (!matchedRow) throw new HttpError(404, "Ticket not found");

      const comments = await getServiceNowComments(creds, sysId);
      const activityLog = comments.map((comment) => ({
        id: comment.sys_id,
        actor: comment.sys_created_by || "ServiceNow",
        message: comment.value,
        timestamp: normalizeServiceNowDate(comment.sys_created_on),
      }));

      return json(
        req,
        { ticket: { ...mapIncident(matchedRow), activityLog }, company: client.name ?? null },
        200,
        METHODS,
      );
    }

    return json(req, { tickets, company: client.name ?? null }, 200, METHODS);
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
