import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createUser, getUserByEmail } from "@/lib/db";
import { hashPassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password, confirmPassword } = await request.json();

    // Validation
    if (!email || !password || !confirmPassword) {
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

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "このメールアドレスは既に登録されています" },
        { status: 400 }
      );
    }

    // Create user
    const userId = uuidv4();
    const passwordHash = await hashPassword(password);

    await createUser(userId, email, passwordHash);

    // Generate token
    const token = generateToken(userId, email);

    return NextResponse.json(
      {
        success: true,
        message: "登録に成功しました",
        token,
        user: { id: userId, email },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, message: "登録処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
