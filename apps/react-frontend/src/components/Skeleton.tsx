import ui from "./ui.module.css";

interface SkeletonProps {
  /** Any CSS size; width defaults to filling the parent. */
  width?: string;
  height?: string;
  /** "primary" matches placeholders laid on the primary-colored month card. */
  tone?: "surface" | "primary";
}

/**
 * Decorative placeholder shown while content loads. Always aria-hidden — the
 * container should carry aria-busy="true" so screen readers get one announcement.
 * The shimmer animation stops under the global reduced-motion kill-switch.
 */
export default function Skeleton({ width, height = "18px", tone = "surface" }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={tone === "primary" ? `${ui.skeleton} ${ui.skeletonPrimary}` : ui.skeleton}
      style={{ width, height }}
    />
  );
}
