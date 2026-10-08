import { NextRequest, NextResponse } from "next/server";

const APP_API = process.env.APP_API_URL ?? "http://localhost:3004";
const SECRET  = process.env.ADMIN_SECRET ?? "sk_admin_2f8a9c3e7d1b4f6a";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const key = request.headers.get("x-admin-secret");
  if (key !== SECRET) return unauthorized();

  try {
    const res = await fetch(`${APP_API}/api/admin/users`, {
      headers: { "x-admin-secret": SECRET },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to reach app API" }, { status: 502 });
  }
}
