// src/app/templates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/templates/[id]
 * (valgfri – nyttig om du vil hente én template)
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const template = await prisma.template.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      tasks: { select: { id: true, title: true, order: true } },
    },
  });

  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template }, { status: 200 });
}

/**
 * DELETE /api/templates/[id]
 * Sletter template hvis det ikke finnes runs som bruker den.
 * Sletter tasks først for å unngå FK-restriksjon.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const runCount = await prisma.run.count({ where: { templateId: id } });
    if (runCount > 0) {
      return NextResponse.json(
        { error: "Kan ikke slette: det finnes runs for denne malen." },
        { status: 409 }
      );
    }

    // Slett tasks først (FK til Template)
    await prisma.task.deleteMany({ where: { templateId: id } });

    // Slett selve template
    await prisma.template.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /templates/[id] failed:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
