// src/app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Hvilke felter vi trenger
const baseSelect = {
  id: true,
  name: true,
  team: { select: { id: true, name: true } },
} as const;

// Nøyaktig avledet type fra select
type UserLite = Prisma.UserGetPayload<{ select: typeof baseSelect }>;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  // 1) Eksakt treff først
  let user: UserLite | null =
    (await prisma.user.findFirst({
      where: { name },
      select: baseSelect,
    })) ?? null;

  // 2) Fallback: case-insensitive i JS (dekker miljø der 'mode' ikke virker)
  if (!user) {
    const candidates: UserLite[] = await prisma.user.findMany({ select: baseSelect });
    user =
      candidates.find((u) => u.name.toLowerCase() === name.toLowerCase()) ??
      null;
  }

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user }, { status: 200 });
}
