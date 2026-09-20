import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface BulkUpdatePayload {
  type: "bulk";
  updates: {
    categoryId: string;
    itemId: string;
    field: string;
    value: string | number | boolean | null;
    variantId?: string;
  }[];
}

interface CreateItemPayload {
  type: "create";
  categoryId: string;
  name: string;
  description?: string;
  price?: number;
}

interface DeleteItemPayload {
  type: "delete";
  categoryId: string;
  itemId: string;
}

interface ReorderPayload {
  type: "reorder";
  categoryId: string;
  itemIds: string[];
}

interface ReorderCategoriesPayload {
  type: "reorder-categories";
  categoryIds: string[];
}

interface ToggleNoTableModePayload {
  type: "toggle-no-table-mode";
  enabled: boolean;
}

interface CreateCategoryPayload {
  type: "create-category";
  name: string;
  visibleInNoTableMode?: boolean;
}

interface UpdateCategoryPayload {
  type: "update-category";
  categoryId: string;
  name?: string;
  visibleInNoTableMode?: boolean;
}

interface DeleteCategoryPayload {
  type: "delete-category";
  categoryId: string;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing authorization" };
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Decode JWT to get user ID
  let userId: string;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    userId = payload.sub;
    if (!userId) return { error: "Invalid token: no sub" };
  } catch {
    return { error: "Invalid token: decode failed" };
  }

  // Check admin role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { error: `Profile not found: ${profileError?.message}` };
  }

  if (profile.user_type !== "admin") {
    return { error: "Forbidden: not admin" };
  }

  return { userId };
}

async function getCategoryNameMap(supabase: ReturnType<typeof getSupabase>) {
  const { data: catRows } = await supabase
    .from("categories")
    .select("id, name, visible_in_no_table_mode")
    .eq("bar_id", "bar-02-pin");

  const map = new Map<string, { name: string; visibleInNoTableMode: boolean }>();
  for (const row of catRows || []) {
    map.set(row.id, { name: row.name, visibleInNoTableMode: row.visible_in_no_table_mode });
  }
  return map;
}

