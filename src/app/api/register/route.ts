// src/app/api/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Body = { name?: string; teamName?: string };

type TeamLite = { id: string; name: string };
type UserLite = {
  id: string;
  name: string | null;
  teamId: string;
  team: { id: string; name: string } | null;
};

export async function POST(req: NextRequest) {
  const { name, teamName }: Body = await req.json();

  const personName = (name ?? "").trim();
  const teamLabel = (teamName ?? "").trim() || "Default";

  if (!personName) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  // Finn/lag team (eksakt først, så case-insensitiv fallback)
  let team = await prisma.team.findFirst({
    where: { name: teamLabel },
    select: { id: true, name: true },
  });

  if (!team) {
    const allTeams: TeamLite[] = await prisma.team.findMany({
      select: { id: true, name: true },
    });
    team =
      allTeams.find(
        (t: TeamLite) => (t.name ?? "").toLowerCase() === teamLabel.toLowerCase()
      ) ?? null;
  }

  if (!team) {
    team = await prisma.team.create({
      data: { name: teamLabel },
      select: { id: true, name: true },
    });
  }

  // Finn eksisterende bruker: eksakt navn først
  let user = await prisma.user.findFirst({
    where: { name: personName },
    select: {
      id: true,
      name: true,
      teamId: true,
      team: { select: { id: true, name: true } },
    },
  });

  // Case-insensitiv fallback uten 'any'
  if (!user) {
    const candidates: UserLite[] = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        teamId: true,
        team: { select: { id: true, name: true } },
      },
    });
    user =
      candidates.find(
        (u: UserLite) => (u.name ?? "").toLowerCase() === personName.toLowerCase()
      ) ?? null;
  }

  // Opprett ny eller oppdater team-tilknytning
  if (!user) {
    const placeholderEmail = `${personName}.${Date.now()}@localhost`;
    user = await prisma.user.create({
      data: { name: personName, email: placeholderEmail, teamId: team.id },
      select: {
        id: true,
        name: true,
        teamId: true,
        team: { select: { id: true, name: true } },
      },
    });
  } else if (user.teamId !== team.id) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { teamId: team.id },
      select: {
        id: true,
        name: true,
        teamId: true,
        team: { select: { id: true, name: true } },
      },
    });
  }

  return NextResponse.json({ user, created: true }, { status: 201 });
}
