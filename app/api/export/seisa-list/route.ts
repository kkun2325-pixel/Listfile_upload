import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb, withTransaction } from "@/lib/db";

const BOM = "﻿";
const BLANK = "(空白)";
const EXPORT_COLS = ["名前", "電話番号", "住所1", "住所2", "時間振り", "定休日", "席数", "ジャンル", "備考", "担当者"] as const;
type ExportCol = (typeof EXPORT_COLS)[number];

interface SeisaFilters {
  timeCategories?: string[];
  genres?: string[];
  bikou?: string[];
  seatMin?: number;
  seatMax?: number;
  seatBlank?: boolean;
  unassignedOnly?: boolean;
  excludeNameKeywords?: string[];
  excludeAddressKeywords?: string[];
  listRanks?: string[];  // リストランク絞り込み（例: ['1'] = ランク1のみ）
}

function buildWhere(f: SeisaFilters): { where: string; args: unknown[] } {
  const parts: string[] = [];
  const args: unknown[] = [];
  let i = 1;

  function addMultiFilter(col: string, values: string[]) {
    if (!values.length) return;
    const hasBlank = values.includes(BLANK);
    const real     = values.filter(v => v !== BLANK);
    const conds: string[] = [];
    if (hasBlank)    conds.push(`("${col}" IS NULL OR "${col}" = '')`);
    if (real.length) { conds.push(`"${col}" = ANY($${i}::text[])`); args.push(real); i++; }
    parts.push(`(${conds.join(" OR ")})`);
  }

  addMultiFilter("時間振り", f.timeCategories ?? []);
  addMultiFilter("ジャンル",  f.genres         ?? []);
  addMultiFilter("備考",     f.bikou           ?? []);

  const seatConds: string[] = [];
  if (f.seatBlank) seatConds.push(`("席数" IS NULL OR "席数" = '')`);
  if (f.seatMin !== undefined && !isNaN(f.seatMin)) {
    seatConds.push(`("席数" ~ '^[0-9]+$' AND CAST("席数" AS INTEGER) >= $${i})`);
    args.push(f.seatMin); i++;
  }
  if (f.seatMax !== undefined && !isNaN(f.seatMax)) {
    seatConds.push(`("席数" ~ '^[0-9]+$' AND CAST("席数" AS INTEGER) <= $${i})`);
    args.push(f.seatMax); i++;
  }
  if (seatConds.length) parts.push(`(${seatConds.join(" OR ")})`);

  if (f.unassignedOnly) parts.push(`(assigned_to IS NULL)`);

  // 店名 OR 住所 の除外キーワード（すべてOR結合）
  // 店名にAを含む OR 住所にBを含む → いずれかに該当すれば除外
  const excludeConds: string[] = [];

  for (const kw of f.excludeNameKeywords ?? []) {
    if (!kw.trim()) continue;
    excludeConds.push(`("名前" IS NOT NULL AND "名前" ILIKE $${i})`);
    args.push(`%${kw.trim()}%`); i++;
  }

  for (const kw of f.excludeAddressKeywords ?? []) {
    if (!kw.trim()) continue;
    // 住所1・住所2 は同じパラメータ番号で両方チェック
    excludeConds.push(`("住所1" IS NOT NULL AND "住所1" ILIKE $${i})`);
    excludeConds.push(`("住所2" IS NOT NULL AND "住所2" ILIKE $${i})`);
    args.push(`%${kw.trim()}%`); i++;
  }

  if (excludeConds.length > 0) {
    parts.push(`NOT (${excludeConds.join(" OR ")})`);
  }

  if (f.listRanks && f.listRanks.length > 0) {
    parts.push(`"リストランク" = ANY($${i}::text[])`);
    args.push(f.listRanks); i++;
  }

  return { where: parts.length > 0 ? "WHERE " + parts.join(" AND ") : "", args };
}

// アサイン管理用カラム・テーブルの初期化（冪等）
async function ensureSchema(query: (q: string, p?: unknown[]) => Promise<unknown[]>) {
  await query(`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS assigned_to    TEXT`);
  await query(`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS assigned_batch TEXT`);
  await query(`CREATE INDEX IF NOT EXISTS idx_csv_data_assigned_to ON csv_data(assigned_to)`);
  await query(`CREATE TABLE IF NOT EXISTS export_batches (
    id            TEXT PRIMARY KEY,
    created_at    TEXT NOT NULL,
    created_by    TEXT NOT NULL,
    members_json  TEXT NOT NULL,
    total_count   INTEGER NOT NULL DEFAULT 0
  )`);
}

