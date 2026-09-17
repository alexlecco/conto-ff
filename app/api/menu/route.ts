import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getFileNameFromPublicUrl(url: string): string | null {
  const match = url.match(/\/menu-images\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: NextRequest) {
  try {
    const bust = request.nextUrl.searchParams.get("t");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: items, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("bar_id", "bar-02-pin")
      .order("category_sort_order")
      .order("sort_order");

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: "Error loading menu" }, { status: 500 });
    }

    // Convert public URLs to signed URLs for images
    const imageUpdates = new Map<string, string>();
    for (const item of items || []) {
      if (item.image_url && !item.image_url.includes("/object/sign/")) {
        const fileName = getFileNameFromPublicUrl(item.image_url);
        if (fileName) {
          const { data } = await supabase.storage
            .from("menu-images")
            .createSignedUrl(fileName, 60 * 60 * 24 * 365);
          if (data) imageUpdates.set(item.id, data.signedUrl);
        }
      }
    }

    // Group by category
    const categoryMap = new Map<string, { id: string; name: string; items: typeof items }>();

    for (const item of items || []) {
      if (!categoryMap.has(item.category_id)) {
        categoryMap.set(item.category_id, {
          id: item.category_id,
          name: getCategoryName(item.category_id),
          items: [],
        });
      }
      categoryMap.get(item.category_id)!.items.push(item);
    }

    // Build response matching expected format
    const categories = Array.from(categoryMap.values()).map((cat) => ({
      id: cat.id,
      name: cat.name,
      items: cat.items
        .filter((item) => item.price !== null || item.price === 0)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          available: item.available,
          image_url: imageUpdates.get(item.id) || item.image_url || null,
          currency: "ARS",
          variants: [],
        })),
    }));

    return NextResponse.json(categories);
  } catch {
    return NextResponse.json(
      { error: "Error loading menu" },
      { status: 500 }
    );
  }
}

function getCategoryName(id: string): string {
  const names: Record<string, string> = {
    "entradas": "Entradas",
    "tacos": "Tacos",
    "burritos": "Burritos",
    "completas": "Completas",
    "ensaladas": "Ensaladas",
    "postres": "Postres",
    "bebidas": "Bebidas",
    "cervezas": "Cervezas",
    "tragos": "Tragos",
    "vinos": "Vinos",
    "sin-alcohol": "Sin Alcohol",
    "extras": "Extras",
    "picadas": "Picadas",
  };
  return names[id] || id;
}
