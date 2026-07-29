"use client";
import { redirect } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";
import type { AppRole } from "@/lib/roles";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  allowedRoles: AppRole[];
  children: React.ReactNode;
};

export default function RequireRole({ allowedRoles, children }: Props) {
  const { profile, loadingProfile } = useProfile();

  if (loadingProfile) {
    return (
      <div className="space-y-6 p-8" role="status" aria-label="Loading profile">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-72 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-3xl" />
        <span className="sr-only">Loading profile</span>
      </div>
    );
  }

  if (!profile) redirect("/unauthorized");
  if (profile.is_active === false) redirect("/deactivated");
  if (!allowedRoles.includes(profile.role)) redirect("/unauthorized");

  return children;
}
