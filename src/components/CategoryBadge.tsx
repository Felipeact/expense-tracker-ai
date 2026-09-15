import { CATEGORY_META } from "@/lib/categories";
import type { Category } from "@/lib/types";

/** Category label: identity is carried by the colored dot, text stays in ink. */
export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface-2/60 px-2.5 py-0.5 text-xs font-medium text-ink-2">
      <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_META[category].color }} aria-hidden />
      {category}
    </span>
  );
}

export function CategoryIcon({ category, size = "md" }: { category: Category; size?: "sm" | "md" }) {
  const { icon: Icon, color } = CATEGORY_META[category];
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <span
      className={`relative inline-flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-lg`}
      aria-hidden
    >
      <span className="absolute inset-0 opacity-15" style={{ background: color }} />
      <Icon className="relative h-4 w-4 text-ink-2" />
    </span>
  );
}
