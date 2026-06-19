import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { getDb, ensureSeisaSnapshotsTable } from "@/lib/db";

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
    await ensureSeisaSnapshotsTable();

    const effectiveStart = startDate >= BASE_DATE && startDate ? startDate : BASE_DATE;
    const dateParams: unknown[] = [effectiveStart];
    const dateConditions = [`report_date >= $1`];
    if (endDate) {
      dateParams.push(endDate);
      dateConditions.push(`report_date <= $${dateParams.length}`);
    }
    const dateWhere = dateConditions.join(" AND ");

    // ── 精査数：seisa_snapshots から直接取得 ───────────────────
    const seisaRows = await sql.query(`
      SELECT
        report_date,
        person_name,
        SUM(seisa_count)::int AS seisa_count,
        SUM(fill_jf)::int     AS fill_jf,
        SUM(fill_sk)::int     AS fill_sk,
        SUM(fill_tk)::int     AS fill_tk,
        SUM(fill_gn)::int     AS fill_gn,
        SUM(fill_bk)::int     AS fill_bk
      FROM seisa_snapshots
      WHERE ${dateWhere}
      GROUP BY report_date, person_name
      HAVING SUM(seisa_count) > 0
      ORDER BY report_date, person_name
    `, dateParams);

    // ── 稼働時間：csv_uploads.worker_name ベース ───────────────
    const hoursParams: unknown[] = [effectiveStart];
    const hoursConditions = [`report_date >= $1`];
    if (endDate) {
      hoursParams.push(endDate);
      hoursConditions.push(`report_date <= $${hoursParams.length}`);
    }
    const hoursRows = await sql.query(`
      SELECT report_date, worker_name, SUM(COALESCE(work_hours, 0)) AS total_hours
      FROM csv_uploads
      WHERE worker_name IS NOT NULL AND worker_name != ''
        AND ${hoursConditions.join(" AND ")}
        AND report_date IS NOT NULL
      GROUP BY report_date, worker_name
    `, hoursParams);

    const hoursMap: Record<string, number> = {};
    for (const r of hoursRows) {
      const key = `${r.report_date}__${r.worker_name}`;
      hoursMap[key] = (hoursMap[key] ?? 0) + Number(r.total_hours);
    }

    // ── チーム・メンバー情報 ────────────────────────────────────
    const [teamsRes, membersRes] = await Promise.all([
      sql.query(`SELECT id, name FROM teams ORDER BY name`),
      sql.query(`SELECT tm.name, tm.team_id FROM team_members tm`),
    ]);

    const memberTeamMap: Record<string, string> = {};
    for (const m of membersRes) memberTeamMap[String(m.name)] = String(m.team_id);

    const ph = (s: number, h: number) => h > 0 ? Math.round(s / h * 10) / 10 : null;

    type FillCount = { filled: number; total: number };
    type DayMember = {
      name: string; seisa_count: number; work_hours: number; per_hour: number | null;
      fill: Record<string, FillCount>;
    };
    type DayEntry = {
      date: string; seisa_count: number; work_hours: number; per_hour: number | null;
      fill: Record<string, FillCount>; members: DayMember[];
    };

    const teamDayMap: Record<string, Record<string, DayMember[]>> = {};
    for (const team of teamsRes) teamDayMap[String(team.id)] = {};

    for (const row of seisaRows) {
      const name   = String(row.person_name);
      const teamId = memberTeamMap[name];
      if (!teamId || !teamDayMap[teamId]) continue;
      const date  = String(row.report_date);
      const seisa = Number(row.seisa_count);
      const hours = hoursMap[`${date}__${name}`] ?? 0;

      if (!teamDayMap[teamId][date]) teamDayMap[teamId][date] = [];
      teamDayMap[teamId][date].push({
        name, seisa_count: seisa, work_hours: hours, per_hour: ph(seisa, hours),
        fill: {
          時間振り: { filled: Number(row.fill_jf), total: seisa },
          席数:     { filled: Number(row.fill_sk), total: seisa },
          定休日:   { filled: Number(row.fill_tk), total: seisa },
          ジャンル: { filled: Number(row.fill_gn), total: seisa },
          備考:     { filled: Number(row.fill_bk), total: seisa },
        },
      });
    }

    const teams = teamsRes
      .map(team => {
        const tid    = String(team.id);
        const dayMap = teamDayMap[tid] ?? {};
        const days: DayEntry[] = Object.entries(dayMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, members]) => {
            const ts = members.reduce((s, m) => s + m.seisa_count, 0);
            const th = members.reduce((s, m) => s + m.work_hours,  0);
            const f  = (k: string) => members.reduce((s, m) => s + m.fill[k].filled, 0);
            return {
              date, seisa_count: ts, work_hours: th, per_hour: ph(ts, th),
              fill: {
                時間振り: { filled: f("時間振り"), total: ts },
                席数:     { filled: f("席数"),     total: ts },
                定休日:   { filled: f("定休日"),   total: ts },
                ジャンル: { filled: f("ジャンル"), total: ts },
                備考:     { filled: f("備考"),     total: ts },
              },
              members: members.sort((a, b) => b.seisa_count - a.seisa_count),
            };
          });

        const total_seisa = days.reduce((s, d) => s + d.seisa_count, 0);
        const total_hours = days.reduce((s, d) => s + d.work_hours,  0);
        return { id: tid, name: String(team.name), total_seisa, total_hours, days };
      })
      .filter(t => t.days.length > 0);

    return NextResponse.json({ success: true, teams });
  } catch (e) {
    console.error("Daily error:", e);
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}