export type BrowserItem = {
  id: string;
  driveId?: string;
  name: string;
  isFolder: boolean;
  size: number;
  lastModified: string;
};

const store = new Map<string, { items: BrowserItem[]; at: number }>();
const TTL = 5 * 60 * 1000; // 5 minutes

export const sharepointCache = {
  get(itemId: string | null): BrowserItem[] | null {
    const e = store.get(itemId ?? "root");
    return e && Date.now() - e.at < TTL ? e.items : null;
  },
  set(itemId: string | null, items: BrowserItem[]) {
    store.set(itemId ?? "root", { items, at: Date.now() });
  },
};
