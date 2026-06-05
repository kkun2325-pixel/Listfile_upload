import { NextRequest, NextResponse } from "next/server";
import { getSharepointFiles } from "@/lib/db";

/**
 * Vercel Cron / 外部スケジューラーから毎日19時に呼ばれる
 * 自動同期が有効な全ファイルをループして /api/sharepoint-files/[id]/sync を呼ぶ
 *
 * 呼び出し方:
 *   Authorization: Bearer <CRON_SECRET>
 *   または x-cron-secret: <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  // 認証
  const cronSecret = process.env.CRON_SECRET;
  const incoming =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!cronSecret || incoming !== cronSecret) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const files = await getSharepointFiles();
  const targets = files.filter(f => f.auto_sync_enabled === 1);

  const origin = request.nextUrl.origin;
  const results: { id: string; name: string; success: boolean; message: string }[] = [];

  for (const file of targets) {
    try {
      const res = await fetch(`${origin}/api/sharepoint-files/${file.id}/sync`, {
        method: "POST",
        headers: { "x-cron-secret": cronSecret },
      });
      const data = await res.json() as { success: boolean; message?: string };
      results.push({ id: file.id, name: file.name, success: data.success, message: data.message ?? "" });
    } catch (e) {
      results.push({ id: file.id, name: file.name, success: false, message: String(e) });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return NextResponse.json({
    success: true,
    processed: targets.length,
    succeeded: successCount,
    failed: targets.length - successCount,
    results,
  });
}

// Vercel Cron は GET も使えるため GET も用意
export async function GET(request: NextRequest) {
  return POST(request);
}
