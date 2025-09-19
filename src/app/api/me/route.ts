// src/app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get("name")?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  // Hent bare det vi trenger, og match case-insensitivt i JS
  const select = {
    id: true,
    name: true,
    team: { select: { id: true, name: true } },
  } as const;

  const candidates = await prisma.user.findMany({ select });
  const user =
    candidates.find((u) => (u.name ?? "").toLowerCase() === name.toLowerCase()) ??
    null;

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ user }, { status: 200 });
}
