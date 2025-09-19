// src/app/api/runs/by-team/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ runs: [] }, { status: 200 });

  // Finn bruker (eksakt navn først, så case-insensitiv fallback)
  const baseSelect = {
    id: true,
    name: true,
    team: { select: { id: true, name: true } },
  } as const;

  let user =
    (await prisma.user.findFirst({ where: { name }, select: baseSelect })) ??
    null;

  if (!user) {
    const candidates = await prisma.user.findMany({ select: baseSelect });
    user =
      candidates.find(
        (u) => (u.name ?? "").toLowerCase() === name.toLowerCase()
      ) ?? null;
  }

  if (!user?.team?.id) {
    // Ingen team => ingen runs
    return NextResponse.json({ runs: [] }, { status: 200 });
  }

  // Hent siste runs for teamet – sortér på startedAt (ikke createdAt)
  const runs = await prisma.run.findMany({
    where: { teamId: user.team.id },
    orderBy: { startedAt: "desc" }, // <-- fiksen
    take: 40,
    select: {
      id: true,
      status: true,
      templateId: true,
      template: { select: { id: true, name: true } },
      items: { select: { checkedAt: true } },
    },
  });

  return NextResponse.json({ runs }, { status: 200 });
}
