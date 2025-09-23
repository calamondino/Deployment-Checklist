// src/app/api/templates/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET: returnerer templates med oppgavetitler + (ev.) aktivt run og siste fullførte
 * - activeRun: siste run hvor status != "done" (viser done/total)
 * - lastDone: siste run hvor status == "done" (viser hvem og når)
 */
export async function GET() {
  const raw = await prisma.template.findMany({
    select: {
      id: true,
      name: true,
      tasks: { select: { title: true } },
      // hent de 5 siste run'ene og plukk ut aktiv/sist fullførte i JS
      runs: {
        orderBy: { id: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          finishedAt: true,
          startedBy: { select: { name: true } },
          items: { select: { checkedAt: true } }, // progress
        },
      },
    },
  });

  const templates = raw.map((t) => {
    const latestActive = t.runs.find((r) => r.status !== "done") ?? null;
    const latestDone = t.runs.find((r) => r.status === "done") ?? null;

    let activeRun: { id: string; done: number; total: number } | null = null;
    if (latestActive) {
      const total = latestActive.items.length;
      const done = latestActive.items.filter((i) => i.checkedAt).length;
      activeRun = { id: latestActive.id, done, total };
    }

    const lastDone = latestDone
      ? {
          by: latestDone.startedBy?.name ?? "Ukjent",
          at: latestDone.finishedAt ? latestDone.finishedAt.toISOString() : null,
        }
      : null;

    return {
      id: t.id,
      name: t.name,
      tasks: t.tasks,
      activeRun,
      lastDone,
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
