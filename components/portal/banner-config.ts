export type BannerType = "info" | "warning" | "critical" | "maintenance";

export const bannerTypeConfig: Record<
  BannerType,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    label: string;
    alert: string;
    icon: string;
    action: string;
    description: string;
  }
> = {
  info: {
    bg: "bg-sky-50",
    text: "text-sky-900",
    border: "border-sky-200",
    dot: "bg-sky-500",
    label: "Info",
    alert: "border-sky-200 bg-sky-50 text-sky-950",
    icon: "text-sky-700",
    action: "text-sky-700 hover:bg-sky-100 hover:text-sky-950",
    description: "text-sky-900/85",
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-200",
    dot: "bg-amber-500",
    label: "Warning",
    alert: "border-amber-200 bg-amber-50 text-amber-950",
    icon: "text-amber-700",
    action: "text-amber-700 hover:bg-amber-100 hover:text-amber-950",
    description: "text-amber-900/85",
  },
  critical: {
    bg: "bg-rose-50",
    text: "text-rose-900",
    border: "border-rose-200",
    dot: "bg-rose-500",
    label: "Critical",
    alert: "border-rose-200 bg-rose-50 text-rose-950",
    icon: "text-rose-700",
    action: "text-rose-700 hover:bg-rose-100 hover:text-rose-950",
    description: "text-rose-900/85",
  },
  maintenance: {
    bg: "bg-muted",
    text: "text-foreground",
    border: "border-border",
    dot: "bg-muted",
    label: "Maintenance",
    alert: "border-border bg-muted text-foreground",
    icon: "text-foreground",
    action: "text-muted-foreground hover:bg-muted hover:text-foreground",
    description: "text-foreground",
  },
};
