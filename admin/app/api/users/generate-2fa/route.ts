import { NextResponse } from "next/server";
import { generateSecret } from "@/lib/users";

export async function POST() {
  try {
    const secret = generateSecret();
    return NextResponse.json({ secret });
  } catch {
    return NextResponse.json({ error: "خطأ في السيرفر" }, { status: 500 });
  }
}
