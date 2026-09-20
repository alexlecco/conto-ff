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

    // Check no_table_mode
    const { data: settings } = await supabase
      .from("bar_settings")
      .select("no_table_mode")
      .eq("bar_id", "bar-02-pin")
      .single();

    const noTableMode = settings?.no_table_mode ?? false;

    // Fetch category info
    const { data: catRows } = await supabase
      .from("categories")
      .select("id, name, visible_in_no_table_mode")
      .eq("bar_id", "bar-02-pin");

    const catMap = new Map<string, { name: string; visibleInNoTableMode: boolean }>();
    for (const row of catRows || []) {
      catMap.set(row.id, { name: row.name, visibleInNoTableMode: row.visible_in_no_table_mode });
    }

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

    // Filter items by no_table_mode
    const filteredItems = noTableMode
      ? (items || []).filter((item) => {
          const catInfo = catMap.get(item.category_id);
          return catInfo?.visibleInNoTableMode ?? false;
        })
      : items || [];

    // Group by category — start with all categories from the categories table
    const categoryMap = new Map<string, { id: string; name: string; items: typeof filteredItems }>();

    for (const row of catRows || []) {
      if (!noTableMode || row.visible_in_no_table_mode) {
        categoryMap.set(row.id, {
          id: row.id,
          name: row.name,
          items: [],
        });
      }
    }

    for (const item of filteredItems) {
      if (!categoryMap.has(item.category_id)) {
        const catInfo = catMap.get(item.category_id);
        categoryMap.set(item.category_id, {
          id: item.category_id,
          name: catInfo?.name || item.category_id,
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

    return NextResponse.json({ categories, noTableMode });
  } catch {
    return NextResponse.json(
      { error: "Error loading menu" },
      { status: 500 }
    );
  }
}
