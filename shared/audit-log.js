/**
 * Audit entries are written server-side only, with the service role key.
 * Callers pass `outcome: "failure"` for denied/failed attempts — a trail that
 * only records successes can't evidence detection of unauthorized access.
 */
export async function writeAuditLog(client, entry) {
  const { error } = await client.from("audit_logs").insert({ outcome: "success", ...entry });
  if (error) console.error("[audit_log] insert failed:", error.message, error.code, error.details);
}
