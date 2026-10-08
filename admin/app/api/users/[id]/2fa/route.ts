import { NextRequest, NextResponse } from "next/server";
import { getUsers, saveUsers } from "@/lib/users";
import { verifyTOTP } from "@/lib/totp";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { secret, code } = await request.json();

    if (!secret || !code) {
      return NextResponse.json(
        { error: "الرمز السري وكود التحقق مطلوبان" },
        { status: 400 }
      );
    }

    if (!verifyTOTP(code, secret)) {
      return NextResponse.json(
        { error: "كود التحقق غير صحيح" },
        { status: 400 }
      );
    }

    if (id === "owner-id-static") {
      const { getConfig, saveConfig } = await import("@/lib/config");
      const config = getConfig();
      config["2fa_secret"] = secret;
      saveConfig(config);
      return NextResponse.json({ success: true });
    }

    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    users[userIndex].twofa_secret = secret;
    saveUsers(users);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ في السيرفر" },
      { status: 500 }
    );
  }
}
