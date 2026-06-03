import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

// 各フィルタ条件を1つずつ外してカウントし、どこで件数が落ちているか診断する
export async function GET(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== "manager")
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const start = sp.get("start") ?? "2026-06-01";
  const end   = sp.get("end")   ?? "";

  try {
    const sql = getDb();

    const dateArgs: unknown[] = [start];
    const dateWhere = end
      ? `cu.report_date >= $1 AND cu.report_date <= $2`
      : `cu.report_date >= $1`;
    if (end) dateArgs.push(end);

    // ① 時間振りが入力されている（最も緩い条件）
    const [r1] = await sql.query(`
      SELECT COUNT(cd.id) AS cnt
      FROM csv_uploads cu
      JOIN csv_data cd ON cd.upload_id = cu.id
      WHERE cu.worker_name IS NOT NULL AND cu.worker_name != ''
        AND ${dateWhere}
        AND cu.report_date IS NOT NULL
        AND cd."時間振り" IS NOT NULL AND cd."時間振り" != ''
    `, dateArgs);

    // ② + 担当者列が空でない
    const [r2] = await sql.query(`
      SELECT COUNT(cd.id) AS cnt
      FROM csv_uploads cu
      JOIN csv_data cd ON cd.upload_id = cu.id
      WHERE cu.worker_name IS NOT NULL AND cu.worker_name != ''
        AND ${dateWhere}
        AND cu.report_date IS NOT NULL
        AND cd."時間振り" IS NOT NULL AND cd."時間振り" != ''
        AND cd."担当者" IS NOT NULL AND cd."担当者" != ''
    `, dateArgs);

    // ③ + 担当者の名前部分 = worker_name
    const [r3] = await sql.query(`
      SELECT COUNT(cd.id) AS cnt
      FROM csv_uploads cu
      JOIN csv_data cd ON cd.upload_id = cu.id
      WHERE cu.worker_name IS NOT NULL AND cu.worker_name != ''
        AND ${dateWhere}
        AND cu.report_date IS NOT NULL
        AND cd."時間振り" IS NOT NULL AND cd."時間振り" != ''
        AND cd."担当者" IS NOT NULL AND cd."担当者" != ''
        AND regexp_replace(cd."担当者", '[0-9].*$', '') = cu.worker_name
    `, dateArgs);

    // ④ + 担当者の日付4桁 = アップロード日MMDD
    const [r4] = await sql.query(`
      SELECT COUNT(cd.id) AS cnt
      FROM csv_uploads cu
      JOIN csv_data cd ON cd.upload_id = cu.id
      WHERE cu.worker_name IS NOT NULL AND cu.worker_name != ''
        AND ${dateWhere}
        AND cu.report_date IS NOT NULL
        AND cd."時間振り" IS NOT NULL AND cd."時間振り" != ''
        AND cd."担当者" IS NOT NULL AND cd."担当者" != ''
        AND regexp_replace(cd."担当者", '[0-9].*$', '') = cu.worker_name
        AND LEFT(regexp_replace(cd."担当者", '^[^0-9]+', ''), 4)
            = SUBSTRING(cu.report_date, 6, 2) || SUBSTRING(cu.report_date, 9, 2)
    `, dateArgs);

    // ⑤ + is_data_changed = 1（現在の完全条件）
    const [r5] = await sql.query(`
      SELECT COUNT(cd.id) AS cnt
      FROM csv_uploads cu
      JOIN csv_data cd ON cd.upload_id = cu.id
      WHERE cu.worker_name IS NOT NULL AND cu.worker_name != ''
        AND ${dateWhere}
        AND cu.report_date IS NOT NULL
        AND cd."時間振り" IS NOT NULL AND cd."時間振り" != ''
        AND cd."担当者" IS NOT NULL AND cd."担当者" != ''
        AND regexp_replace(cd."担当者", '[0-9].*$', '') = cu.worker_name
        AND LEFT(regexp_replace(cd."担当者", '^[^0-9]+', ''), 4)
            = SUBSTRING(cu.report_date, 6, 2) || SUBSTRING(cu.report_date, 9, 2)
        AND cd.is_data_changed = 1
    `, dateArgs);

    // 担当者列のサンプルを取得（どんな形式か確認）
    const samples = await sql.query(`
      SELECT cd."担当者", cu.worker_name, cu.report_date
      FROM csv_uploads cu
      JOIN csv_data cd ON cd.upload_id = cu.id
      WHERE cu.worker_name IS NOT NULL AND cu.worker_name != ''
        AND ${dateWhere}
        AND cu.report_date IS NOT NULL
        AND cd."担当者" IS NOT NULL AND cd."担当者" != ''
        AND cd."時間振り" IS NOT NULL AND cd."時間振り" != ''
      ORDER BY cu.report_date DESC
      LIMIT 10
    `, dateArgs);

    return NextResponse.json({
      success: true,
      period: { start, end: end || "(指定なし)" },
      funnel: [
        { step: "① 時間振り入力済み（担当者条件なし）",  count: Number(r1?.cnt ?? 0) },
        { step: "② + 担当者列が空でない",               count: Number(r2?.cnt ?? 0) },
        { step: "③ + 担当者名 = worker_name",          count: Number(r3?.cnt ?? 0) },
        { step: "④ + 担当者の日付4桁 = 作業日MMDD",    count: Number(r4?.cnt ?? 0) },
        { step: "⑤ + is_data_changed = 1（現在の値）", count: Number(r5?.cnt ?? 0) },
      ],
      samples: samples.map(s => ({
        担当者: String(s["担当者"] ?? ""),
        worker_name: String(s.worker_name ?? ""),
        report_date: String(s.report_date ?? ""),
        抽出名前: String(s["担当者"] ?? "").replace(/[0-9].*$/, ""),
        抽出日付4桁: String(s["担当者"] ?? "").replace(/^[^0-9]+/, "").slice(0, 4),
        期待日付: String(s.report_date ?? "").slice(5, 7) + String(s.report_date ?? "").slice(8, 10),
        日付一致: String(s["担当者"] ?? "").replace(/^[^0-9]+/, "").slice(0, 4)
          === String(s.report_date ?? "").slice(5, 7) + String(s.report_date ?? "").slice(8, 10),
      })),
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
