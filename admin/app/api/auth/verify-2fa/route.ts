import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { verifyToken, signToken } from "@/lib/jwt";
import { verifyTOTP } from "@/lib/totp";
import { findUserByEmail } from "@/lib/users";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    const config = getConfig();

    const sessionCookie = request.cookies.get("admin_session");
    if (!sessionCookie) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const payload = verifyToken(sessionCookie.value, config.jwt_secret);
    if (!payload || payload.status !== "pending_2fa" || !payload.email) {
      return NextResponse.json(
        { error: "جلسة غير صالحة" },
        { status: 401 }
      );
    }

    let secretToUse = "";
    
    // Check if master owner
    if (payload.email.toLowerCase() === config.email.toLowerCase()) {
      secretToUse = config["2fa_secret"];
    } else {
      // Additional user
      const user = findUserByEmail(payload.email);
      if (!user) {
        return NextResponse.json(
          { error: "المستخدم غير موجود" },
          { status: 401 }
        );
      }
      secretToUse = user.twofa_secret;
    }

    if (!secretToUse) {
      return NextResponse.json(
        { error: "حدث خطأ في استخراج مفتاح الأمان" },
        { status: 500 }
      );
    }

    const isValid = verifyTOTP(code, secretToUse);
    if (!isValid) {
      return NextResponse.json(
        { error: "كود التحقق غير صحيح" },
        { status: 401 }
      );
    }

    const newToken = signToken(
      {
        email: payload.email,
        status: "authenticated",
      },
      config.jwt_secret
    );

    const response = NextResponse.json({ success: true });

    response.cookies.set("admin_session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 86400,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ في السيرفر" },
      { status: 500 }
    );
  }
}
