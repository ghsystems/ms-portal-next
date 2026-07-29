export const MAX_ATTACHMENT_BYTES_PER_FILE = 50 * 1024 * 1024; // 50 MB
export const MAX_ATTACHMENT_TOTAL_BYTES = 150 * 1024 * 1024; // 150 MB total

// Mirrored server-side in shared/servicenow.js - this copy is for UX only,
// the server-side one is what actually blocks it. Keep the two lists in sync.
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".csv", ".txt", ".log", ".rtf", ".md",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".heic",
  ".zip", ".7z", ".gz", ".eml", ".msg", ".json", ".xml", ".yaml", ".yml",
];

function isDisallowedFile(fileName: string): boolean {
  // eslint-disable-next-line no-control-regex
  if (/[\\/\x00-\x1f]/.test(fileName)) return true;
  const lower = fileName.toLowerCase();
  return !ALLOWED_ATTACHMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export type AttachmentPayload = {
  name: string;
  mimeType: string | null;
  base64: string;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Adds a freshly-picked batch to the already-selected files, enforcing the
// per-file/total/type limits at selection time. Per the spec (MSP-009), valid
// files are accepted and only the offending ones are dropped - so picking a
// good file alongside a bad one keeps the good one. Returns a clear error
// naming exactly what was rejected. Also dedupes (re-opening a native
// <input multiple> replaces its selection rather than appending, and a user
// may re-pick the same file), keying on name+size+lastModified.
export function addFiles(
  existing: File[],
  incoming: File[],
): { files: File[]; error: string | null } {
  const accepted = [...existing];
  const rejected: string[] = [];

  for (const file of incoming) {
    const isDuplicate = accepted.some(
      (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
    );
    if (isDuplicate) continue;

    if (isDisallowedFile(file.name)) {
      rejected.push(`${file.name} (file type not allowed)`);
      continue;
    }
    if (file.size > MAX_ATTACHMENT_BYTES_PER_FILE) {
      rejected.push(`${file.name} (over 50 MB)`);
      continue;
    }
    const totalWithFile = accepted.reduce((sum, f) => sum + f.size, 0) + file.size;
    if (totalWithFile > MAX_ATTACHMENT_TOTAL_BYTES) {
      rejected.push(`${file.name} (would exceed 150 MB total)`);
      continue;
    }
    accepted.push(file);
  }

  return {
    files: accepted,
    error: rejected.length ? `Not attached - ${rejected.join("; ")}.` : null,
  };
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix - ServiceNow's attachment API wants raw base64.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ponytail: rejects the whole batch on any violation rather than partially
// accepting files under the limit - the spec doesn't define which files to
// drop when only the total is over, so this keeps the rule unambiguous.
// Revisit if Athullya wants partial acceptance.
export function validateAttachments(files: File[]): string | null {
  const blocked = files.find((file) => isDisallowedFile(file.name));
  if (blocked) return `${blocked.name} is a file type that isn't allowed.`;

  const oversized = files.find((file) => file.size > MAX_ATTACHMENT_BYTES_PER_FILE);
  if (oversized) return `${oversized.name} is larger than 50 MB.`;

  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_ATTACHMENT_TOTAL_BYTES) {
    return "Attachments total more than 150 MB combined.";
  }

  return null;
}

export async function toAttachmentPayloads(
  files: File[],
): Promise<AttachmentPayload[]> {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      mimeType: file.type || null,
      base64: await readFileAsBase64(file),
    })),
  );
}
