import { NextRequest, NextResponse } from "next/server";
import { migrateSchema } from "@/lib/db";

export async function POST(_request: NextRequest) {
  try {
    const result = await migrateSchema();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Migration error:", error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
