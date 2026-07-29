"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { routeDefinitions } from "@/components/portal/portal-data";
import { usePortal } from "@/components/portal/use-portal";
import { PortalIcon } from "@/components/portal/portal-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MaintenanceEventsBanner from "@/components/portal/maintenance-events-banner";
import { clearDismissedMaintenanceEvents } from "@/components/portal/maintenance-events-storage";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

const routeMeta = {
  "/portal": { icon: "dashboard", label: "Dashboard" },
  "/portal/new-request": { icon: "compose", label: "New Request" },
  "/portal/tickets": { icon: "tickets", label: "Tickets" },
  "/portal/reports": { icon: "reports", label: "Reports" },
} as const;

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser } = usePortal();
  const { user, logout } = useAuth0();
  const displayName = user?.name ?? currentUser.name;

  useIdleTimeout(IDLE_TIMEOUT_MS, () => {
    clearDismissedMaintenanceEvents();
    logout({
      logoutParams: { returnTo: `${window.location.origin}?prompt=login` },
    });
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="app-page-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-black bg-black">
        <div className="mx-auto max-w-[1280px] px-10">
          <div className="relative flex h-[66px] items-center">
            <Link
              href="/portal"
              className="shrink-0"
              aria-label="GlassHouse home"
            >
              <img
                src="https://www.ghsystems.com/hubfs/brand-logo.svg"
                alt="GlassHouse Systems"
                className="h-8 w-auto"
              />
            </Link>

            <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 lg:flex">
              {routeDefinitions.map((route) => {
                const active = pathname === route.path;
                const meta = routeMeta[route.path];
                return (
                  <Link
                    key={route.path}
                    href={route.path}
                    className={cn(
                      "relative flex items-center whitespace-nowrap rounded-[9px] px-4 py-2 text-sm transition",
                      active
                        ? "font-semibold text-white"
                        : "font-medium text-white/60 hover:text-white",
                    )}
                  >
                    {meta.label}
                    {active && (
                      <span className="absolute inset-x-4 -bottom-0.5 h-0.5 bg-primary" />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                variant="outline"
                size="icon"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 lg:hidden"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                <PortalIcon
                  name={mobileMenuOpen ? "close" : "menu"}
                  className="h-5 w-5"
                />
              </Button>

              <div className="relative shrink-0" ref={profileRef}>
                <Button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  variant="ghost"
                  className="h-auto py-1.5 pl-1.5 pr-3 text-white hover:bg-white/10"
                >
                  <div
                    className="flex h-[30px] w-[30px] items-center justify-center bg-primary text-[12px] font-bold text-primary-foreground"
                    style={{ borderRadius: "50%" }}
                  >
                    {initials}
                  </div>
                  <span className="hidden font-semibold text-white sm:block">
                    {displayName}
                  </span>
                  <PortalIcon
                    name="chevronDown"
                    className="h-3.5 w-3.5 text-white/60"
                  />
                </Button>

                {profileOpen && (
                  <div
                    className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card py-2 shadow-lg"
                    style={{ borderRadius: "12px" }}
                  >
                    <div className="border-b border-border px-4 pb-3">
                      <p className="text-sm font-medium text-foreground">
                        {displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {currentUser.company}
                      </p>
                    </div>
                    <div className="px-2 pt-1">
                      <Button
                        type="button"
                        onClick={() => {
                          clearDismissedMaintenanceEvents();
                          logout({
                            logoutParams: {
                              returnTo: `${window.location.origin}?prompt=login`,
                            },
                          });
                        }}
                        variant="ghost"
                        className="h-auto w-full justify-start px-3 py-2 text-foreground hover:bg-accent"
                      >
                        Log out
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="flex flex-col gap-1 border-t border-white/10 py-3 lg:hidden">
              {routeDefinitions.map((route) => {
                const active = pathname === route.path;
                const meta = routeMeta[route.path];
                return (
                  <Link
                    key={route.path}
                    href={route.path}
                    className={cn(
                      "flex items-center border-l-2 px-4 py-2.5 text-sm transition",
                      active
                        ? "border-primary font-semibold text-white"
                        : "border-transparent text-white/60 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {meta.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      <MaintenanceEventsBanner />

      <main className="mx-auto max-w-[1280px] px-10 py-8">
        {children}
      </main>
    </div>
  );
}
