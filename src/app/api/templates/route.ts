// src/app/api/templates/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET: returnerer templates med oppgavetitler + (ev.) aktivt run
 * activeRun er siste run (nyeste) hvor done < total; ellers null
 */
export async function GET() {
  const raw = await prisma.template.findMany({
    select: {
      id: true,
      name: true,
      tasks: { select: { title: true } },
      runs: {
        // 🔧 sorter på id desc i stedet for createdAt
        orderBy: { id: "desc" },
        take: 1,
        select: {
          id: true,
          items: { select: { checkedAt: true } }, // progress via checkedAt
        },
      },
    },
  });

  const templates = raw.map((t) => {
    const r = t.runs[0];
    if (!r) return { id: t.id, name: t.name, tasks: t.tasks, activeRun: null as null };
    const total = r.items.length;
    const done = r.items.filter((i) => i.checkedAt).length;
    const isActive = total > 0 && done < total;
    return {
      id: t.id,
      name: t.name,
      tasks: t.tasks,
      activeRun: isActive ? { id: r.id, done, total } : null,
    };
  });

  return NextResponse.json({ templates }, { status: 200 });
}

/**
 * DELETE: ?id=<templateId>[&force=1]
 * - uten force: 409 hvis det finnes runs
 * - med force: cascadeslett runItems -> runs -> tasks -> template (transaksjon)
 */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const force = searchParams.get("force") === "1";

  if (!id) return NextResponse.json({ error: "Missing template id" }, { status: 400 });

  const runCount = await prisma.run.count({ where: { templateId: id } });

  if (runCount > 0 && !force) {
    return NextResponse.json(
      { error: "Kan ikke slette: det finnes runs for denne malen." },
      { status: 409 }
    );
  }

  if (runCount > 0 && force) {
    await prisma.$transaction(async (tx) => {
      await tx.runItem.deleteMany({ where: { run: { templateId: id } } });
      await tx.run.deleteMany({ where: { templateId: id } });
      await tx.task.deleteMany({ where: { templateId: id } });
      await tx.template.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true, cascaded: true }, { status: 200 });
  }

  await prisma.task.deleteMany({ where: { templateId: id } });
  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