// ── GET: 件数プレビュー ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filters: SeisaFilters = {
    timeCategories: sp.getAll("timeCategories").filter(Boolean),
    genres:         sp.getAll("genres").filter(Boolean),
    bikou:          sp.getAll("bikou").filter(Boolean),
    seatMin:  sp.get("seatMin")  ? Number(sp.get("seatMin"))  : undefined,
    seatMax:  sp.get("seatMax")  ? Number(sp.get("seatMax"))  : undefined,
    seatBlank:      sp.get("seatBlank")     === "true",
    unassignedOnly: sp.get("unassignedOnly") !== "false",
    excludeNameKeywords:    sp.get("excludeName")?.split(",").map(s => s.trim()).filter(Boolean),
    excludeAddressKeywords: sp.get("excludeAddress")?.split(",").map(s => s.trim()).filter(Boolean),
    listRanks: sp.getAll("listRanks").filter(Boolean),
  };

  try {
    const sql = getDb();
    await ensureSchema(sql.query.bind(sql));
    const { where, args } = buildWhere(filters);
    const r = await sql.query(`SELECT COUNT(*) AS cnt FROM csv_data ${where}`, args);
    return NextResponse.json({ success: true, total: Number(r[0]?.cnt ?? 0) });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}

// ── POST: CSV エクスポート ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  const payload = token ? verifyToken(token) : null;
  if (!payload)
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  try {
    const body           = await req.json();
    const filters: SeisaFilters = body.filters ?? {};
    const assignMode: "member" | "team" | "none" = body.assignMode ?? "none";
    const exportLimit    = Number(body.exportLimit ?? 0);

    // 個人アサイン用
    const members: string[] = body.members ?? [];
    const countPerMember    = Number(body.countPerMember ?? 0);
    // チームアサイン用
    const teamNames: string[] = body.teamNames ?? [];
    const countPerTeam        = Number(body.countPerTeam ?? 0);

    const useAssign =
      (assignMode === "member" && members.length > 0 && countPerMember > 0) ||
      (assignMode === "team"   && teamNames.length  > 0 && countPerTeam  > 0);

    const sql = getDb();
    await ensureSchema(sql.query.bind(sql));

    type Row = Record<string, unknown>;
    let exportedRows: Row[] = [];

    if (useAssign) {
      // ── トランザクション + FOR UPDATE SKIP LOCKED ──────────
      const batchId = crypto.randomUUID();
      const now     = new Date().toISOString();

      exportedRows = await withTransaction(async (query) => {
        const allRows: Row[] = [];
        const { where: baseWhere, args: baseArgs } = buildWhere({ ...filters, unassignedOnly: true });

        // アサイン対象のループ（個人 or チーム）
        const targets = assignMode === "member"
          ? members.map(name => ({ key: name, count: countPerMember, fillTantousha: true }))
          : teamNames.map(name => ({ key: name, count: countPerTeam,  fillTantousha: false }));

        for (const { key, count, fillTantousha } of targets) {
          const limitIdx = baseArgs.length + 1;

          // ① 未アサイン行を N 件ロック取得
          const rows = await query(
            `SELECT id, "名前", "電話番号", "住所1", "住所2", "時間振り", "定休日", "席数", "ジャンル", "備考", "担当者"
             FROM csv_data
             ${baseWhere}
             ORDER BY created_at
             LIMIT $${limitIdx}
             FOR UPDATE SKIP LOCKED`,
            [...baseArgs, count]
          );

          if (rows.length === 0) continue;

          // ② 即アサイン
          const ids = rows.map(r => String(r.id));
          await query(
            `UPDATE csv_data SET assigned_to = $1, assigned_batch = $2 WHERE id = ANY($3::text[])`,
            [key, batchId, ids]
          );

          // 個人アサインのみ担当者列を書き込む（チームアサインは空白のまま）
          if (fillTantousha) rows.forEach(r => { r["担当者"] = key; });

          allRows.push(...rows);
        }

        if (allRows.length === 0) return allRows;

        // ③ バッチメタデータを保存
        const membersJson = assignMode === "member"
          ? JSON.stringify(members.map(m  => ({ name: m,    count: countPerMember, type: "member" })))
          : JSON.stringify(teamNames.map(t => ({ name: t,   count: countPerTeam,   type: "team"   })));

        await query(
          `INSERT INTO export_batches (id, created_at, created_by, members_json, total_count)
           VALUES ($1, $2, $3, $4, $5)`,
          [batchId, now, payload.username, membersJson, allRows.length]
        );

        return allRows;
      });

    } else {
      // ── 通常エクスポート（アサインなし）─────────────────────
      const { where, args } = buildWhere(filters);
      const limitClause = exportLimit > 0 ? ` LIMIT ${exportLimit}` : "";
      exportedRows = await sql.query(
        `SELECT "名前", "電話番号", "住所1", "住所2", "時間振り", "定休日", "席数", "ジャンル", "備考", "担当者"
         FROM csv_data ${where} ORDER BY created_at${limitClause}`,
        args
      );
    }

    if (exportedRows.length === 0)
      return NextResponse.json({ success: false, message: "該当データが0件です" }, { status: 400 });

    // ── CSV 生成 ─────────────────────────────────────────────
    const esc = (v: string) => /[,"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = BOM + [
      EXPORT_COLS.join(","),
      ...exportedRows.map(row =>
        EXPORT_COLS.map((col: ExportCol) => esc(String(row[col] ?? ""))).join(",")
      ),
    ].join("\r\n");

    const today    = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `精査リスト_${today}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    console.error("Seisa list export error:", e);
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
