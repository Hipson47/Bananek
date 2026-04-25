import { lazy, Suspense } from "react";

import { LandingPage } from "./landing/LandingPage";

const AppShell = lazy(() =>
  import("./app-shell/AppShell").then((module) => ({
    default: module.AppShell,
  })),
);
const EnhancerTool = lazy(() =>
  import("./features/enhancer/EnhancerTool").then((module) => ({
    default: module.EnhancerTool,
  })),
);

function normalizePath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export default function App() {
  const path = normalizePath(window.location.pathname);

  if (path === "/") {
    return <LandingPage />;
  }

  if (path === "/app" || path === "/app/enhance") {
    return (
      <Suspense fallback={<main className="route-loading">Loading enhancer</main>}>
        <AppShell>
          <EnhancerTool />
        </AppShell>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<main className="route-loading">Loading product shell</main>}>
      <AppShell>
        <section className="not-found-page">
          <p className="section-kicker">Not found</p>
          <h1>This page is not part of the product flow.</h1>
          <a className="primary-link" href="/app/enhance">
            Open enhancer
          </a>
        </section>
      </AppShell>
    </Suspense>
  );
}
