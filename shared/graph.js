// ponytail: per-scope token cache — single process, no TTL race
const _tokenCache = new Map(); // scope -> { token, expiry }
let _siteId = null;

export async function getToken(scope) {
  const cached = _tokenCache.get(scope);
  if (cached && Date.now() < cached.expiry - 60_000) return cached.token;
  const resp = await fetch(
    `https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.GRAPH_CLIENT_ID,
        client_secret: process.env.GRAPH_CLIENT_SECRET,
        scope,
      }),
    },
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error_description ?? "Graph auth failed");
  _tokenCache.set(scope, { token: data.access_token, expiry: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

export async function getGraphToken() {
  return getToken("https://graph.microsoft.com/.default");
}

export async function getSharePointSiteId(token) {
  if (_siteId) return _siteId;
  const url = new URL(process.env.GRAPH_SHAREPOINT_SITE_URL);
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${url.hostname}:${url.pathname}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message ?? "SharePoint site lookup failed");
  _siteId = data.id;
  return _siteId;
}

export async function listSharePointFiles(token, siteId) {
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children?$select=id,name,file,size,lastModifiedDateTime,parentReference`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message ?? "SharePoint file listing failed");
  return (data.value ?? [])
    .filter((item) => item.file)
    .map((item) => ({
      id: item.id,
      driveId: item.parentReference?.driveId,
      name: item.name,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
    }));
}

export async function listSharePointFolder(token, siteId, itemId) {
  const path = itemId
    ? `sites/${siteId}/drive/items/${itemId}/children`
    : `sites/${siteId}/drive/root/children`;
  let url = `https://graph.microsoft.com/v1.0/${path}?$select=id,name,file,folder,size,lastModifiedDateTime,parentReference`;
  const raw = [];
  while (url) {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message ?? "SharePoint folder listing failed");
    raw.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? null;
  }
  return raw.map((item) => ({
    id: item.id,
    driveId: item.parentReference?.driveId,
    name: item.name,
    isFolder: !!item.folder,
    size: item.size ?? 0,
    lastModified: item.lastModifiedDateTime ?? "",
  }));
}

export async function getSharePointDownloadUrl(token, driveId, itemId) {
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message ?? "SharePoint item fetch failed");
  const downloadUrl = data["@microsoft.graph.downloadUrl"];
  if (!downloadUrl) throw new Error("No download URL returned from SharePoint");
  return { downloadUrl, name: data.name };
}
