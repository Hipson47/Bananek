import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

import { CINEMATIC_TIMING } from "../../shared/motion/cinematicTiming";
import { useChapterLifecycle } from "../../shared/motion/useChapterLifecycle";

type SceneProps = {
  scrollYProgress: MotionValue<number>;
};

const MARKETPLACE_CARDS = [
  {
    label: "Raw listing",
    title: "Clean background",
    variant: "marketplace",
  },
  {
    label: "Crop safe",
    title: "Marketplace polish",
    variant: "crop",
  },
  {
    label: "Asset ready",
    title: "Download listing image",
    variant: "asset",
  },
];

const CATALOG_STEPS = ["Mixed Batch", "Style Memory", "Matched Catalog"];

export function EnhancementScene({ scrollYProgress }: SceneProps) {
  const lifecycle = useChapterLifecycle(
    scrollYProgress,
    CINEMATIC_TIMING.hero.in,
    CINEMATIC_TIMING.hero.out,
  );
  const wantsReducedMotion = useReducedMotion();

  const topTextY = useTransform(scrollYProgress, [0, 0.04, 1], ["-100vh", "0vh", "0vh"]);
  const bottomTextY = useTransform(scrollYProgress, [0, 0.04, 1], ["100vh", "0vh", "0vh"]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.01, 1], [0, 1, 1]);
  const titleScale = useTransform(scrollYProgress, [0, 0.03, 0.08, 1], [1.2, 1.2, 1, 1]);
  const titleLetterSpacing = useTransform(scrollYProgress, [0, 0.03, 0.08, 1], ["0.2em", "0.2em", "-0.05em", "-0.05em"]);
  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.05, 0.12, 1],
    wantsReducedMotion
      ? ["circle(200% at 50% 50%)", "circle(200% at 50% 50%)", "circle(200% at 50% 50%)", "circle(200% at 50% 50%)"]
      : ["circle(0% at 50% 50%)", "circle(0% at 50% 50%)", "circle(200% at 50% 50%)", "circle(200% at 50% 50%)"],
  );
  const bgTextY = useTransform(scrollYProgress, [0, 0.02, 0.15, 1], ["0%", "0%", "100%", "100%"]);
  const bgTextScale = useTransform(scrollYProgress, [0, 0.05, 0.15, 1], [3, 3, 1, 1]);
  const heroScale = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.hero.exit, CINEMATIC_TIMING.hero.out, 1], [1, 1, wantsReducedMotion ? 1 : 0.8, wantsReducedMotion ? 1 : 0.8]);
  const heroOpacity = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.hero.exit, CINEMATIC_TIMING.hero.out, 1], [1, 1, 0, 0]);

  return (
    <motion.section
      aria-label="Product Photo Enhancement"
      className="cinematic-chapter cinematic-hero"
      style={{ ...lifecycle, opacity: heroOpacity, scale: heroScale, zIndex: "var(--z-hero)" }}
    >
      <div className="cinematic-hero__base">
        <motion.div
          className="cinematic-hero__titles"
          style={{
            opacity: wantsReducedMotion ? 1 : titleOpacity,
            scale: wantsReducedMotion ? 1 : titleScale,
            letterSpacing: wantsReducedMotion ? "normal" : titleLetterSpacing,
          }}
        >
          <motion.h1 style={{ y: wantsReducedMotion ? 0 : topTextY }}>
            Product Photo
          </motion.h1>
          <motion.span
            aria-hidden="true"
            className="cinematic-hero__accent"
            style={{ y: wantsReducedMotion ? 0 : bottomTextY }}
          >
            Enhancement
          </motion.span>
        </motion.div>
      </div>

      <motion.div className="cinematic-hero__background" style={{ clipPath }}>
        <motion.div
          className="cinematic-hero__bg-text-layer"
          style={{ y: wantsReducedMotion ? 0 : bgTextY, scale: wantsReducedMotion ? 1 : bgTextScale }}
        >
          <span aria-hidden="true">PREMIUM</span>
        </motion.div>
      </motion.div>
      <a className="cinematic-floating-cta" href="/app/enhance">
        Enhance a photo
      </a>
    </motion.section>
  );
}

