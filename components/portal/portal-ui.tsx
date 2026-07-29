import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";

function IconBase({
  children,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PortalIcon({
  name,
  className,
}: {
  name:
    | "dashboard"
    | "tickets"
    | "reports"
    | "environment"
    | "cloud"
    | "network"
    | "resource"
    | "spark"
    | "alert"
    | "arrow"
    | "pulse"
    | "download"
    | "check"
    | "user"
    | "chevronDown"
    | "refresh"
    | "compose"
    | "shield"
    | "team"
    | "phone"
    | "megaphone"
    | "close"
    | "calendar"
    | "bell"
    | "menu"
    | "eye";
  className?: string;
}) {
  switch (name) {
    case "dashboard":
      return (
        <IconBase className={className}>
          <rect x="3" y="4" width="8" height="7" rx="1.5" />
          <rect x="13" y="4" width="8" height="4" rx="1.5" />
          <rect x="13" y="10" width="8" height="10" rx="1.5" />
          <rect x="3" y="13" width="8" height="7" rx="1.5" />
        </IconBase>
      );
    case "tickets":
      return (
        <IconBase className={className}>
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5H18a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 0 3v3a2 2 0 0 1-2 2H7.5A2.5 2.5 0 0 1 5 15.5z" />
          <path d="M9 9h7" />
          <path d="M9 13h5" />
        </IconBase>
      );
    case "reports":
      return (
        <IconBase className={className}>
          <path d="M7 4.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6a1.5 1.5 0 0 1 1-1.5Z" />
          <path d="M14 4.5V9h4.5" />
          <path d="M9 13h6" />
          <path d="M9 16h6" />
        </IconBase>
      );
    case "environment":
      return (
        <IconBase className={className}>
          <path d="M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9Z" />
          <path d="M3.6 9h16.8" />
          <path d="M3.6 15h16.8" />
          <path d="M12 3c2.5 2.5 4 5.75 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.75-4-9s1.5-6.5 4-9Z" />
        </IconBase>
      );
    case "cloud":
      return (
        <IconBase className={className}>
          <path d="M7.5 18h9a4 4 0 0 0 .3-8A5.5 5.5 0 0 0 6.3 8.5 3.5 3.5 0 0 0 7.5 18Z" />
        </IconBase>
      );
    case "network":
      return (
        <IconBase className={className}>
          <path d="M12 5v5" />
          <path d="M6 19v-2.5A2.5 2.5 0 0 1 8.5 14h7A2.5 2.5 0 0 1 18 16.5V19" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <rect x="3" y="19" width="6" height="2" rx="1" />
          <rect x="15" y="19" width="6" height="2" rx="1" />
        </IconBase>
      );
    case "resource":
      return (
        <IconBase className={className}>
          <path d="M12 3v18" />
          <path d="M3 12h18" />
          <path d="M5 5l14 14" />
          <path d="M19 5L5 19" />
        </IconBase>
      );
    case "spark":
      return (
        <IconBase className={className}>
          <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
        </IconBase>
      );
    case "alert":
      return (
        <IconBase className={className}>
          <path d="M12 4 3.5 19h17Z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="16.5" r="0.7" fill="currentColor" stroke="none" />
        </IconBase>
      );
    case "arrow":
      return (
        <IconBase className={className}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </IconBase>
      );
    case "pulse":
      return (
        <IconBase className={className}>
          <path d="M3 12h4l2.5-5 3 10 2.5-5H21" />
        </IconBase>
      );
    case "download":
      return (
        <IconBase className={className}>
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 19h14" />
        </IconBase>
      );
    case "check":
      return (
        <IconBase className={className}>
          <path d="m5 13 4 4L19 7" />
        </IconBase>
      );
    case "user":
      return (
        <IconBase className={className}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </IconBase>
      );
    case "chevronDown":
      return (
        <IconBase className={className}>
          <path d="m6 9 6 6 6-6" />
        </IconBase>
      );
    case "refresh":
      return (
        <IconBase className={className}>
          <path d="M20 11a8 8 0 0 0-13.7-5.7" />
          <path d="M4 4v5h5" />
          <path d="M4 13a8 8 0 0 0 13.7 5.7" />
          <path d="M20 20v-5h-5" />
        </IconBase>
      );
    case "compose":
      return (
        <IconBase className={className}>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />
          <path d="M15 5l3 3" />
        </IconBase>
      );
    case "shield":
      return (
        <IconBase className={className}>
          <path d="M12 2 4 6.5V11c0 5 3.5 8.5 8 10.5 4.5-2 8-5.5 8-10.5V6.5L12 2Z" />
        </IconBase>
      );
    case "team":
      return (
        <IconBase className={className}>
          <circle cx="8" cy="7" r="3.5" />
          <path d="M1.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M16 3.5a3.5 3.5 0 0 1 0 7" />
          <path d="M21.5 20a6 6 0 0 0-6-6" />
        </IconBase>
      );
    case "phone":
      return (
        <IconBase className={className}>
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z" />
        </IconBase>
      );
    case "megaphone":
      return (
        <IconBase className={className}>
          <path d="M3 9v6" />
          <path d="M3 9a2 2 0 0 0 0 6h2l4 3.5V5.5L5 9H3Z" />
          <path d="M15.5 7.5a5 5 0 0 1 0 9" />
          <path d="M18.5 4.5a9 9 0 0 1 0 15" />
        </IconBase>
      );
    case "close":
      return (
        <IconBase className={className}>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </IconBase>
      );
    case "calendar":
      return (
        <IconBase className={className}>
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M3.5 10h17" />
        </IconBase>
      );
    case "bell":
      return (
        <IconBase className={className}>
          <path d="M12 9v4" />
          <path d="M12 16.5h.01" />
          <path d="M10.7 4.3 2.9 18a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.3 4.3a1.6 1.6 0 0 0-2.6 0Z" />
        </IconBase>
      );
    case "menu":
      return (
        <IconBase className={className}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </IconBase>
      );
    case "eye":
      return (
        <IconBase className={className}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </IconBase>
      );
    default:
      return null;
  }
}

export function StatusBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const palette =
    value === "Open" || value === "Monitoring" || value === "In Progress"
      ? "bg-sky-100 text-sky-900 ring-sky-200"
      : value === "Resolved" || value === "Completed" || value === "Healthy" || value === "Active"
        ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
        : value === "Scheduled"
          ? "bg-muted text-foreground ring-slate-200"
          : value === "Degraded" || value === "Critical" || value === "Deactivated"
            ? "bg-rose-100 text-rose-900 ring-rose-200"
            : "bg-amber-100 text-amber-900 ring-amber-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase ring-1",
        palette,
        className,
      )}
    >
      {value}
    </span>
  );
}

export function PriorityBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const palette =
    value === "Critical"
      ? "bg-red-600 text-white ring-red-500"
      : value === "High"
        ? "bg-red-300 text-red-950 ring-red-200"
        : value === "Medium"
          ? "bg-yellow-400 text-yellow-950 ring-yellow-300"
          : "bg-muted text-muted-foreground ring-slate-200";

  return (
    <span
      className={cn(
        "inline-flex min-w-20 items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-[0.06em] uppercase ring-1",
        palette,
        className,
      )}
    >
      {value}
    </span>
  );
}

export function SectionEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
