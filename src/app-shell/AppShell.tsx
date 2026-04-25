import type { ReactNode } from "react";

import "./app-shell.css";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="product-app-shell">
      <div className="product-app-shell__grain" aria-hidden="true" />
      <header className="app-topbar" aria-label="Product navigation">
        <a className="brand-mark" href="/">
          <span className="brand-mark__glyph" aria-hidden="true" />
          <span>Banánek</span>
        </a>
        <nav className="app-topbar__nav" aria-label="Primary">
          <a href="/">Story</a>
          <a aria-current="page" href="/app/enhance">
            Enhancer
          </a>
        </nav>
      </header>

      {children}
    </main>
  );
}
