import { NextRequest, NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db";

export async function POST(_request: NextRequest) {
  try {
    await initializeDatabase();
    return NextResponse.json(
      { success: true, message: "データベースを初期化しました" },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Database initialization error:", error);
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}
