import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Music Nerd API",
  description: "The API behind Music Nerd.",
};

/**
 * Root layout for the one human-facing page.
 *
 * @param props - Layout props.
 * @param props.children - The page.
 * @returns The document.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
