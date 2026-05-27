import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createUser, getUserByUsername } from "@/lib/db";
import { hashPassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password, confirmPassword } = await request.json();

    if (!username || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "すべてのフィールドを入力してください" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "パスワードが一致しません" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "パスワードは6文字以上である必要があります" },
        { status: 400 }
      );
    }

    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "このユーザー名は既に使用されています" },
        { status: 400 }
      );
    }

    const userId = uuidv4();
    const passwordHash = await hashPassword(password);
    await createUser(userId, username, passwordHash);

    const token = generateToken(userId, username);

    return NextResponse.json(
      { success: true, message: "登録に成功しました", token, user: { id: userId, username } },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}
