import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export type UserRole = "manager" | "common";

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export function generateToken(userId: string, username: string, role: UserRole = "common"): string {
  return jwt.sign({ userId, username, role }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string; username: string; role: UserRole } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role?: UserRole };
    return { userId: decoded.userId, username: decoded.username, role: decoded.role ?? "common" };
  } catch {
    return null;
  }
}

export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return null;
}
