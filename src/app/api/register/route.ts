// src/app/api/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function slug(s: string) {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const { name, teamName } = (await req.json()) as {
      name?: string;
      teamName?: string;
    };

    const personName = (name ?? "").trim();
    const teamLabel = (teamName ?? "").trim();

    if (!personName) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }
    if (!teamLabel) {
      return NextResponse.json({ error: "Missing teamName" }, { status: 400 });
    }

    // 1) Finn team (case-insensitivt uten Prisma 'mode')
    let team =
      (await prisma.team.findFirst({
        where: { name: teamLabel },
        select: { id: true, name: true },
      })) ?? null;

    if (!team) {
      const allTeams = await prisma.team.findMany({
        select: { id: true, name: true },
      });
      team =
        allTeams.find((t) => (t.name ?? "").toLowerCase() === teamLabel.toLowerCase()) ?? null;
    }

    if (!team) {
      return NextResponse.json(
        { error: "UnknownTeam", message: `Team '${teamLabel}' finnes ikke.` },
        { status: 400 }
      );
    }

    // 2) Finn bruker (case-insensitivt uten 'mode')
    let user =
      (await prisma.user.findFirst({
        where: { name: personName },
        select: { id: true, name: true, email: true, teamId: true },
      })) ?? null;

    if (!user) {
      const candidates = await prisma.user.findMany({
        select: { id: true, name: true, email: true, teamId: true },
      });
      user =
        candidates.find(
          (u) => (u.name ?? "").toLowerCase() === personName.toLowerCase()
        ) ?? null;
    }

    // 3) Opprett eller oppdater
    if (!user) {
      const email = `${slug(personName)}-${Date.now()}@localhost`;
      const created = await prisma.user.create({
        data: {
          name: personName,
          email,
          teamId: team.id,
        },
        include: { team: true },
      });
      return NextResponse.json({ user: created, created: true }, { status: 201 });
    }

    // Bruker finnes – knytt til valgt team hvis forskjellig
    if (user.teamId !== team.id) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { teamId: team.id },
        include: { team: true },
      });
      return NextResponse.json(
        { user: updated, created: false, updatedTeam: true },
        { status: 200 }
      );
    }

    // Allerede på riktig team
    const withTeam = await prisma.user.findUnique({
      where: { id: user.id },
      include: { team: true },
    });
    return NextResponse.json(
      { user: withTeam, created: false, updatedTeam: false },
      { status: 200 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
