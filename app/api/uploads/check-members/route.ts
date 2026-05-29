import { NextRequest, NextResponse } from "next/server";
import { getTeamMembersByNames } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token || !verifyToken(token)) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
  try {
    const { names } = await req.json() as { names: string[] };
    if (!Array.isArray(names) || names.length === 0) return NextResponse.json({ success: true, registered: [], unregistered: [] });

    const found = await getTeamMembersByNames(names);
    const registeredNames = new Set(found.map((r: Record<string, unknown>) => String(r.name)));
    const unregistered = names.filter(n => !registeredNames.has(n));
    const registered = names.filter(n => registeredNames.has(n));

    return NextResponse.json({ success: true, registered, unregistered });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
