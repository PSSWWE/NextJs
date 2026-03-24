import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const SETTING_KEY = "public_tools_disabled";
const ADMIN_EMAIL = "mohidfaisal321@gmail.com";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function assertAdminCanChangeFlag(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return false;
    const decoded = jwt.verify(token, JWT_SECRET) as { email?: string };
    const email = (decoded.email || "").trim().toLowerCase();
    return email === ADMIN_EMAIL.toLowerCase();
  } catch {
    return false;
  }
}

/** No DB row, or value "true" => public tools blocked (404). Value "false" => tools enabled. */
function rowToDisabled(value: string | null | undefined): boolean {
  if (value == null) return true;
  return value !== "false";
}

export async function GET() {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    const disabled = rowToDisabled(row?.value);
    return NextResponse.json({ disabled });
  } catch (e) {
    console.error("public-tools GET error", e);
    return NextResponse.json({ disabled: true });
  }
}

export async function POST(request: Request) {
  try {
    const allowed = await assertAdminCanChangeFlag();
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const disabled = !!body?.disabled;
    const value = disabled ? "true" : "false";

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value },
      update: { value },
    });

    return NextResponse.json({ disabled });
  } catch (e) {
    console.error("public-tools POST error", e);
    return NextResponse.json(
      { error: "Failed to persist public tools setting" },
      { status: 500 }
    );
  }
}
