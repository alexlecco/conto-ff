import { loadPintaTacosMenu, invalidateMenuCache } from "@/lib/menu-data";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const bust = request.nextUrl.searchParams.get("t");
    if (bust) invalidateMenuCache();
    const menu = loadPintaTacosMenu();
    return NextResponse.json(menu);
  } catch {
    return NextResponse.json(
      { error: "Error loading menu" },
      { status: 500 }
    );
  }
}
