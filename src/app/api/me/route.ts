// src/app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  // Smalt select for god ytelse og klar type
  const baseSelect = {
    id: true,
    name: true,
    team: { select: { id: true, name: true } },
  } as const;

  type UserLite = {
    id: string;
    name: string; // <- ikke-null
    team: { id: string; name: string } | null;
  };

  // 1) Eksakt oppslag
  let user = await prisma.user.findFirst({
    where: { name },
    select: baseSelect,
  });

  // 2) Fallback: manuell case-insensitiv match
  if (!user) {
    const candidates: UserLite[] = await prisma.user.findMany({ select: baseSelect });
    user =
      candidates.find(
        (u) => (u.name ?? "").toLowerCase() === name.toLowerCase()
      ) ?? null;
  }

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ user }, { status: 200 });
}