export function MarketplaceScene({ scrollYProgress }: SceneProps) {
  const lifecycle = useChapterLifecycle(
    scrollYProgress,
    CINEMATIC_TIMING.work.in,
    CINEMATIC_TIMING.work.out,
  );
  const trStart = CINEMATIC_TIMING.work.enter;
  const trReady = CINEMATIC_TIMING.work.enter + 0.04;
  const trExit = CINEMATIC_TIMING.work.exit;
  const trOut = CINEMATIC_TIMING.work.out;

  const opacity = useTransform(scrollYProgress, [0, trStart, trReady, trExit, trOut, 1], [0, 0, 1, 1, 0, 0]);
  const xMovement = useTransform(scrollYProgress, [0, trReady, trExit, 1], ["20vw", "20vw", "-110vw", "-110vw"]);
  const titleX = useTransform(scrollYProgress, [0, trStart, trReady + 0.04, 1], ["-100%", "-100%", "0%", "0%"]);

  return (
    <motion.section
      aria-label="Marketplace Ready"
      className="cinematic-chapter cinematic-work"
      style={{ ...lifecycle, opacity, zIndex: "var(--z-work)" }}
    >
      <div className="cinematic-work__content">
        <div className="cinematic-container">
          <motion.h2 className="cinematic-section-title cinematic-outline-text" style={{ x: titleX }}>
            Marketplace Ready
          </motion.h2>
        </div>

        <div className="cinematic-work__track">
          <motion.div className="cinematic-work__scroll-container" style={{ x: xMovement }}>
            {MARKETPLACE_CARDS.map((card) => (
              <MarketplaceCard
                key={card.title}
                label={card.label}
                title={card.title}
                variant={card.variant}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

function MarketplaceCard({
  label,
  title,
  variant,
  scrollYProgress,
}: {
  label: string;
  title: string;
  variant: string;
  scrollYProgress: MotionValue<number>;
}) {
  const wantsReducedMotion = useReducedMotion();
  const imageScale = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.hero.out, CINEMATIC_TIMING.work.exit, 1], [1.5, 1.5, 1, 1]);
  const imageX = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.hero.out, CINEMATIC_TIMING.work.exit, 1], ["-20%", "-20%", "20%", "20%"]);

  return (
    <a className="cinematic-work__card" href="/app/enhance">
      <motion.div
        className={`cinematic-work__card-bg cinematic-work__card-bg--${variant}`}
        style={wantsReducedMotion ? { inset: 0, opacity: 0.2 } : { inset: "-30%", opacity: 0.28, scale: imageScale, x: imageX }}
      />
      <div className="cinematic-work__card-overlay" />
      <span>{label}</span>
      <p>{title}</p>
    </a>
  );
}

export function StudioScene({ scrollYProgress }: SceneProps) {
  const lifecycle = useChapterLifecycle(
    scrollYProgress,
    CINEMATIC_TIMING.about.in,
    CINEMATIC_TIMING.about.out,
  );
  const wantsReducedMotion = useReducedMotion();
  const trEnter = CINEMATIC_TIMING.about.enter;
  const trReady = trEnter + 0.05;
  const trExit = CINEMATIC_TIMING.about.exit;
  const trOut = CINEMATIC_TIMING.about.out;

  const opacity = useTransform(scrollYProgress, [0, trEnter, trReady, trExit, trOut, 1], [0, 0, 1, 1, 0, 0]);
  const yMovement = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.about.in, trReady + 0.02, 1], ["100vh", "100vh", "0vh", "0vh"]);
  const clipMask = useTransform(
    scrollYProgress,
    [0, trEnter, trReady + 0.05, 1],
    wantsReducedMotion
      ? ["inset(0% 0 0 0)", "inset(0% 0 0 0)", "inset(0% 0 0 0)", "inset(0% 0 0 0)"]
      : ["inset(100% 0 0 0)", "inset(100% 0 0 0)", "inset(0% 0 0 0)", "inset(0% 0 0 0)"],
  );

  return (
    <motion.section
      aria-label="Studio Polish"
      className="cinematic-chapter cinematic-about"
      style={{ ...lifecycle, opacity, zIndex: "var(--z-about)" }}
    >
      <div className="cinematic-container cinematic-about__container">
        <motion.div className="cinematic-about__grid" style={{ y: wantsReducedMotion ? 0 : yMovement }}>
          <div className="cinematic-about__text">
            <h2 className="cinematic-section-title cinematic-about__heading cinematic-outline-text">
              Studio Polish
            </h2>
            <p>
              Lighting and contrast tuned for a catalog-ready frame.
            </p>
            <a className="cinematic-inline-cta" href="/app/enhance">
              Open enhancer
            </a>
          </div>

          <motion.div className="cinematic-about__portrait" style={{ clipPath: clipMask }}>
            <div className="cinematic-about__portrait-overlay" />
            <p>FLAT PHOTO -&gt; STUDIO IMAGE</p>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}

