// src/app/templates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

// If/when you wire DB actions, import Prisma here.
// import { PrismaClient } from "@prisma/client";
// const prisma = new PrismaClient();

type IdParams = { id: string };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<IdParams> } // 👈 params is a Promise
) {
  const { id } = await ctx.params;   // 👈 await it
  // const tpl = await prisma.template.findUnique({ where: { id } });
  // if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<IdParams> } // 👈 same here
) {
  const { id } = await ctx.params;
  // await prisma.template.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
