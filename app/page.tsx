import { DOCS_BASE_URL } from "@/lib/const";

/**
 * What someone sees if they open the API's domain in a browser: this is an
 * API, not the Music Nerd site, and here are the docs.
 *
 * @returns The landing page.
 */
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        maxWidth: 640,
        margin: "0 auto",
        padding: "96px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 24 }}>music nerd</span>
      <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.1 }}>Music Nerd API</h1>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 18, lineHeight: 1.6 }}>
        This is the Music Nerd API, for apps and developers. Looking for artists?{" "}
        <a href="https://www.musicnerd.xyz" style={{ color: "inherit" }}>
          Visit musicnerd.xyz
        </a>
        .
      </p>
      <a
        href={DOCS_BASE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          alignSelf: "flex-start",
          padding: "12px 20px",
          borderRadius: 999,
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        View documentation
      </a>
    </main>
  );
}
