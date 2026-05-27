import { NextRequest, NextResponse } from "next/server";
import { getCSVDataByUploadId } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";
import { generateCSV } from "@/lib/csv";
import { sanitizePayload } from '@/lib/sanitize';

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

    const rawBody = await request.json();
    // sanitize incoming payload to remove internal/debug fields and invalid ids
    const { upload_id, rules } = sanitizePayload(rawBody);

    if (!upload_id) {
      return NextResponse.json(
        { success: false, message: "upload_id が必要です" },
        { status: 400 }
      );
    }

    // Get CSV data
    const csvData = await getCSVDataByUploadId(upload_id);

    // Apply filters
    let filteredData = csvData;
    if (rules && rules.length > 0) {
      filteredData = csvData.filter((row) => {
        return rules.every((rule: { field: string; operator: string; value: string }) => {
          const fieldValue = String(row.data[rule.field] || "");

          switch (rule.operator) {
            case "equals":
              return fieldValue === rule.value;
            case "contains":
              return fieldValue.includes(rule.value);
            case "starts_with":
              return fieldValue.startsWith(rule.value);
            case "greater_than":
              return Number(fieldValue) > Number(rule.value);
            case "less_than":
              return Number(fieldValue) < Number(rule.value);
            default:
              return true;
          }
        });
      });
    }

    // Get headers from first row
    const headers =
      filteredData.length > 0
        ? Object.keys(filteredData[0].data)
        : [];

    // Generate CSV
    const csv = generateCSV(
      headers,
      filteredData.map((row) => row.data)
    );

    // Return as download
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=export.csv",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { success: false, message: "エクスポート処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
