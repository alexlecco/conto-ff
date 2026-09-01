import { readFileSync } from "fs";
import { join } from "path";
import type { MenuCategory, MenuItem, MenuItemVariant } from "@/types/menu";

interface RawVariant {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

interface RawItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  available: boolean;
  variants?: RawVariant[];
}

interface RawCategory {
  id: string;
  name: string;
  items: RawItem[];
}

interface RawBar {
  id: string;
  name: string;
  menu: {
    categories: RawCategory[];
  };
}

interface RawData {
  conto: {
    bars: RawBar[];
  };
}

let cachedMenu: MenuCategory[] | null = null;

export function loadPintaTacosMenu(): MenuCategory[] {
  if (cachedMenu) return cachedMenu;

  const jsonPath = join(process.cwd(), "data", "backup-db.json");
  const raw: RawData = JSON.parse(readFileSync(jsonPath, "utf-8"));

  const bar = raw.conto.bars.find((b) => b.id === "bar-02-pin");

  if (!bar) {
    throw new Error("Pinta Tacos not found in backup-db.json");
  }

  cachedMenu = bar.menu.categories.map((cat): MenuCategory => ({
    id: cat.id,
    name: cat.name,
    items: cat.items
      .filter((item) => item.price !== null || (item.variants && item.variants.length > 0))
      .map((item): MenuItem => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        available: item.available,
        variants: (item.variants || []).map((v): MenuItemVariant => ({
          id: v.id,
          name: v.name,
          price: v.price,
          available: v.available,
        })),
      })),
  }));

  return cachedMenu!;
}
