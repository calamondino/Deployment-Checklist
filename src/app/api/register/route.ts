// src/app/api/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* utils */
const ciEqual = (a?: string | null, b?: string | null) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/* common selects (freeze shapes so we can type from them) */
const teamSelect = {
  id: true,
  name: true,
} as const;

const userSelect = {
  id: true,
  name: true,        // in schema: non-null
  teamId: true,
  team: { select: teamSelect },
} as const;

/* row types matching the selects above */
type TeamRow = { id: string; name: string };
type UserRow = {
  id: string;
  name: string;      // non-null here to match schema
  teamId: string;
  team: TeamRow;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { name?: string; teamName?: string }
    | null;

  const personName = (body?.name ?? "").trim();
  const teamLabel = (body?.teamName ?? "").trim() || "Default";
  if (!personName) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  /* 1) Ensure team exists (exact, fallback CI, else create) */
  let team: TeamRow | null =
    (await prisma.team.findFirst({
      where: { name: teamLabel },
      select: teamSelect,
    })) ?? null;

  if (!team) {
    const allTeams: TeamRow[] = await prisma.team.findMany({ select: teamSelect });
    team = allTeams.find((t) => ciEqual(t.name, teamLabel)) ?? null;
  }

  if (!team) {
    team = await prisma.team.create({
      data: { name: teamLabel },
      select: teamSelect,
    });
  }

  /* 2) Find existing user (exact name first, same shape as we return) */
  let user: UserRow | null =
    (await prisma.user.findFirst({
      where: { name: personName },
      select: userSelect,
    })) ?? null;

  /* 3) Case-insensitive fallback (no 'mode' needed) */
  if (!user) {
    const candidates: UserRow[] = await prisma.user.findMany({
      // you can scope to team if you prefer:
      // where: { teamId: team.id },
      select: userSelect,
    });
    user = candidates.find((u) => ciEqual(u.name, personName)) ?? null;
  }

  /* 4) Create or update team link */
  if (!user) {
    const placeholderEmail = `${personName}.${Date.now()}@localhost`;
    user = await prisma.user.create({
      data: { name: personName, email: placeholderEmail, teamId: team.id },
      select: userSelect,
    });
  } else if (user.teamId !== team.id) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { teamId: team.id },
      select: userSelect,
    });
  }

  return NextResponse.json({ user }, { status: 201 });
}
