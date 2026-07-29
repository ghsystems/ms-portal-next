// 1 = High, 2 = Medium, 3 = Low — confirm these match your instance config.
  export const SNOW_LEVEL = {
    High: "1",
    Medium: "2",
    Low: "3",
  };

  // Reverse of SNOW_LEVEL — used to map ServiceNow impact/urgency codes back to
  // portal labels when reading incidents. ServiceNow only has 3 levels, so
  // "Critical"/"Immediate" never come back from this map.
  export const SNOW_LEVEL_REVERSE = {
    "1": "High",
    "2": "Medium",
    "3": "Low",
  };

  // ServiceNow's default out-of-box incident "state" values — confirm these
  // match your instance config (some instances customize state numbers).
  export const SNOW_STATE_TO_PORTAL_STATUS = {
    "1": "Open", // New
    "2": "In Progress",
    "3": "In Progress", // On Hold
    "6": "Resolved",
    "7": "Resolved", // Closed
    "8": "Resolved", // Cancelled
  };
  
  // Mirrored client-side in lib/attachments.ts (that copy is UX-only — this is
  // the one that actually blocks anything, since client validation is bypassable
  // by calling the function directly).
  //
  // Allowlist, not a blocklist. The old blocklist named 11 extensions and let
  // .html, .svg, .hta, .lnk, .iso, .reg and .wsf through untouched; enumerating
  // dangerous file types is a losing game.
  export const ALLOWED_ATTACHMENT_EXTENSIONS = [
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".csv", ".txt", ".log", ".rtf", ".md",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".heic",
    ".zip", ".7z", ".gz", ".eml", ".msg", ".json", ".xml", ".yaml", ".yml",
  ];

  export function isAllowedAttachment(fileName) {
    const name = String(fileName ?? "");
    // Reject path separators and control characters outright — the file name is
    // forwarded to ServiceNow's attachment API as a query parameter.
    // eslint-disable-next-line no-control-regex
    if (/[\\/\x00-\x1f]/.test(name)) return false;
    const lower = name.toLowerCase();
    return ALLOWED_ATTACHMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
  }

  export const MAX_ATTACHMENT_BYTES_PER_FILE = 50 * 1024 * 1024; // 50 MB per file
  export const MAX_ATTACHMENT_TOTAL_BYTES = 150 * 1024 * 1024; // 150 MB total per request
  // Base64 inflates raw bytes by ~4/3 — compare incoming base64 string lengths against these.
  export const MAX_ATTACHMENT_BASE64_LENGTH_PER_FILE = Math.ceil(
    (MAX_ATTACHMENT_BYTES_PER_FILE * 4) / 3,
  );
  export const MAX_ATTACHMENT_TOTAL_BASE64_LENGTH = Math.ceil(
    (MAX_ATTACHMENT_TOTAL_BYTES * 4) / 3,
  );
  
  export function getServiceNowCredentials() {
    const instance = process.env.SERVICENOW_INSTANCE_URL;
    const user = process.env.SERVICENOW_USERNAME;
    const pass = process.env.SERVICENOW_PASSWORD;
  
    if (!instance || !user || !pass) {
      return null;
    }
  
    // Basic auth encodes "username:password" in base64. ServiceNow's Table API accepts this out of the box.
    return { instance, basicAuth: btoa(`${user}:${pass}`) };
  }
  
  export async function createServiceNowIncident(creds, record) {
    const resp = await fetch(`${creds.instance}/api/now/table/incident`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${creds.basicAuth}`,
      },
      body: JSON.stringify(record),
    });
  
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = err.error?.message
        ?? `ServiceNow returned ${resp.status}`;
      throw new Error(msg);
    }

    const data = await resp.json();
    return data.result;
  }

  const INCIDENT_FIELDS = [
    "sys_id",
    "number",
    "short_description",
    "description",
    "category",
    "subcategory",
    "impact",
    "urgency",
    "priority",
    "state",
    "opened_at",
    "sys_updated_on",
    "caller_id.name",
  ].join(",");
  
  export async function queryServiceNowIncidents(creds, sysparmQuery, limit = 200) {
    const url =
      `${creds.instance}/api/now/table/incident` +
      `?sysparm_query=${encodeURIComponent(sysparmQuery)}` +
      `&sysparm_fields=${INCIDENT_FIELDS}` +
      `&sysparm_limit=${limit}` +
      `&sysparm_display_value=false`;
  
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${creds.basicAuth}`,
      },
    });
  
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = err.error?.message
        ?? `ServiceNow returned ${resp.status}`;
      throw new Error(msg);
    }

    const data = await resp.json();
    return data.result;
  }

  // Fetches only customer-visible "comments" (never internal work_notes) for an
  // incident, ordered oldest first so they read like an activity log.
  export async function getServiceNowComments(creds, incidentSysId) {
    const url =
      `${creds.instance}/api/now/table/sys_journal_field` +
      `?sysparm_query=${encodeURIComponent(
        `element_id=${incidentSysId}^element=comments^ORDERBYsys_created_on`,
      )}` +
      `&sysparm_fields=${["sys_id", "value", "sys_created_on", "sys_created_by"].join(",")}`;
  
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${creds.basicAuth}`,
      },
    });
  
    if (!resp.ok) return [];
  
    const data = await resp.json();
    return data.result;
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  
  // Best-effort: returns an error message on failure instead of throwing, so a failed
  // attachment upload never rolls back an incident that was already created successfully.
  export async function uploadServiceNowAttachment(creds, sysId, fileName, mimeType, base64) {
    try {
      const resp = await fetch(
        `${creds.instance}/api/now/attachment/file` +
          `?table_name=incident&table_sys_id=${sysId}` +
          `&file_name=${encodeURIComponent(fileName)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": mimeType || "application/octet-stream",
            Accept: "application/json",
            Authorization: `Basic ${creds.basicAuth}`,
          },
          body: base64ToBytes(base64),
        },
      );
  
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return err.error?.message
          ?? `ServiceNow returned ${resp.status}`;
      }
  
      return undefined;
    } catch (err) {
      return err instanceof Error ? err.message : "Attachment upload failed";
    }
  }
  
  // Uploads each attachment in sequence and returns a single combined error
  // message (or undefined if every file uploaded cleanly).
  export async function uploadServiceNowAttachments(creds, sysId, attachments) {
    const errors = [];
    for (const attachment of attachments) {
      const error = await uploadServiceNowAttachment(
        creds,
        sysId,
        attachment.name,
        attachment.mimeType,
        attachment.base64,
      );
      if (error) errors.push(`${attachment.name}: ${error}`);
    }
    return errors.length > 0 ? errors.join("; ") : undefined;
  }
  
