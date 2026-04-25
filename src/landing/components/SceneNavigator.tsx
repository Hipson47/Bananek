import { useEffect, useState, type RefObject } from "react";
import { useMotionValueEvent, type MotionValue } from "framer-motion";

type SceneNavigatorProps = {
  container: RefObject<HTMLDivElement>;
  progress: MotionValue<number>;
};

const SCENES = [
  { label: "Enhancement", target: 0 },
  { label: "Marketplace", target: 0.18 },
  { label: "Studio", target: 0.5 },
  { label: "Catalog", target: 0.68 },
  { label: "Start", target: 0.86 },
];

export function SceneNavigator({ container, progress }: SceneNavigatorProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(getActiveScene(progress.get()));
  }, [progress]);

  useMotionValueEvent(progress, "change", (latest) => {
    setActiveIndex(getActiveScene(latest));
  });

  function goToScene(target: number, index: number) {
    const el = container.current;
    if (!el) return;

    const scrollableHeight = el.offsetHeight - window.innerHeight;
    const nextTop = el.offsetTop + scrollableHeight * target;
    const scroller = document.scrollingElement ?? document.documentElement;
    const previousHtmlScrollBehavior = document.documentElement.style.scrollBehavior;
    const previousBodyScrollBehavior = document.body.style.scrollBehavior;
    setActiveIndex(index);
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
    scroller.scrollTop = nextTop;
    window.requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = previousHtmlScrollBehavior;
      document.body.style.scrollBehavior = previousBodyScrollBehavior;
    });
  }

  return (
    <header className="cinematic-nav" aria-label="Landing shortcuts">
      <a className="cinematic-brand" href="/">
        <span className="cinematic-brand__mark" aria-hidden="true" />
        <span>Banánek</span>
      </a>

      <nav className="cinematic-nav__links" aria-label="Story scenes">
        {SCENES.map((scene, index) => (
          <button
            aria-current={activeIndex === index ? "step" : undefined}
            key={scene.label}
            onClick={() => goToScene(scene.target, index)}
            type="button"
          >
            {scene.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function getActiveScene(progress: number) {
  if (progress >= 0.78) return 4;
  if (progress >= 0.63) return 3;
  if (progress >= 0.46) return 2;
  if (progress >= 0.12) return 1;
  return 0;
}
