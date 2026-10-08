import { NextResponse } from "next/server";
import { getUsers } from "@/lib/users";

export async function GET() {
  try {
    const users = getUsers().map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
    }));
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "خطأ في السيرفر" }, { status: 500 });
  }
}
