import { Badge } from "@/components/ui/badge";

const POSITION_VARIANTS = {
  QB: "positionQb",
  RB: "positionRb",
  WR: "positionWr",
  TE: "positionTe",
} as const;

type PositionBadgeProps = {
  position: string | null | undefined;
  label?: string;
};

/** A compact, shared position marker based on RosterAudit's four offensive colors. */
export function PositionBadge({ position, label }: PositionBadgeProps) {
  const normalized = position?.toUpperCase() ?? null;
  const variant = normalized && normalized in POSITION_VARIANTS
    ? POSITION_VARIANTS[normalized as keyof typeof POSITION_VARIANTS]
    : "outline";

  return <Badge size="position" variant={variant}>{label ?? normalized ?? "—"}</Badge>;
}
