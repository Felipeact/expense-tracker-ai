import {
  Car,
  Film,
  MoreHorizontal,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "./types";

interface CategoryMeta {
  /** CSS color value; resolves per theme via custom properties. */
  color: string;
  icon: LucideIcon;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  Food: { color: "var(--cat-food)", icon: UtensilsCrossed },
  Transportation: { color: "var(--cat-transportation)", icon: Car },
  Entertainment: { color: "var(--cat-entertainment)", icon: Film },
  Shopping: { color: "var(--cat-shopping)", icon: ShoppingBag },
  Bills: { color: "var(--cat-bills)", icon: Receipt },
  Other: { color: "var(--cat-other)", icon: MoreHorizontal },
};
