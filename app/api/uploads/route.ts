import { NextRequest, NextResponse } from "next/server";
import { getCSVUploadsByUserId, getDuplicateCount } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = extractToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { success: false, message: "認証が必要です" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "無効なトークンです" },
        { status: 401 }
      );
    }

    // Get uploads
    const uploads = await getCSVUploadsByUserId(decoded.userId);

    // Get duplicate counts for each upload
    const uploadsWithDuplicates = await Promise.all(
      uploads.map(async (upload) => ({
        ...upload,
        duplicate_count: await getDuplicateCount(upload.id),
      }))
    );

    return NextResponse.json(
      {
        success: true,
        uploads: uploadsWithDuplicates,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Fetch uploads error:", error);
    return NextResponse.json(
      { success: false, message: "データ取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
