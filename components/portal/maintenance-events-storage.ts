const DISMISSED_KEY = "dismissedMaintenanceEventIds";

export function getDismissedIds(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addDismissedId(id: string) {
  const ids = getDismissedIds();
  if (!ids.includes(id)) {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids, id]));
  }
}

export function clearDismissedMaintenanceEvents() {
  sessionStorage.removeItem(DISMISSED_KEY);
}
