// src/app/api/templates/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ciEq = (a?: string | null, b?: string | null) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/**
 * GET: kun templates for brukerens team (fra actorName-cookie)
 * Returnerer også aktivt run og sist fullførte, som før.
 */
export async function GET(req: Request) {
  // Les navn fra cookie
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)actorName=([^;]+)/);
  const actorName = m?.[1] ? decodeURIComponent(m[1]).trim() : "";

  if (!actorName) {
    // Ikke logget inn → ingen maler
    return NextResponse.json({ templates: [] }, { status: 200 });
  }

  // Finn bruker + team case-insensitivt
  const users = await prisma.user.findMany({
    select: { id: true, name: true, teamId: true },
  });
  const user = users.find((u) => ciEq(u.name, actorName)) ?? null;
  if (!user) {
    return NextResponse.json({ templates: [] }, { status: 200 });
  }

  const raw = await prisma.template.findMany({
    where: { teamId: user.teamId },
    select: {
      id: true,
      name: true,
      tasks: { select: { title: true } },
      runs: {
        orderBy: { id: "desc" }, // robust sort
        take: 5,
        select: {
          id: true,
          status: true,
          finishedAt: true,
          startedBy: { select: { name: true } },
          items: { select: { checkedAt: true } },
        },
      },
    },
  });

  const templates = raw.map((t) => {
    const latestActive = t.runs.find((r) => r.status !== "done") ?? null;
    const latestDone = t.runs.find((r) => r.status === "done") ?? null;

    const activeRun = latestActive
      ? {
          id: latestActive.id,
          done: latestActive.items.filter((i) => i.checkedAt).length,
          total: latestActive.items.length,
        }
      : null;

    const lastDone = latestDone
      ? {
          by: latestDone.startedBy?.name ?? "Ukjent",
          at: latestDone.finishedAt ? latestDone.finishedAt.toISOString() : null,
        }
      : null;

    return { id: t.id, name: t.name, tasks: t.tasks, activeRun, lastDone };
  });

  return NextResponse.json({ templates }, { status: 200 });
}

/**
 * POST: opprett ny template
 * Body: { name: string; teamName: string; tasks: string[] }
 * (validerer at team finnes; kan valgfritt også sjekke at brukeren tilhører teamet)
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as any;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const teamName = String(body.teamName ?? "").trim();
  const tasksInput: string[] = Array.isArray(body.tasks)
    ? body.tasks.map((t: unknown) => String(t ?? "").trim()).filter(Boolean)
    : [];

  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  if (!teamName) return NextResponse.json({ error: "Missing teamName" }, { status: 400 });

  // Finn team case-insensitivt
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  const team = teams.find((t) => ciEq(t.name, teamName)) ?? null;
  if (!team) return NextResponse.json({ error: `Team '${teamName}' not found` }, { status: 400 });

  // (Valgfritt ekstravern: krev at innlogget bruker er i dette teamet)
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)actorName=([^;]+)/);
  const actorName = m?.[1] ? decodeURIComponent(m[1]).trim() : "";
  if (actorName) {
    const users = await prisma.user.findMany({ select: { id: true, name: true, teamId: true } });
    const user = users.find((u) => ciEq(u.name, actorName)) ?? null;
    if (!user || user.teamId !== team.id) {
      return NextResponse.json({ error: "Not allowed for this team" }, { status: 403 });
    }
  }

  const created = await prisma.template.create({
    data: {
      name,
      teamId: team.id,
      tasks: {
        createMany: {
          data: tasksInput.map((title, idx) => ({ title, order: idx })),
        },
      },
    },
    select: { id: true, name: true, tasks: { select: { title: true } } },
  });

  return NextResponse.json({ template: created }, { status: 201 });
}

/**
 * DELETE: ?id=<templateId>[&force=1]
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
