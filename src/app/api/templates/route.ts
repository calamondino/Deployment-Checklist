// src/app/api/templates/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ----------------------- helpers & types ----------------------- */

type NewTemplateBody = {
  name: string;
  teamName: string;
  tasks?: string[];
  tasksText?: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** SQLite-klienten mangler `mode: 'insensitive'`, så vi gjør det i JS */
function ciEqual(a?: string | null, b?: string | null): boolean {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

function normalizeTasks(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  const text = asString(input);
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isNewTemplateBody(x: unknown): x is NewTemplateBody {
  if (!isRecord(x)) return false;
  const name = asString(x.name).trim();
  const teamName = asString(x.teamName).trim();
  return !!name && !!teamName;
}

function getActorName(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const m = cookie.match(/(?:^|;\s*)actorName=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/* ---------------------------- GET ----------------------------- */
/**
 * Returnerer templates med oppgavetitler + (ev.) aktivt run og siste fullførte,
 * men KUN for teamet til brukeren i cookie `actorName`.
 */
export async function GET(req: Request) {
  const actorName = getActorName(req);
  if (!actorName) {
    return NextResponse.json({ error: "Missing actorName" }, { status: 403 });
  }

  // Finn bruker (case-insensitivt i JS) og teamId
  type UserRow = { id: string; name: string | null; teamId: string; team: { name: string } };
  const users: UserRow[] = await prisma.user.findMany({
    select: { id: true, name: true, teamId: true, team: { select: { name: true } } },
  });
  const user = users.find((u) => ciEqual(u.name, actorName)) ?? null;

  if (!user) {
    return NextResponse.json({ error: "User or team not found" }, { status: 403 });
  }

  // Hent templates kun for dette teamet
  const raw = await prisma.template.findMany({
    where: { teamId: user.teamId },
    select: {
      id: true,
      name: true,
      tasks: { select: { title: true } },
      runs: {
        orderBy: { id: "desc" }, // nyeste først
        take: 5,
        select: {
          id: true,
          status: true,
          finishedAt: true,
          startedBy: { select: { name: true } },
          items: { select: { checkedAt: true } }, // progresjon
        },
      },
    },
  });

  // Beregn activeRun + lastDone (med tydelige typer for å unngå implicit any)
  const templates = raw.map((t): {
    id: string;
    name: string;
    tasks: { title: string }[];
    activeRun: { id: string; done: number; total: number } | null;
    lastDone: { by: string; at: string | null } | null;
  } => {
    const latestActive = t.runs.find((r) => r.status !== "done") ?? null;
    const latestDone = t.runs.find((r) => r.status === "done") ?? null;

    let activeRun: { id: string; done: number; total: number } | null = null;
    if (latestActive) {
      const total = latestActive.items.length;
      const done = latestActive.items.filter((i) => i.checkedAt).length;
      activeRun = { id: latestActive.id, done, total };
    }

    const lastDone =
      latestDone != null
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

  return NextResponse.json({ team: user.team.name, templates }, { status: 200 });
}

/* ---------------------------- POST ---------------------------- */
/**
 * Opprett ny sjekkliste (template)
 * Body: { name, teamName, tasks: string[] } ELLER { name, teamName, tasksText: string }
 */
export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as unknown;
  if (!isNewTemplateBody(raw)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const name = raw.name.trim();
  const teamName = raw.teamName.trim();

  // Finn team case-insensitivt i JS (SQLite)
  type TeamRow = { id: string; name: string | null };
  const teams: TeamRow[] = await prisma.team.findMany({ select: { id: true, name: true } });
  const team = teams.find((t) => ciEqual(t.name, teamName)) ?? null;

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 400 });
  }

  // Normaliser oppgaver og sett påkrevd order:Int
  const titles = normalizeTasks(raw.tasks ?? raw.tasksText);
  const created = await prisma.template.create({
    data: {
      name,
      teamId: team.id,
      tasks: {
        create: titles.map((title, i) => ({ title, order: i })),
      },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ template: created }, { status: 201 });
}

/* --------------------------- DELETE --------------------------- */
/**
 * DELETE: ?id=<templateId>[&force=1]
 * - uten force: 409 hvis det finnes runs
 * - med force: kaskade: runItems -> runs -> tasks -> template (i én transaksjon)
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

  // Ingen runs → enkel slett
  await prisma.task.deleteMany({ where: { templateId: id } });
  await prisma.template.delete({ where: { id } });

  return NextResponse.json({ ok: true }, { status: 200 });
}
