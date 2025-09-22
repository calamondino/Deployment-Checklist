// src/app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  // Hva vi trenger ut
  const baseSelect = {
    id: true,
    name: true,
    team: { select: { id: true, name: true } },
  } as const;

  type UserLite = {
    id: string;
    name: string; // <- ikke-null
    team: { id: string; name: string };
  };

  // 1) Prøv eksakt treff først (billigst)
  let user: UserLite | null =
    (await prisma.user.findFirst({
      where: { name },
      select: baseSelect,
    })) as UserLite | null;

  // 2) Fallback for case-insensitiv matching
  if (!user) {
    const candidates = (await prisma.user.findMany({
      select: baseSelect,
    })) as UserLite[];

    user =
      candidates.find((u) => u.name.toLowerCase() === name.toLowerCase()) ??
      null;
  }

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user }, { status: 200 });
}
