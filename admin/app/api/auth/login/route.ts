import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { signToken } from "@/lib/jwt";
import { findUserByEmail } from "@/lib/users";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const config = getConfig();

    let isValidUser = false;
    let requires2fa = config["2fa"];

    // Check if master owner
    if (
      email.toLowerCase() === config.email.toLowerCase() &&
      password === config.password
    ) {
      isValidUser = true;
    } else {
      // Check additional users
      const user = findUserByEmail(email);
      if (user && user.password === password) {
        isValidUser = true;
      }
    }

    if (!isValidUser) {
      return NextResponse.json(
        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const token = signToken(
      {
        email,
        status: requires2fa ? "pending_2fa" : "authenticated",
      },
      config.jwt_secret
    );

    const response = NextResponse.json({
      success: true,
      requires2fa,
    });

    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 86400, // 24 hours
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ في السيرفر" },
      { status: 500 }
    );
  }
}