export function CatalogScene({ scrollYProgress }: SceneProps) {
  const lifecycle = useChapterLifecycle(
    scrollYProgress,
    CINEMATIC_TIMING.process.in,
    CINEMATIC_TIMING.process.out,
  );
  const wantsReducedMotion = useReducedMotion();
  const trEnter = CINEMATIC_TIMING.process.enter;
  const trReady = trEnter + 0.03;
  const trExit = CINEMATIC_TIMING.process.exit;
  const trOut = CINEMATIC_TIMING.process.out;

  const opacity = useTransform(scrollYProgress, [0, trEnter, trReady, trExit, trOut, 1], [0, 0, 1, 1, 0, 0]);
  const yMovement = useTransform(scrollYProgress, [0, trEnter, trReady + 0.02, 1], ["-100vh", "-100vh", "0vh", "0vh"]);
  const rawProgress = useTransform(scrollYProgress, [0, trReady + 0.02, trExit, 1], [0, 0, 1, 1]);
  const smoothProgress = useSpring(rawProgress, { stiffness: 100, damping: 30 });

  return (
    <motion.section
      aria-label="Catalog Consistency"
      className="cinematic-chapter cinematic-process"
      style={{ ...lifecycle, opacity, y: wantsReducedMotion ? 0 : yMovement, zIndex: "var(--z-process)" }}
    >
      <div className="cinematic-process__wrapper cinematic-container">
        <h2 className="cinematic-section-title cinematic-process__heading">
          Catalog Consistency
        </h2>

        <div className="cinematic-timeline">
          <motion.div className="cinematic-timeline__line" style={{ scaleY: smoothProgress }} aria-hidden="true" />
          {CATALOG_STEPS.map((step, index) => (
            <CatalogStep key={step} index={index} scrollYProgress={scrollYProgress} step={step} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function CatalogStep({
  step,
  index,
  scrollYProgress,
}: {
  step: string;
  index: number;
  scrollYProgress: MotionValue<number>;
}) {
  const wantsReducedMotion = useReducedMotion();
  const stepThreshold = CINEMATIC_TIMING.process.enter + 0.07 + index * 0.05;
  const stepOpacity = useTransform(scrollYProgress, [0, stepThreshold, stepThreshold + 0.03, 1], [0, 0, 1, 1]);
  const stepX = useTransform(scrollYProgress, [0, stepThreshold, stepThreshold + 0.03, 1], ["100px", "100px", "0px", "0px"]);

  return (
    <motion.div className="cinematic-timeline__step" style={{ opacity: stepOpacity, x: wantsReducedMotion ? 0 : stepX }}>
      <div className="cinematic-timeline__dot" aria-hidden="true" />
      <h3>{step}</h3>
    </motion.div>
  );
}

export function StartScene({ scrollYProgress }: SceneProps) {
  const lifecycle = useChapterLifecycle(
    scrollYProgress,
    CINEMATIC_TIMING.contact.in,
    CINEMATIC_TIMING.contact.out,
  );
  const wantsReducedMotion = useReducedMotion();
  const opacity = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.contact.enter, CINEMATIC_TIMING.contact.enter + 0.06, 1], [0, 0, 1, 1]);
  const scale = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.contact.enter + 0.02, CINEMATIC_TIMING.contact.exit - 0.08, 1], [0.2, 0.2, 1.1, 1.1]);
  const bgColor = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.contact.enter + 0.08, CINEMATIC_TIMING.contact.exit - 0.06, 1], ["var(--color-charcoal-soft)", "var(--color-charcoal-soft)", "var(--color-accent)", "var(--color-accent)"]);
  const textColor = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.contact.enter + 0.08, CINEMATIC_TIMING.contact.exit - 0.06, 1], ["var(--color-accent)", "var(--color-accent)", "var(--color-charcoal)", "var(--color-charcoal)"]);
  const buttonOpacity = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.contact.exit - 0.06, CINEMATIC_TIMING.contact.exit - 0.04, 1], [0, 0, 1, 1]);
  const buttonY = useTransform(scrollYProgress, [0, CINEMATIC_TIMING.contact.exit - 0.06, CINEMATIC_TIMING.contact.exit - 0.04, 1], [100, 100, 0, 0]);

  return (
    <motion.section
      aria-label="Start"
      className="cinematic-chapter cinematic-contact"
      style={{ ...lifecycle, opacity, zIndex: "var(--z-contact)", backgroundColor: bgColor }}
    >
      <div className="cinematic-contact__content">
        <motion.h2 style={{ scale: wantsReducedMotion ? 1 : scale, color: textColor }}>
          START SELLING
        </motion.h2>
        <motion.a
          className="cinematic-contact__cta"
          href="/app/enhance"
          style={{ opacity: buttonOpacity, y: wantsReducedMotion ? 0 : buttonY }}
        >
          OPEN ENHANCER
        </motion.a>
      </div>
    </motion.section>
  );
}
