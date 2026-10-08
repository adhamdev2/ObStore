import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = "http://localhost:3004/api/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { hardwareId } = await request.json();
    
    const adminSecret = process.env.ADMIN_SECRET || "sk_admin_2f8a9c3e7d1b4f6a";

    const res = await fetch(`${API_URL}/users/${id}/hardware/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ hardwareId }),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Hardware update proxy error:", error);
    return NextResponse.json(
      { error: "Failed to update hardware" },
      { status: 500 }
    );
  }
}