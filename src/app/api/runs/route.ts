// src/app/api/runs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ---------- Små utils ---------- */
const ciEqual = (a?: string | null, b?: string | null) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null;

/* ---------- Felles select ---------- */
const runSelect = {
  id: true,
  status: true,
  templateId: true,
  template: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      taskId: true,
      title: true,
      checkedAt: true,
      checkedById: true,
    },
  },
} as const;

/* ---------- PATCH-body typer & guards ---------- */
type FinishBody = { runId: string; action: "finish" };
type ToggleBody = { runId: string; taskId: string; done: boolean; checkedBy?: string };

function isFinishBody(x: unknown): x is FinishBody {
  return (
    isObject(x) &&
    x.action === "finish" &&
    typeof x.runId === "string"
  );
}

function isToggleBody(x: unknown): x is ToggleBody {
  return (
    isObject(x) &&
    typeof x.runId === "string" &&
    typeof x.taskId === "string" &&
    typeof x.done === "boolean"
  );
}

/* ================================================
   GET
   - /api/runs?id=RUN_ID
   - /api/runs?byTeam=TEAM_NAME&limit=40
   ================================================ */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  const byTeam = url.searchParams.get("byTeam")?.trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? "40") || 40));

  // 1) Enkelt run
  if (id) {
    const run = await prisma.run.findUnique({
      where: { id },
      select: runSelect,
    });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ run }, { status: 200 });
  }

  // 2) Siste runs for team (case-insensitivt navn)
  if (byTeam) {
    type TeamRow = { id: string; name: string };
    const teams: TeamRow[] = await prisma.team.findMany({ select: { id: true, name: true } });
    const team = teams.find((t) => ciEqual(t.name, byTeam)) ?? null;
    if (!team) return NextResponse.json({ runs: [] }, { status: 200 });

    const runs = await prisma.run.findMany({
      where: { teamId: team.id },
      orderBy: { startedAt: "desc" },
      take: limit,
      select: runSelect,
    });
    return NextResponse.json({ runs }, { status: 200 });
  }

  // Uten filter: tomt svar
  return NextResponse.json({ runs: [] }, { status: 200 });
}

/* ================================================
   POST – start nytt run
   Body: { templateId: string; startedBy: string }
   ================================================ */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as unknown;
  if (!isObject(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const templateId = String(body.templateId ?? "").trim();
  const startedBy = String(body.startedBy ?? "").trim();
  if (!templateId || !startedBy) {
    return NextResponse.json({ error: "Missing templateId or startedBy" }, { status: 400 });
  }

  // 1) Hent template + tasks
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      teamId: true,
      tasks: { select: { id: true, title: true, order: true } },
    },
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // 2) Finn bruker (i riktig team), case-insensitivt (uten 'mode' og uten 'any')
  type CandidateRow = { id: string; name: string | null };
  const candidates: CandidateRow[] = await prisma.user.findMany({
    where: { teamId: template.teamId },
    select: { id: true, name: true },
  });
  const user = candidates.find((u) => ciEqual(u.name, startedBy)) ?? null;
  if (!user) return NextResponse.json({ error: "User not found in team" }, { status: 400 });

  // 3) Opprett run
  const created = await prisma.run.create({
    data: {
      teamId: template.teamId,
      templateId: template.id,
      startedById: user.id,
      status: "in_progress",
    },
    select: { id: true },
  });

  // 4) Lag run items fra template-taskene (sortert)
type TaskRow   = { id: string; title: string; order: number | null };
type TaskInput = { id: string; title: string; order: number | null | undefined };

const src: TaskInput[] = (template.tasks ?? []) as TaskInput[];

const tasks: TaskRow[] = src.map((t: TaskInput) => ({
  id: t.id,
  title: t.title,
  order: t.order ?? null,
}));

const itemsData = tasks
  .slice()
  .sort((a: TaskRow, b: TaskRow) => (a.order ?? 0) - (b.order ?? 0))
  .map((t: TaskRow) => ({
    runId: created.id,
    taskId: t.id,
    title: t.title,
  }));

  if (itemsData.length > 0) {
    await prisma.runItem.createMany({ data: itemsData });
  }

  // 5) Returnér komplett run
  const fullRun = await prisma.run.findUnique({
    where: { id: created.id },
    select: runSelect,
  });

  return NextResponse.json({ run: fullRun }, { status: 201 });
}

/* ================================================
   PATCH – finish helt run eller toggle enkelt item
   ================================================ */
export async function PATCH(req: NextRequest) {
  const raw = await req.json().catch(() => null) as unknown;

  // Avslutt hele run
  if (isFinishBody(raw)) {
    const runId = raw.runId.trim();
    if (!runId) return NextResponse.json({ error: "Missing runId" }, { status: 400 });

    await prisma.run.update({
      where: { id: runId },
      data: { status: "done", finishedAt: new Date() },
    });

    const run = await prisma.run.findUnique({ where: { id: runId }, select: runSelect });
    return NextResponse.json({ run }, { status: 200 });
  }

  // Toggle enkelt item
  if (isToggleBody(raw)) {
    const runId = raw.runId.trim();
    const taskId = raw.taskId.trim();
    const done = raw.done;
    const checkedBy = (raw.checkedBy ?? "").trim();

    if (!runId || !taskId) {
      return NextResponse.json({ error: "Missing runId or taskId" }, { status: 400 });
    }

    const item = await prisma.runItem.findFirst({
      where: { runId, taskId },
      select: { id: true },
    });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    await prisma.runItem.update({
      where: { id: item.id },
      data: done
        ? { checkedAt: new Date(), checkedById: checkedBy || "Ukjent" }
        : { checkedAt: null, checkedById: null },
    });

    const run = await prisma.run.findUnique({ where: { id: runId }, select: runSelect });
    return NextResponse.json({ run }, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}
