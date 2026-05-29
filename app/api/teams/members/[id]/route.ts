import { NextRequest, NextResponse } from "next/server";
import { deleteTeamMember, deleteTeam } from "@/lib/db";
import { verifyToken, extractToken } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token || !verifyToken(token)) return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("type") === "team") {
      await deleteTeam(params.id);
    } else {
      await deleteTeamMember(params.id);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