async function fetchAllCategories() {
  const supabase = getSupabase();
  const catMap = await getCategoryNameMap(supabase);

  const { data: items, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("bar_id", "bar-02-pin")
    .order("category_sort_order")
    .order("sort_order");

  if (error) throw error;

  const imageUpdates = new Map<string, string>();
  for (const item of items || []) {
    if (item.image_url && !item.image_url.includes("/object/sign/")) {
      const fileName = item.image_url.match(/\/menu-images\/([^?]+)/)?.[1];
      if (fileName) {
        const { data } = await supabase.storage
          .from("menu-images")
          .createSignedUrl(decodeURIComponent(fileName), 60 * 60 * 24 * 365);
        if (data) imageUpdates.set(item.id, data.signedUrl);
      }
    }
  }

  const categoryMap = new Map<string, { id: string; name: string; items: typeof items }>();

  // Start with all categories from the categories table (including empty ones)
  for (const [id, info] of catMap) {
    categoryMap.set(id, { id, name: info.name, items: [] });
  }

  for (const item of items || []) {
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

  return Array.from(categoryMap.values()).map((cat) => ({
    id: cat.id,
    name: cat.name,
    items: (cat.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      available: item.available,
      image_url: imageUpdates.get(item.id) || item.image_url || null,
      variants: [] as { id: string; name: string; price: number }[],
    })),
  }));
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

export async function GET() {
  try {
    const categories = await fetchAllCategories();
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json({ error: "Error loading menu" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = getSupabase();

    if (body.type === "create") {
      const payload = body as CreateItemPayload;
      const slug = payload.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Get max sort_order for category
      const { data: existing } = await supabase
        .from("menu_items")
        .select("sort_order")
        .eq("category_id", payload.categoryId)
        .order("sort_order", { ascending: false })
        .limit(1);

      const maxOrder = existing?.[0]?.sort_order ?? -1;

      const { error: insertErr } = await supabase
        .from("menu_items")
        .insert({
          id: `${slug}-${Date.now()}`,
          bar_id: "bar-02-pin",
          category_id: payload.categoryId,
          name: payload.name,
          description: payload.description || "",
          price: payload.price ?? 0,
          available: true,
          sort_order: maxOrder + 1,
        });

      if (insertErr) throw insertErr;

      const categories = await fetchAllCategories();
      return NextResponse.json({ success: true, categories });
    }

    if (body.type === "delete") {
      const payload = body as DeleteItemPayload;
      const { error: delErr } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", payload.itemId);

      if (delErr) throw delErr;

      const categories = await fetchAllCategories();
      return NextResponse.json({ success: true, categories });
    }

    if (body.type === "reorder") {
      const payload = body as ReorderPayload;

      // Update sort_order for each item
      for (let i = 0; i < payload.itemIds.length; i++) {
        await supabase
          .from("menu_items")
          .update({ sort_order: i })
          .eq("id", payload.itemIds[i]);
      }

      const categories = await fetchAllCategories();
      return NextResponse.json({ success: true, categories });
    }

    if (body.type === "reorder-categories") {
      const payload = body as ReorderCategoriesPayload;

      // Update category_sort_order for all items in each category
      for (let i = 0; i < payload.categoryIds.length; i++) {
        await supabase
          .from("menu_items")
          .update({ category_sort_order: i })
          .eq("category_id", payload.categoryIds[i])
          .eq("bar_id", "bar-02-pin");
      }

      const categories = await fetchAllCategories();
      return NextResponse.json({ success: true, categories });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err) {
    console.error("Admin menu POST error:", err);
    return NextResponse.json({ error: "Error processing request" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = getSupabase();

    if (body.type === "bulk") {
      const payload = body as BulkUpdatePayload;

      for (const u of payload.updates) {
        // Skip variant updates for now (not in Supabase schema)
        if (u.variantId) continue;

        const updateField: Record<string, unknown> = {};
        if (u.field === "name") updateField.name = u.value;
        if (u.field === "description") updateField.description = u.value;
        if (u.field === "price") updateField.price = Number(u.value);
        if (u.field === "available") updateField.available = u.value;

        if (Object.keys(updateField).length > 0) {
          const { error: updateErr } = await supabase
            .from("menu_items")
            .update(updateField)
            .eq("id", u.itemId);

          if (updateErr) {
            console.error("Update error:", updateErr);
          }
        }
      }

      const categories = await fetchAllCategories();
      return NextResponse.json({ success: true, categories });
    }

    if (body.type === "toggle-no-table-mode") {
      const payload = body as ToggleNoTableModePayload;
      const { error } = await supabase
        .from("bar_settings")
        .upsert({ bar_id: "bar-02-pin", no_table_mode: payload.enabled });
      if (error) throw error;
      const categories = await fetchAllCategories();
      return NextResponse.json({ success: true, categories });
    }

    if (body.type === "create-category") {
      const payload = body as CreateCategoryPayload;
      const slug = payload.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const { data: existing } = await supabase
        .from("categories")
        .select("sort_order")
        .eq("bar_id", "bar-02-pin")
        .order("sort_order", { ascending: false })
        .limit(1);
      const maxOrder = existing?.[0]?.sort_order ?? -1;
      const { error } = await supabase.from("categories").insert({
        id: slug,
        bar_id: "bar-02-pin",
        name: payload.name,
        sort_order: maxOrder + 1,
        visible_in_no_table_mode: payload.visibleInNoTableMode ?? false,
      });
      if (error) throw error;
      const categories = await fetchAllCategories();
      return NextResponse.json({ success: true, categories });
    }

    if (body.type === "update-category") {
      const payload = body as UpdateCategoryPayload;
      const update: Record<string, unknown> = {};
      if (payload.name !== undefined) update.name = payload.name;
      if (payload.visibleInNoTableMode !== undefined) update.visible_in_no_table_mode = payload.visibleInNoTableMode;
      if (Object.keys(update).length > 0) {
        const { error } = await supabase
          .from("categories")
          .update(update)
          .eq("id", payload.categoryId)
          .eq("bar_id", "bar-02-pin");
        if (error) throw error;
      }
      const categories = await fetchAllCategories();
      return NextResponse.json({ success: true, categories });
    }

    if (body.type === "delete-category") {
      const payload = body as DeleteCategoryPayload;
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", payload.categoryId)
        .eq("bar_id", "bar-02-pin");
      if (error) throw error;
      const categories = await fetchAllCategories();
      return NextResponse.json({ success: true, categories });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err) {
    console.error("Admin menu PUT error:", err);
    return NextResponse.json({ error: "Error updating menu" }, { status: 500 });
  }
}
