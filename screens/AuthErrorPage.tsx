import { useSupportEmail } from "@/hooks/useSupportEmail";
import { Button, buttonVariants } from "@/components/ui/button";

export default function AuthErrorPage({ message }: { message: string }) {
  const supportEmail = useSupportEmail();
  return (
    <div className="app-page-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md border border-border bg-card/85 p-10 text-center shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Sign-In Error
        </p>
        <h1 className="mt-3 font-display text-2xl text-foreground">
          We couldn't sign you in
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {message}
        </p>
        <div className="mt-8 space-y-3">
          <Button
            type="button"
            onClick={() => window.location.assign("/")}
            className="w-full"
          >
            Try Again
          </Button>
          <a
            href={`mailto:${supportEmail}`}
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
