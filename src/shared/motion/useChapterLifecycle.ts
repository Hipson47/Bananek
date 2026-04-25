import { useTransform, type MotionValue } from "framer-motion";

export function useChapterLifecycle(
  scrollYProgress: MotionValue<number>,
  inBound: number,
  outBound: number,
) {
  const visibility = useTransform(scrollYProgress, (progress) =>
    progress < inBound || progress > outBound ? "hidden" : "visible",
  );
  const pointerEvents = useTransform(scrollYProgress, (progress) =>
    progress < inBound || progress > outBound ? "none" : "auto",
  );

  return { visibility, pointerEvents };
}
