import { loadPintaTacosMenu } from "@/lib/menu-data";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const menu = loadPintaTacosMenu();
    return NextResponse.json(menu);
  } catch {
    return NextResponse.json(
      { error: "Error loading menu" },
      { status: 500 }
    );
  }
}
