import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Multi-warehouse inventory reservation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "0 2rem",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: "rgba(10,10,11,0.8)",
            backdropFilter: "blur(12px)",
          }}
        >
          <a
            href="/"
            style={{
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "-0.03em",
              color: "#e8e6df",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 24,
                height: 24,
                borderRadius: "6px",
                background: "#6366f1",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              A
            </span>
            Allo
          </a>
          <span
            style={{
              fontSize: "0.75rem",
              fontFamily: "DM Mono, monospace",
              color: "rgba(232,230,223,0.3)",
              letterSpacing: "0.04em",
            }}
          >
            Inventory Platform
          </span>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
