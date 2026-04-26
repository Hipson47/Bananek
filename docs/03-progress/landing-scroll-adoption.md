# Landing Scroll Adoption Note

> Historical note. `/dawca` was a temporary donor reference project. The needed
> scroll/layout/motion pieces were copied or adapted into active `src/`, donor
> screenshots were captured for comparison, and the donor directory has been
> removed from the repository.

## Donor animation pieces transplanted

- Donor `Landing.tsx`: copied/adapted as `CinematicScroll` with the same 1200vh runway, sticky viewport, global `useScroll`, chapter stack, and progress bar.
- Donor timing config: copied/adapted as `CINEMATIC_TIMING` with the same hero/work/about/process/contact timing windows.
- Donor chapter lifecycle hook: copied/adapted as the shared lifecycle hook for progress-gated visibility and pointer events.
- Donor hero chapter: copied/adapted as `EnhancementScene` with split title entrance, circle clip reveal, parallax background text, scale exit, and opacity exit.
- Donor work chapter: copied/adapted as `MarketplaceScene` with horizontal track movement, title slide-in, and parallax card backgrounds.
- Donor about chapter: copied/adapted as `StudioScene` with vertical entrance and clipped demo reveal.
- Donor process chapter: copied/adapted as `CatalogScene` with vertical entrance, spring-driven timeline line, and staged step reveals.
- Donor contact chapter: copied/adapted as `StartScene` with scaled headline, color transition, and late CTA reveal.
- Donor landing CSS: ported into namespaced `src/landing/styles/landing.css` for sticky chapter layering, cinematic layout, progress bar, and mobile behavior.

## Donor content ignored

- Portfolio/project/about/contact/lab routes and copy.
- Project cards, identity/profile content, mail CTA, and React Router donor route tree.
- Donor global reset and broad global classes.

## Product adaptation

- Donor chapter roles are retained and mapped to product story scenes:
  - hero -> Product Photo Enhancement
  - work -> Marketplace Ready
  - about -> Studio Polish
  - process -> Catalog Consistency
  - contact -> Start / CTA
- Shortcut navigation is product-specific: Enhancement, Marketplace, Studio, Catalog, Start.
- Product CTAs route to `/app/enhance`.
- Placeholder demo visuals stay inside the donor-style scroll-controlled scene system.
- Donor z-index tokens are now part of the active shared tokens so chapter
  layers, progress bar, and shortcut navigation resolve consistently.
- Global horizontal overflow rules are not applied to landing ancestors because
  they break CSS sticky positioning; overflow is contained inside the cinematic
  viewport, work track, and app shell instead.
