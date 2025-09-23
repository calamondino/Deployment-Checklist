// src/app/api/runs/by-team/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Common selects
const runSelect = {
  id: true,
  status: true,
  templateId: true,
  template: { select: { id: true, name: true } },
  items: { select: { id: true, checkedAt: true } },
} as const;

const userSelect = {
  id: true,
  name: true, // non-nullable in schema
  team: { select: { id: true, name: true } }, // non-nullable relation
} as const;

type UserLite = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") ?? "").trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? "40") || 40));

  if (!name) {
    return NextResponse.json({ runs: [] }, { status: 200 });
  }

  // 1) Exact match first
  type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;
  let user: UserRow | null =
  (await prisma.user.findFirst({ where: { name }, select: userSelect })) ?? null;


  // 2) Fallback: case-insensitive match in JS
  if (!user) {
    const candidates: UserLite[] = await prisma.user.findMany({ select: userSelect });
    const hit = candidates.find((u) => u.name.toLowerCase() === name.toLowerCase());
    user = hit ?? null;
  }

  if (!user?.team?.id) {
    return NextResponse.json({ runs: [] }, { status: 200 });
  }

  const runs = await prisma.run.findMany({
    where: { teamId: user.team.id },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: runSelect,
  });

  return NextResponse.json({ runs }, { status: 200 });
}
