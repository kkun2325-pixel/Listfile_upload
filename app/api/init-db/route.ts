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
    console.error("Database initialization error:", error);
    return NextResponse.json(
      { success: false, message: "データベース初期化中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
