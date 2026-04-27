/**
 * Placeholder root page untuk dashboard AGROWTH.
 *
 * Akan diganti komponen kompleks (peta, kartu cuaca, mangsa, rekomendasi LLM)
 * pada iterasi berikutnya.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Beta · v0.1.0
      </span>

      <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
        AGROWTH Dashboard
      </h1>

      <p className="max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
        Rekomendasi pertanian hybrid berbasis{" "}
        <span className="font-semibold text-foreground">Pranata Mangsa</span>,
        prediksi cuaca, dan saran narasi Bahasa Jawa via Gemini.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm">
        <a
          href="http://localhost:8000/docs"
          className="rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground transition hover:bg-muted"
          target="_blank"
          rel="noreferrer"
        >
          API Docs (Swagger)
        </a>
        <a
          href="http://localhost:8000/health"
          className="rounded-md border border-border px-4 py-2 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          target="_blank"
          rel="noreferrer"
        >
          Health Check
        </a>
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Frontend Next.js · Tailwind · TypeScript — siap dikembangkan.
      </p>
    </main>
  );
}
