"use client";

/** Last-resort boundary when the root layout itself fails; it can't rely on app styles or fonts. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fafaf7", color: "#16180f", margin: 0 }}>
        <main role="alert" style={{ maxWidth: 480, margin: "15vh auto", padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Setlo couldn&apos;t load</h1>
          <p style={{ color: "#62665a", lineHeight: 1.5 }}>Nothing was sent onchain by this error. Reload the page to try again.</p>
          <button onClick={reset} style={{ minHeight: 44, padding: "0 16px", borderRadius: 10, border: 0, background: "#1f5e4b", color: "#fff", fontSize: 15, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
