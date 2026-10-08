import { NextRequest, NextResponse } from "next/server";

const APP_API = process.env.APP_API_URL ?? "http://localhost:3004";
const SECRET  = process.env.ADMIN_SECRET ?? "sk_admin_2f8a9c3e7d1b4f6a";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/* POST /api/app/users/[id]/suspend — Suspend or unsuspend a user */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = request.headers.get("x-admin-secret");
  if (key !== SECRET) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  try {
    const res = await fetch(`${APP_API}/api/admin/users/${id}/suspend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": SECRET,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to reach app API" }, { status: 502 });
  }
}
