import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { verifyPassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    // Find user
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, message: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    return NextResponse.json(
      {
        success: true,
        message: "ログインに成功しました",
        token,
        user: { id: user.id, email: user.email },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "ログイン処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
