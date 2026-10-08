import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createUser } from "@/lib/users";
import { verifyTOTP } from "@/lib/totp";

export async function POST(request: NextRequest) {
  try {
    const { email, password, secret, code } = await request.json();

    if (!email || !password || !secret || !code) {
      return NextResponse.json(
        { error: "جميع الحقول مطلوبة" },
        { status: 400 }
      );
    }

    // Check if user already exists
    if (findUserByEmail(email)) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مسجل بالفعل" },
        { status: 409 }
      );
    }

    // Verify the 2FA code to confirm authenticator is set up
    const isValid = verifyTOTP(code, secret);
    if (!isValid) {
      return NextResponse.json(
        { error: "كود التحقق غير صحيح. تأكد من إضافة المفتاح في تطبيق المصادقة" },
        { status: 401 }
      );
    }

    // Create the user
    const user = createUser(email, password, secret);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ في السيرفر" },
      { status: 500 }
    );
  }
}
