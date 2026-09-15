import { addDays, toISODate } from "./dates";
import type { Category, ExpenseInput } from "./types";

const TEMPLATES: Record<Category, { items: string[]; min: number; max: number; perMonth: number }> = {
  Food: {
    items: ["Grocery run", "Coffee", "Lunch with team", "Pizza night", "Farmers market", "Sushi dinner", "Bakery"],
    min: 4,
    max: 95,
    perMonth: 12,
  },
  Transportation: {
    items: ["Gas", "Train pass", "Rideshare", "Parking", "Car wash", "Bike repair"],
    min: 6,
    max: 70,
    perMonth: 5,
  },
  Entertainment: {
    items: ["Movie tickets", "Concert", "Streaming subscription", "Board game", "Museum", "Bowling"],
    min: 10,
    max: 120,
    perMonth: 3,
  },
  Shopping: {
    items: ["Running shoes", "Books", "Home supplies", "Birthday gift", "Headphones", "Clothing"],
    min: 15,
    max: 180,
    perMonth: 3,
  },
  Bills: {
    items: ["Electricity bill", "Internet", "Phone plan", "Water bill", "Gym membership"],
    min: 30,
    max: 160,
    perMonth: 4,
  },
  Other: {
    items: ["Haircut", "Donation", "Pharmacy", "Pet supplies", "Dry cleaning"],
    min: 8,
    max: 60,
    perMonth: 2,
  },
};

/** Deterministic PRNG so the demo data looks the same every time. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roughly six months of realistic expenses ending today. */
export function generateSampleExpenses(today = new Date()): ExpenseInput[] {
  const random = mulberry32(42);
  const days = 180;
  const result: ExpenseInput[] = [];

  for (const [category, t] of Object.entries(TEMPLATES) as [Category, (typeof TEMPLATES)[Category]][]) {
    const count = Math.round((t.perMonth * days) / 30);
    for (let i = 0; i < count; i++) {
      const date = addDays(today, -Math.floor(random() * days));
      const amount = Math.round((t.min + random() * (t.max - t.min)) * 100) / 100;
      result.push({
        date: toISODate(date),
        amount,
        category,
        description: t.items[Math.floor(random() * t.items.length)],
      });
    }
  }
  return result;
}
