import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

export function LoadState({
  error,
  retry,
}: {
  error?: string | null;
  retry: () => void;
}) {
  if (error) {
    return (
      <section className="panel" role="alert">
        <h2>
          {error === "Not Found"
            ? "Not available yet"
            : "Could not load this section"}
        </h2>
        <p className="muted">
          {error === "Not Found"
            ? "This section needs backend endpoints that are not deployed yet. The rest of the workspace is unaffected."
            : error}
        </p>
        <div className="actions">
          <Button onClick={retry}>Try again</Button>
        </div>
      </section>
    );
  }
  return (
    <section
      className="panel"
      role="status"
      aria-live="polite"
      aria-label="Loading data"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
        <Spinner className="text-[var(--accent-text)]" /> Loading data…
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Fetching the latest information.
      </p>
      <div aria-hidden="true" className="mt-6 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-[var(--line)] p-4"
          >
            <div className="h-2.5 w-2/3 rounded-full bg-[var(--skeleton)] motion-safe:animate-pulse" />
            <div className="mt-4 h-6 w-1/3 rounded-md bg-[var(--skeleton)] motion-safe:animate-pulse" />
            <div className="mt-4 h-2 w-1/2 rounded-full bg-[var(--skeleton)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}
