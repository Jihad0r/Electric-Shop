
import type { PERKS } from "@/lib/store";
import {
  Truck,
  LockKeyhole,
  Headset,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

const PERK_ICONS: Record<
  (typeof PERKS)[number]["icon"],
  LucideIcon
> = {
  truck: Truck,
  lock: LockKeyhole,
  headset: Headset,
  return: RotateCcw,
};

export default function PerkIcon({
  name,
}: {
  name: (typeof PERKS)[number]["icon"];
}) {
  const Icon = PERK_ICONS[name];

  return (
    <Icon
      size={20}
      strokeWidth={1.8}
      aria-hidden="true"
    />
  );
}
