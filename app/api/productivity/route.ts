import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

const BASE_DATE = "2026-06-01";

export async function GET(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  const payload = token ? verifyToken(token) : null;
  if (!payload)
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
  if (payload.role !== "manager")
    return NextResponse.json({ success: false, message: "アクセス権限がありません" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start") ?? "";
  const endDate   = searchParams.get("end")   ?? "";

  try {
    const sql = getDb();

    try {
      await sql.query(`ALTER TABLE csv_data ADD COLUMN IF NOT EXISTS is_data_changed INTEGER NOT NULL DEFAULT 1`);
    } catch { /* already exists */ }

    try {
      await Promise.all([
        sql.query(`CREATE INDEX IF NOT EXISTS idx_csv_uploads_report_date ON csv_uploads(report_date)`),
        sql.query(`CREATE INDEX IF NOT EXISTS idx_csv_uploads_worker_name  ON csv_uploads(worker_name)`),
      ]);
    } catch { /* already exists */ }

    const effectiveStart = startDate >= BASE_DATE && startDate ? startDate : BASE_DATE;
    const dateParams: unknown[] = [effectiveStart];
    const dateConditions = [`cu.report_date >= $1`];
    if (endDate) {
      dateParams.push(endDate);
      dateConditions.push(`cu.report_date <= $${dateParams.length}`);
    }
    const dateWhere = dateConditions.join(" AND ");

    // ── 1. 精査数・充填数：担当者列の名前でグループ化 ─────────
    // worker_name との一致条件を廃止。
    // まとめアップロード（1人が複数名分をアップロード）に対応するため、
    // 担当者列に書かれた実際の作業者名ベースで集計する。
    const seisaStats = await sql.query(`
      SELECT
        regexp_replace(cd."担当者", '[0-9].*$', '')  AS person_name,
        COUNT(cd.id)                                  AS seisa_count,
        SUM(CASE WHEN cd."時間振り" IS NOT NULL AND cd."時間振り" != '' THEN 1 ELSE 0 END) AS fill_jf,
        SUM(CASE WHEN (cd."席数" IS NOT NULL AND cd."席数" != '')
                   OR cd."時間振り" IN ('閉店','業種対象外','情報不足','掲載保留','本社×','外人×','重複')
                 THEN 1 ELSE 0 END) AS fill_sk,
        SUM(CASE WHEN (cd."定休日" IS NOT NULL AND cd."定休日" != '')
                   OR cd."時間振り" IN ('閉店','業種対象外','情報不足','掲載保留','本社×','外人×','重複')
                 THEN 1 ELSE 0 END) AS fill_tk,
        SUM(CASE WHEN (cd."ジャンル" IS NOT NULL AND cd."ジャンル" != '')
                   OR cd."時間振り" IN ('閉店','業種対象外','情報不足','掲載保留','本社×','外人×','重複')
                 THEN 1 ELSE 0 END) AS fill_gn,
        SUM(CASE WHEN (cd."備考" IS NOT NULL AND cd."備考" != '')
                   OR cd."時間振り" IN ('閉店','業種対象外','情報不足','掲載保留','本社×','外人×','重複')
                 THEN 1 ELSE 0 END) AS fill_bk
      FROM csv_uploads cu
      JOIN csv_data cd ON cd.upload_id = cu.id
      WHERE ${dateWhere}
        AND cu.report_date IS NOT NULL
        AND cd."担当者" IS NOT NULL AND cd."担当者" != ''
        AND LEFT(regexp_replace(cd."担当者", '^[^0-9]+', ''), 4)
            = SUBSTRING(cu.report_date, 6, 2) || SUBSTRING(cu.report_date, 9, 2)
        AND cd."時間振り" IS NOT NULL AND cd."時間振り" != ''
        AND cd.is_data_changed = 1
      GROUP BY regexp_replace(cd."担当者", '[0-9].*$', '')
      HAVING COUNT(cd.id) > 0
    `, dateParams);

    // ── 2. 稼働時間：worker_name ベース（別途集計）────────────
    // 精査数とは独立して、アップロード時に登録された稼働時間を worker_name で集計する
    const hoursParams: unknown[] = [effectiveStart];
    const hoursConditions = [`report_date >= $1`];
    if (endDate) {
      hoursParams.push(endDate);
      hoursConditions.push(`report_date <= $${hoursParams.length}`);
    }
    const hoursStats = await sql.query(`
      SELECT worker_name, SUM(COALESCE(work_hours, 0)) AS total_hours
      FROM csv_uploads
      WHERE worker_name IS NOT NULL AND worker_name != ''
        AND ${hoursConditions.join(" AND ")}
        AND report_date IS NOT NULL
      GROUP BY worker_name
    `, hoursParams);

    // ── 3. 2つの集計を person名 で合算 ────────────────────────
    type WStats = { seisa: number; hours: number; fill_jf: number; fill_sk: number; fill_tk: number; fill_gn: number; fill_bk: number };
    const workerMap: Record<string, WStats> = {};

    for (const row of seisaStats) {
      const name = String(row.person_name);
      if (!workerMap[name]) workerMap[name] = { seisa: 0, hours: 0, fill_jf: 0, fill_sk: 0, fill_tk: 0, fill_gn: 0, fill_bk: 0 };
      workerMap[name].seisa   += Number(row.seisa_count);
      workerMap[name].fill_jf += Number(row.fill_jf);
      workerMap[name].fill_sk += Number(row.fill_sk);
      workerMap[name].fill_tk += Number(row.fill_tk);
      workerMap[name].fill_gn += Number(row.fill_gn);
      workerMap[name].fill_bk += Number(row.fill_bk);
    }

    for (const row of hoursStats) {
      const name = String(row.worker_name);
      if (!workerMap[name]) workerMap[name] = { seisa: 0, hours: 0, fill_jf: 0, fill_sk: 0, fill_tk: 0, fill_gn: 0, fill_bk: 0 };
      workerMap[name].hours += Number(row.total_hours);
    }

    // ── 4. チーム・メンバー情報 ────────────────────────────────
    const [teamsRes, membersRes] = await Promise.all([
      sql.query(`SELECT id, name FROM teams ORDER BY name`),
      sql.query(`SELECT tm.name, tm.team_id FROM team_members tm`),
    ]);
    const memberTeamMap: Record<string, string> = {};
    const teamMembersMap: Record<string, string[]> = {};
    for (const m of membersRes) {
      memberTeamMap[String(m.name)] = String(m.team_id);
      if (!teamMembersMap[String(m.team_id)]) teamMembersMap[String(m.team_id)] = [];
      teamMembersMap[String(m.team_id)].push(String(m.name));
    }

    // ── 5. 対象外理由：担当者列の名前でグループ化 ───────────────
    const taigaiMap: Record<string, Record<string, number>> = {};
    const taigaiRows = await sql.query(`
      SELECT
        regexp_replace(cd."担当者", '[0-9].*$', '') AS person_name,
        cd."時間振り" AS reason,
        COUNT(*) AS cnt
      FROM csv_data cd
      JOIN csv_uploads cu ON cd.upload_id = cu.id
      WHERE cd."時間振り" IN ('閉店','業種対象外','情報不足','掲載保留','本社×','外人×','重複')
        AND ${dateWhere}
        AND cu.report_date IS NOT NULL
        AND cd."担当者" IS NOT NULL AND cd."担当者" != ''
        AND LEFT(regexp_replace(cd."担当者", '^[^0-9]+', ''), 4)
            = SUBSTRING(cu.report_date, 6, 2) || SUBSTRING(cu.report_date, 9, 2)
        AND cd.is_data_changed = 1
      GROUP BY regexp_replace(cd."担当者", '[0-9].*$', ''), cd."時間振り"
    `, dateParams);
    for (const row of taigaiRows) {
      const w = String(row.person_name);
      const r = String(row.reason);
      if (!taigaiMap[w]) taigaiMap[w] = {};
      taigaiMap[w][r] = (taigaiMap[w][r] ?? 0) + Number(row.cnt);
    }

    // ── 6. チームごとのデータ組み立て ────────────────────────
    const rate = (num: number, den: number) => den > 0 ? Math.round(num / den * 1000) / 10 : null;
    const ph   = (seisa: number, hours: number) => hours > 0 ? Math.round(seisa / hours * 10) / 10 : null;

    const teams = teamsRes.map(team => {
      const tid    = String(team.id);
      const tname  = String(team.name);
      const mnames = teamMembersMap[tid] ?? [];

      const members = mnames
        .filter(n => workerMap[n])
        .map(name => {
          const w = workerMap[name];
          return {
            name,
            seisa_count: w.seisa,
            work_hours:  w.hours,
            per_hour:    ph(w.seisa, w.hours),
            fill: {
              時間振り: { filled: w.fill_jf, missing: w.seisa - w.fill_jf, rate: rate(w.fill_jf, w.seisa) },
              席数:     { filled: w.fill_sk, missing: w.seisa - w.fill_sk, rate: rate(w.fill_sk, w.seisa) },
              定休日:   { filled: w.fill_tk, missing: w.seisa - w.fill_tk, rate: rate(w.fill_tk, w.seisa) },
              ジャンル: { filled: w.fill_gn, missing: w.seisa - w.fill_gn, rate: rate(w.fill_gn, w.seisa) },
              備考:     { filled: w.fill_bk, missing: w.seisa - w.fill_bk, rate: rate(w.fill_bk, w.seisa) },
            },
          };
        })
        .sort((a, b) => b.seisa_count - a.seisa_count);

      const teamSeisa = members.reduce((s, m) => s + m.seisa_count, 0);
      const teamHours = members.reduce((s, m) => s + m.work_hours,  0);
      const fill_jf   = members.reduce((s, m) => s + m.fill.時間振り.filled, 0);
      const fill_sk   = members.reduce((s, m) => s + m.fill.席数.filled,     0);
      const fill_tk   = members.reduce((s, m) => s + m.fill.定休日.filled,   0);
      const fill_gn   = members.reduce((s, m) => s + m.fill.ジャンル.filled, 0);
      const fill_bk   = members.reduce((s, m) => s + m.fill.備考.filled,     0);

      const teamTaigai: Record<string, number> = {};
      for (const n of mnames) {
        for (const [reason, cnt] of Object.entries(taigaiMap[n] ?? {})) {
          teamTaigai[reason] = (teamTaigai[reason] ?? 0) + cnt;
        }
      }
      const taigaiTotal = Object.values(teamTaigai).reduce((s, c) => s + c, 0);
      const taigai = Object.entries(teamTaigai)
        .map(([reason, count]) => ({ reason, count, rate: rate(count, taigaiTotal) ?? 0 }))
        .sort((a, b) => b.count - a.count);

      return {
        id: tid, name: tname,
        seisa_count: teamSeisa,
        work_hours:  teamHours,
        per_hour:    ph(teamSeisa, teamHours),
        fill_rates: {
          時間振り: rate(fill_jf, teamSeisa),
          席数:     rate(fill_sk, teamSeisa),
          定休日:   rate(fill_tk, teamSeisa),
          ジャンル: rate(fill_gn, teamSeisa),
          備考:     rate(fill_bk, teamSeisa),
          avg: teamSeisa > 0
            ? Math.round((fill_jf + fill_sk + fill_tk + fill_gn + fill_bk) / (teamSeisa * 5) * 1000) / 10
            : null,
        },
        taigai,
        members,
      };
    });

    const total_work_hours = Object.values(workerMap).reduce((s, w) => s + w.hours, 0);

    return NextResponse.json({ success: true, total_work_hours, teams });
  } catch (e) {
    console.error("Productivity error:", e);
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
