import { NextRequest, NextResponse } from "next/server";
import { getTeams, createTeam, seedInitialTeams } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

function auth(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  return token && verifyToken(token);
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
  try {
    const teams = await getTeams();
    return NextResponse.json({ success: true, teams });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
  try {
    const body = await req.json();

    if (body.action === "seed") {
      const result = await seedInitialTeams();
      return NextResponse.json({ success: true, ...result });
    }

    const { name } = body;
    if (!name) return NextResponse.json({ success: false, message: "チーム名が必要です" }, { status: 400 });
    await createTeam(uuidv4(), name);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
