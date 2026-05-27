import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createCSVUpload,
  insertCSVData,
  checkDuplicate,
} from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";
import { parseCSV, extractPhoneNumber } from "@/lib/csv";

export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "ファイルが見つかりません" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { success: false, message: "CSVファイルのみアップロード可能です" },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();
    const parseResult = await parseCSV(content);

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "CSVファイルの解析に失敗しました",
        },
        { status: 400 }
      );
    }

    // Create upload record
    const uploadId = uuidv4();
    await createCSVUpload(
      uploadId,
      decoded.userId,
      uploadId,
      file.name,
      file.size,
      parseResult.data.length
    );

    // Insert CSV data
    let duplicateCount = 0;
    for (let i = 0; i < parseResult.data.length; i++) {
      const row = parseResult.data[i];
      const phoneNumber = extractPhoneNumber(row);
      const dataId = uuidv4();

      // Check for duplicates
      if (phoneNumber) {
        const isDuplicate = await checkDuplicate(phoneNumber);
        if (isDuplicate) {
          duplicateCount++;
        }
      }

      await insertCSVData(dataId, uploadId, i + 1, row, phoneNumber || undefined);
    }

    return NextResponse.json(
      {
        success: true,
        message: "ファイルをアップロードしました",
        upload_id: uploadId,
        row_count: parseResult.data.length,
        duplicate_count: duplicateCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, message: "アップロード処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
