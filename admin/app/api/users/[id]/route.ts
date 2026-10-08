import { NextRequest, NextResponse } from "next/server";
import { deleteUser } from "@/lib/users";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteUser(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ في السيرفر" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { email, password } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مطلوب" },
        { status: 400 }
      );
    }

    const { getUsers, saveUsers, findUserByEmail } = await import("@/lib/users");
    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    // Check if new email is already taken by another user
    if (
      email.toLowerCase() !== users[userIndex].email.toLowerCase() &&
      findUserByEmail(email)
    ) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مسجل بالفعل" },
        { status: 409 }
      );
    }

    // Update user
    users[userIndex].email = email;
    if (password) {
      users[userIndex].password = password;
    }

    saveUsers(users);

    return NextResponse.json({
      success: true,
      user: {
        id: users[userIndex].id,
        email: users[userIndex].email,
        created_at: users[userIndex].created_at,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ في السيرفر" },
      { status: 500 }
    );
  }
}
