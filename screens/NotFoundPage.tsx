import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="app-page-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md border border-border bg-card/85 p-10 text-center shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 font-display text-2xl text-foreground">
          Page not found
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="mt-8 space-y-3">
          <Link
            href="/"
            className="block bg-primary px-6 py-2.5 text-sm text-primary-foreground transition hover:bg-primary/90"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
