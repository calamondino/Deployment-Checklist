// src/app/api/templates/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const templates = await prisma.template.findMany({
    select: {
      id: true,
      name: true,
      tasks: { select: { title: true } },
    },
  });

  return NextResponse.json({ templates }, { status: 200 });
}
