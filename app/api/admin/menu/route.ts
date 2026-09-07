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

async function requireAdmin(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing authorization" };
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
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

export async function GET() {
  try {
    const jsonPath = join(process.cwd(), "data", "backup-db.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
    const bar = raw.conto.bars.find(
      (b: { id: string }) => b.id === "bar-02-pin"
    );
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

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body: UpdatePayload = await request.json();
    const jsonPath = join(process.cwd(), "data", "backup-db.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    const bar = raw.conto.bars.find(
      (b: { id: string }) => b.id === "bar-02-pin"
    );
    if (!bar) {
      return NextResponse.json({ error: "Bar not found" }, { status: 404 });
    }

    const category = bar.menu.categories.find(
      (c: { id: string }) => c.id === body.categoryId
    );
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const item = category.items.find(
      (i: { id: string }) => i.id === body.itemId
    );
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (body.variantId) {
      const variant = item.variants?.find(
        (v: { id: string }) => v.id === body.variantId
      );
      if (!variant) {
        return NextResponse.json(
          { error: "Variant not found" },
          { status: 404 }
        );
      }
      if (body.variantName !== undefined) variant.name = body.variantName;
      if (body.variantPrice !== undefined) variant.price = body.variantPrice;
    } else {
      if (body.name !== undefined) item.name = body.name;
      if (body.description !== undefined) item.description = body.description;
      if (body.price !== undefined) item.price = body.price;
      if (body.available !== undefined) item.available = body.available;
    }

    writeFileSync(jsonPath, JSON.stringify(raw, null, 2), "utf-8");
    invalidateMenuCache();

    return NextResponse.json({ success: true, categories: bar.menu.categories });
  } catch {
    return NextResponse.json(
      { error: "Error updating menu" },
      { status: 500 }
    );
  }
}
