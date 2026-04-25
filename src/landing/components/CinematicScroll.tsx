import { useRef } from "react";
import { motion, useReducedMotion, useScroll } from "framer-motion";

import {
  CatalogScene,
  EnhancementScene,
  MarketplaceScene,
  StartScene,
  StudioScene,
} from "./ScrollScene";
import { SceneNavigator } from "./SceneNavigator";

export function CinematicScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wantsReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <main
      className={`cinematic-landing-wrapper${wantsReducedMotion ? " is-reduced-motion" : ""}`}
      ref={containerRef}
    >
      <div className="cinematic-landing-viewport">
        <SceneNavigator container={containerRef} progress={scrollYProgress} />
        <EnhancementScene scrollYProgress={scrollYProgress} />
        <MarketplaceScene scrollYProgress={scrollYProgress} />
        <StudioScene scrollYProgress={scrollYProgress} />
        <CatalogScene scrollYProgress={scrollYProgress} />
        <StartScene scrollYProgress={scrollYProgress} />

        <motion.div
          className="cinematic-progress-bar"
          style={{ scaleX: scrollYProgress }}
          aria-hidden="true"
        />
      </div>
    </main>
  );
}
