import {
  ADMIN_ROLES,
  authenticate,
  errorResponse,
  HttpError,
  json,
  preflight,
  readJson,
} from "../shared/http.js";
import { writeAuditLog } from "../shared/audit-log.js";

const METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
// Mirrors BannerType in components/portal/banner-config.ts
const TYPES = ["info", "warning", "critical", "maintenance"];

function validate(body) {
  const { title, message, type, starts_at, ends_at, all_clients, client_ids } = body;

  if (!title?.trim()) throw new HttpError(400, "Title is required");
  if (!message?.trim()) throw new HttpError(400, "Message is required");
  if (!TYPES.includes(type)) throw new HttpError(400, "Invalid event type");
  if (Number.isNaN(Date.parse(starts_at)) || Number.isNaN(Date.parse(ends_at))) {
    throw new HttpError(400, "Valid start and end times are required");
  }
  if (Date.parse(ends_at) <= Date.parse(starts_at)) {
    throw new HttpError(400, "End time must be after the start time");
  }

  const ids = Array.isArray(client_ids) ? client_ids : [];
  if (!all_clients && ids.length === 0) {
    throw new HttpError(400, "Select at least one client, or choose All Clients");
  }

  return {
    payload: {
      title: title.trim(),
      message: message.trim(),
      type,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: new Date(ends_at).toISOString(),
      all_clients: Boolean(all_clients),
    },
    clientIds: all_clients ? [] : ids,
  };
}

async function replaceClientLinks(sb, eventId, clientIds) {
  const { error: deleteErr } = await sb
    .from("maintenance_event_clients")
    .delete()
    .eq("event_id", eventId);
  if (deleteErr) throw new Error(deleteErr.message);

  if (clientIds.length === 0) return;

  const { error: linkErr } = await sb
    .from("maintenance_event_clients")
    .insert(clientIds.map((client_id) => ({ event_id: eventId, client_id })));
  if (linkErr) throw new Error(linkErr.message);
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    // Any signed-in user may read events (the portal banner needs them); only
    // admins may change them.
    const isRead = req.method === "GET";
    const { profile, sb } = await authenticate(req, isRead ? undefined : ADMIN_ROLES);

    if (isRead) {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");

      if (id) {
        const { data, error } = await sb
          .from("maintenance_events")
          .select("*, maintenance_event_clients(client_id)")
          .eq("id", id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new HttpError(404, "Event not found");
        return json(req, { event: data }, 200, METHODS);
      }

      const { data, error } = await sb
        .from("maintenance_events")
        .select("*, maintenance_event_clients(client_id)")
        .order("starts_at", { ascending: false });
      if (error) throw new Error(error.message);

      // Client users only see events targeted at them (or at everyone).
      const isAdmin = ADMIN_ROLES.includes(profile.role);
      const events = isAdmin
        ? data ?? []
        : (data ?? []).filter(
            (e) =>
              e.all_clients ||
              (e.maintenance_event_clients ?? []).some((l) => l.client_id === profile.client_id),
          );

      return json(req, { events }, 200, METHODS);
    }

    if (req.method === "DELETE") {
      const id = new URL(req.url).searchParams.get("id");
      if (!id) throw new HttpError(400, "id is required");

      const { data: target } = await sb
        .from("maintenance_events")
        .select("id, title")
        .eq("id", id)
        .maybeSingle();
      if (!target) throw new HttpError(404, "Event not found");

      const { error } = await sb.from("maintenance_events").delete().eq("id", id);
      if (error) throw new Error(error.message);

      await writeAuditLog(sb, {
        admin_user_id: profile.auth0_user_id,
        admin_email: profile.email,
        action_type: "delete_maintenance_event",
        target_type: "maintenance_event",
        target_id: id,
        target_label: target.title,
        details: "Banner permanently removed",
      });

      return json(req, { success: true }, 200, METHODS);
    }

    const body = await readJson(req);
    const { payload, clientIds } = validate(body);

    if (req.method === "PATCH") {
      const id = body.id;
      if (!id) throw new HttpError(400, "id is required");

      const { error } = await sb.from("maintenance_events").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      await replaceClientLinks(sb, id, clientIds);

      await writeAuditLog(sb, {
        admin_user_id: profile.auth0_user_id,
        admin_email: profile.email,
        action_type: "update_maintenance_event",
        target_type: "maintenance_event",
        target_id: id,
        target_label: payload.title,
        details: `${payload.all_clients ? "All clients" : `${clientIds.length} client(s)`} - ${payload.type}`,
      });

      return json(req, { id }, 200, METHODS);
    }

    if (req.method === "POST") {
      const { data, error } = await sb
        .from("maintenance_events")
        .insert({ ...payload, created_by: profile.email })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await replaceClientLinks(sb, data.id, clientIds);

      await writeAuditLog(sb, {
        admin_user_id: profile.auth0_user_id,
        admin_email: profile.email,
        action_type: "create_maintenance_event",
        target_type: "maintenance_event",
        target_id: data.id,
        target_label: payload.title,
        details: `${payload.all_clients ? "All clients" : `${clientIds.length} client(s)`} - ${payload.type}`,
      });

      return json(req, { id: data.id }, 200, METHODS);
    }

    throw new HttpError(405, "Method not allowed");
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
