import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { invalidateMenuCache } from "@/lib/menu-data";
import { createClient } from "@supabase/supabase-js";

interface UpdatePayload {
  categoryId: string;
  itemId: string;
  name?: string;
  description?: string | null;
  price?: number;
  available?: boolean;
  variantId?: string;
  variantName?: string;
  variantPrice?: number;
}

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

async function requireAdmin(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing authorization" };
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (!profile || profile.user_type !== "admin") {
    return { error: "Forbidden" };
  }

  return { userId: user.id };
}

function loadBar() {
  const jsonPath = join(process.cwd(), "data", "backup-db.json");
  const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
  const bar = raw.conto.bars.find(
    (b: { id: string }) => b.id === "bar-02-pin"
  );
  return { raw, bar, jsonPath };
}

export async function GET() {
  try {
    const { bar } = loadBar();
    if (!bar) {
      return NextResponse.json({ error: "Bar not found" }, { status: 404 });
    }
    return NextResponse.json(bar.menu.categories);
  } catch {
    return NextResponse.json(
      { error: "Error loading menu" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.type === "create") {
      const payload = body as CreateItemPayload;
      const { bar, jsonPath } = loadBar();
      if (!bar) {
        return NextResponse.json({ error: "Bar not found" }, { status: 404 });
      }

      const category = bar.menu.categories.find(
        (c: { id: string }) => c.id === payload.categoryId
      );
      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }

      const slug = payload.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const newItem = {
        id: `${slug}-${Date.now()}`,
        name: payload.name,
        description: payload.description || null,
        price: payload.price ?? null,
        currency: "ARS",
        available: true,
        variants: [],
      };

      category.items.push(newItem);
      writeFileSync(jsonPath, JSON.stringify(bar, null, 2), "utf-8");
      invalidateMenuCache();

      return NextResponse.json({
        success: true,
        categories: bar.menu.categories,
      });
    }

    if (body.type === "delete") {
      const payload = body as DeleteItemPayload;
      const { bar, jsonPath } = loadBar();
      if (!bar) {
        return NextResponse.json({ error: "Bar not found" }, { status: 404 });
      }

      const category = bar.menu.categories.find(
        (c: { id: string }) => c.id === payload.categoryId
      );
      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }

      category.items = category.items.filter(
        (i: { id: string }) => i.id !== payload.itemId
      );
      writeFileSync(jsonPath, JSON.stringify(bar, null, 2), "utf-8");
      invalidateMenuCache();

      return NextResponse.json({
        success: true,
        categories: bar.menu.categories,
      });
    }

    if (body.type === "reorder") {
      const payload = body as ReorderPayload;
      const { bar, jsonPath } = loadBar();
      if (!bar) {
        return NextResponse.json({ error: "Bar not found" }, { status: 404 });
      }

      const category = bar.menu.categories.find(
        (c: { id: string }) => c.id === payload.categoryId
      );
      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }

      const itemMap = new Map(
        category.items.map((i: { id: string }) => [i.id, i])
      );
      category.items = payload.itemIds
        .map((id) => itemMap.get(id))
        .filter(Boolean);

      writeFileSync(jsonPath, JSON.stringify(bar, null, 2), "utf-8");
      invalidateMenuCache();

      return NextResponse.json({
        success: true,
        categories: bar.menu.categories,
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Error processing request" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.type === "bulk") {
      const payload = body as BulkUpdatePayload;
      const { bar, jsonPath } = loadBar();
      if (!bar) {
        return NextResponse.json({ error: "Bar not found" }, { status: 404 });
      }

      for (const u of payload.updates) {
        const category = bar.menu.categories.find(
          (c: { id: string }) => c.id === u.categoryId
        );
        if (!category) continue;

        const item = category.items.find(
          (i: { id: string }) => i.id === u.itemId
        );
        if (!item) continue;

        if (u.variantId) {
          const variant = item.variants?.find(
            (v: { id: string }) => v.id === u.variantId
          );
          if (!variant) continue;
          if (u.field === "name") variant.name = u.value as string;
          if (u.field === "price") variant.price = Number(u.value);
        } else {
          if (u.field === "name") item.name = u.value as string;
          if (u.field === "description")
            item.description = u.value as string | null;
          if (u.field === "price") item.price = Number(u.value);
          if (u.field === "available") item.available = u.value as boolean;
        }
      }

      writeFileSync(jsonPath, JSON.stringify(bar, null, 2), "utf-8");
      invalidateMenuCache();

      return NextResponse.json({
        success: true,
        categories: bar.menu.categories,
      });
    }

    // Single update (backwards compatible)
    const single = body as UpdatePayload;
    const { bar, jsonPath } = loadBar();
    if (!bar) {
      return NextResponse.json({ error: "Bar not found" }, { status: 404 });
    }

    const category = bar.menu.categories.find(
      (c: { id: string }) => c.id === single.categoryId
    );
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const item = category.items.find(
      (i: { id: string }) => i.id === single.itemId
    );
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (single.variantId) {
      const variant = item.variants?.find(
        (v: { id: string }) => v.id === single.variantId
      );
      if (!variant) {
        return NextResponse.json(
          { error: "Variant not found" },
          { status: 404 }
        );
      }
      if (single.variantName !== undefined) variant.name = single.variantName;
      if (single.variantPrice !== undefined)
        variant.price = single.variantPrice;
    } else {
      if (single.name !== undefined) item.name = single.name;
      if (single.description !== undefined)
        item.description = single.description;
      if (single.price !== undefined) item.price = single.price;
      if (single.available !== undefined) item.available = single.available;
    }

    writeFileSync(jsonPath, JSON.stringify(bar, null, 2), "utf-8");
    invalidateMenuCache();

    return NextResponse.json({
      success: true,
      categories: bar.menu.categories,
    });
  } catch {
    return NextResponse.json(
      { error: "Error updating menu" },
      { status: 500 }
    );
  }
}
