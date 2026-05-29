import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/db";
import { verifyPassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "ユーザー名とパスワードを入力してください" },
        { status: 400 }
      );
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "ユーザー名またはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(password, String(user.password_hash ?? ''));
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, message: "ユーザー名またはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    const token = generateToken(String(user.id ?? ''), String(user.username ?? ''));

    return NextResponse.json(
      { success: true, message: "ログインに成功しました", token, user: { id: user.id, username: user.username } },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}
