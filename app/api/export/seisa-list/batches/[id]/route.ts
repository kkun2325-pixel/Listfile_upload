import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

// DELETE: バッチ取り消し（アサインを全件リセット）
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  try {
    const sql = getDb();
    const { id } = params;

    // アサインをリセット
    const reset = await sql.query(
      `UPDATE csv_data
       SET assigned_to = NULL, assigned_batch = NULL
       WHERE assigned_batch = $1
       RETURNING id`,
      [id]
    );

    // バッチレコードを削除
    await sql.query(`DELETE FROM export_batches WHERE id = $1`, [id]);

    return NextResponse.json({ success: true, reset_count: reset.length });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
