"use client";
import { useState } from "react";

/** Minimal same-origin acceptance surface. Real bearer tokens stay in component memory only. */
export default function TestPage() {
  const [artist, setArtist] = useState("");
  const [token, setToken] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(regenerate: boolean) {
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(artist.trim())) {
      setResult("Enter the synthetic artist UUID.");
      return;
    }
    if (regenerate && !token.trim()) {
      setResult("Enter your test account access token.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/artistBio/${encodeURIComponent(artist.trim())}`, {
        method: regenerate ? "PUT" : "GET",
        credentials: "same-origin",
        ...(regenerate
          ? {
              headers: {
                Authorization: `Bearer ${token.trim()}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ regenerate: true }),
            }
          : {}),
      });
      const body = await response.json();
      setResult(
        `HTTP ${response.status}\n${body.bio ?? body.error ?? body.message ?? "No result"}`,
      );
    } catch {
      setResult("Request could not complete. Check access to this test deployment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", fontFamily: "sans-serif" }}>
      <h1>Synthetic About test</h1>
      <p>
        Use only the isolated synthetic artist and test account. Generation runs only when you click
        its button.
      </p>
      <p>
        <label>
          Artist UUID{" "}
          <input value={artist} onChange={e => setArtist(e.target.value)} autoComplete="off" />
        </label>
      </p>
      <p>
        <label>
          Test account access token{" "}
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </p>
      <button disabled={busy} onClick={() => void run(false)}>
        Read About
      </button>{" "}
      <button disabled={busy} onClick={() => void run(true)}>
        Regenerate About
      </button>{" "}
      <button disabled={busy} onClick={() => setToken("")}>
        Clear token
      </button>
      <pre aria-live="polite" style={{ whiteSpace: "pre-wrap" }}>
        {result}
      </pre>
      <p>This checks the isolated API flow, not the full Music Nerd Web experience.</p>
    </main>
  );
}
