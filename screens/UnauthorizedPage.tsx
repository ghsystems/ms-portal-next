import { useAuth0 } from "@auth0/auth0-react";
import { useSupportEmail } from "@/hooks/useSupportEmail";
import { Button, buttonVariants } from "@/components/ui/button";

export default function UnauthorizedPage() {
  const { logout } = useAuth0();
  const supportEmail = useSupportEmail();

  return (
    <div className="auth-page-bg flex min-h-screen items-center justify-center px-8 py-12">
      <div className="relative z-10 w-full max-w-[410px] rounded-[6px] bg-card p-11">
        <h1 className="font-display text-[1.6rem] font-medium leading-snug text-foreground">
          Access not configured
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          Your account exists but hasn't been assigned a portal role yet. Contact
          GlassHouse Systems to get access set up.
        </p>
        <div className="mt-8 space-y-3">
          <a
            href={`mailto:${supportEmail}`}
            className={buttonVariants({ size: "lg", className: "h-12 w-full" })}
          >
            Contact Support
          </a>
          <Button
            type="button"
            onClick={() =>
              logout({ logoutParams: { returnTo: `${window.location.origin}?prompt=login` } })
            }
            variant="outline"
            size="lg"
            className="h-12 w-full"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
