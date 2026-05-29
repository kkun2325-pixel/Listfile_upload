import { NextRequest, NextResponse } from "next/server";
import { createTeamMember } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token || !verifyToken(token)) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ success: false, message: "名前が必要です" }, { status: 400 });
    await createTeamMember(uuidv4(), params.id, name.trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
