import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { verifyToken } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const config = getConfig();
    const sessionCookie = request.cookies.get("admin_session");

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false, status: null });
    }

    const payload = verifyToken(sessionCookie.value, config.jwt_secret);
    if (!payload) {
      return NextResponse.json({ authenticated: false, status: null });
    }

    return NextResponse.json({
      authenticated: payload.status === "authenticated",
      status: payload.status,
      email: payload.email,
    });
  } catch {
    return NextResponse.json({ authenticated: false, status: null });
  }
}
