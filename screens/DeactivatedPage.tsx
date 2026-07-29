import { useAuth0 } from "@auth0/auth0-react";
import { useSupportEmail } from "@/hooks/useSupportEmail";
import { Button, buttonVariants } from "@/components/ui/button";

export default function DeactivatedPage() {
  const { logout } = useAuth0();
  const supportEmail = useSupportEmail();

  return (
    <div className="app-page-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md border border-border bg-card/85 p-10 text-center shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Access Denied
        </p>
        <h1 className="mt-3 font-display text-2xl text-foreground">
          Account is no longer active
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Your portal access has been deactivated. Please contact GlassHouse
          Systems if you believe this is an error or need your access restored.
        </p>
        <div className="mt-8 space-y-3">
          <a
            href={`mailto:${supportEmail}`}
            className={buttonVariants({ className: "w-full" })}
          >
            Contact Support
          </a>
          <Button
            type="button"
            onClick={() =>
              logout({ logoutParams: { returnTo: `${window.location.origin}?prompt=login` } })
            }
            variant="outline"
            className="w-full"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
