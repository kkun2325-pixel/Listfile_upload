import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { verifyToken, extractToken, hashPassword } from "@/lib/auth";

async function ensureLastLoginColumn() {
  const sql = getDb();
  try {
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TEXT`);
  } catch { /* already exists */ }
}

// GET: 全ユーザー一覧（最終ログイン日・最新アップロード日つき）
export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token || !verifyToken(token))
    return NextResponse.json({ success: false, message: "認証が必要です" }, { status: 401 });

  await ensureLastLoginColumn();

  try {
    const sql = getDb();
    const users = await sql.query(`
      SELECT
        u.id,
        u.username,
        u.role,
        u.created_at,
        u.last_login_at,
        (SELECT MAX(uploaded_at) FROM csv_uploads WHERE user_id = u.id) AS latest_upload_at
      FROM users u
      ORDER BY u.created_at ASC
    `);
    return NextResponse.json({ success: true, users });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}

// POST: 新規ユーザー登録（管理者のみ）
export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  const decoded = token ? verifyToken(token) : null;
  if (!decoded || decoded.role !== "manager")
    return NextResponse.json({ success: false, message: "管理者権限が必要です" }, { status: 403 });

  await ensureLastLoginColumn();

  try {
    const { username, password, role = "common" } = await request.json() as {
      username: string; password: string; role?: "manager" | "common";
    };
    if (!username?.trim() || !password)
      return NextResponse.json({ success: false, message: "ユーザー名とパスワードを入力してください" }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ success: false, message: "パスワードは6文字以上にしてください" }, { status: 400 });

    const sql = getDb();
    const existing = await sql`SELECT id FROM users WHERE username = ${username.trim()} LIMIT 1`;
    if (existing.length > 0)
      return NextResponse.json({ success: false, message: "このユーザー名は既に使用されています" }, { status: 400 });

    const now = new Date().toISOString();
    const id = uuidv4();
    const hash = await hashPassword(password);
    await sql`
      INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (${id}, ${username.trim()}, ${hash}, ${role}, ${now}, ${now})
    `;
    return NextResponse.json({ success: true, user: { id, username: username.trim(), role } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}

// DELETE: ユーザー削除（管理者のみ・自分自身は不可）
export async function DELETE(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  const decoded = token ? verifyToken(token) : null;
  if (!decoded || decoded.role !== "manager")
    return NextResponse.json({ success: false, message: "管理者権限が必要です" }, { status: 403 });

  try {
    const { id } = await request.json() as { id: string };
    if (!id) return NextResponse.json({ success: false, message: "id が必要です" }, { status: 400 });
    if (id === decoded.userId)
      return NextResponse.json({ success: false, message: "自分自身は削除できません" }, { status: 400 });

    const sql = getDb();
    await sql`DELETE FROM users WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
