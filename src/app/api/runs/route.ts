// src/app/api/runs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ciEqual = (a?: string | null, b?: string | null) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null;

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

// (hjelp hvis email er required i schema)
function tempEmail(name: string, teamId: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  const uniq = Date.now().toString(36).slice(-4);
  return `${slug || "user"}.${teamId}.${uniq}@local`;
}

/* GET /api/runs?id=... | /api/runs?byTeam=... */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  const byTeam = url.searchParams.get("byTeam")?.trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? "40") || 40));

  if (id) {
    const run = await prisma.run.findUnique({ where: { id }, select: runSelect });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ run }, { status: 200 });
  }

  if (byTeam) {
    const teams = await prisma.team.findMany({ select: { id: true, name: true } });
    const team = teams.find((t) => ciEqual(t.name, byTeam)) ?? null;
    if (!team) return NextResponse.json({ runs: [] }, { status: 200 });

    const runs = await prisma.run.findMany({
      where: { teamId: team.id },
      orderBy: { id: "desc" },
      take: limit,
      select: runSelect,
    });
    return NextResponse.json({ runs }, { status: 200 });
  }

  return NextResponse.json({ runs: [] }, { status: 200 });
}

/* POST /api/runs  Body: { templateId: string; name?: string; startedBy?: string } */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const templateId = String(body?.templateId ?? "").trim();

  // aksepter både "name" og "startedBy" + fallback til cookie "actorName"
  let startedBy = String((body?.name ?? body?.startedBy ?? "") as string).trim();
  if (!startedBy) {
    const cookie = req.headers.get("cookie") ?? "";
    const m = cookie.match(/(?:^|;\s*)actorName=([^;]+)/);
    if (m?.[1]) startedBy = decodeURIComponent(m[1]).trim();
  }

  if (!templateId || !startedBy) {
    return NextResponse.json(
      { error: !templateId ? "Missing templateId" : "Missing name" },
      { status: 400 }
    );
  }

  // template + tasks
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      teamId: true,
      tasks: { select: { id: true, title: true, order: true } },
    },
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // finn/lag bruker i teamet
  const candidates = await prisma.user.findMany({
    where: { teamId: template.teamId },
    select: { id: true, name: true },
  });
  let user = candidates.find((u) => ciEqual(u.name, startedBy)) ?? null;
  if (!user) {
    user = await prisma.user.create({
      data: { name: startedBy, teamId: template.teamId, email: tempEmail(startedBy, template.teamId) },
      select: { id: true, name: true },
    });
  }

  // opprett run
  const createdRun = await prisma.run.create({
    data: { teamId: template.teamId, templateId: template.id, startedById: user.id, status: "in_progress" },
    select: { id: true },
  });

  // lag items
  const itemsData = (template.tasks ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((t) => ({ runId: createdRun.id, taskId: t.id, title: t.title }));

  if (itemsData.length) await prisma.runItem.createMany({ data: itemsData });

  const fullRun = await prisma.run.findUnique({ where: { id: createdRun.id }, select: runSelect });
  return NextResponse.json({ run: fullRun }, { status: 201 });
}

/* PATCH /api/runs   finish eller toggle */
type FinishBody = { runId: string; action: "finish" };
type ToggleBody = { runId: string; taskId: string; done: boolean; checkedBy?: string };
const isFinishBody = (x: unknown): x is FinishBody =>
  isObject(x) && x.action === "finish" && typeof x.runId === "string";
const isToggleBody = (x: unknown): x is ToggleBody =>
  isObject(x) && typeof x.runId === "string" && typeof x.taskId === "string" && typeof x.done === "boolean";

export async function PATCH(req: NextRequest) {
  const raw = (await req.json().catch(() => null)) as unknown;

  if (isFinishBody(raw)) {
    const runId = raw.runId.trim();
    if (!runId) return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    await prisma.run.update({ where: { id: runId }, data: { status: "done", finishedAt: new Date() } });
    const run = await prisma.run.findUnique({ where: { id: runId }, select: runSelect });
    return NextResponse.json({ run }, { status: 200 });
  }

  if (isToggleBody(raw)) {
    const runId = raw.runId.trim();
    const taskId = raw.taskId.trim();
    const done = raw.done;
    const checkedBy = (raw.checkedBy ?? "").trim();

    if (!runId || !taskId) return NextResponse.json({ error: "Missing runId or taskId" }, { status: 400 });

    const item = await prisma.runItem.findFirst({ where: { runId, taskId }, select: { id: true } });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    await prisma.runItem.update({
      where: { id: item.id },
      data: done ? { checkedAt: new Date(), checkedById: checkedBy || "Ukjent" } : { checkedAt: null, checkedById: null },
    });

    const run = await prisma.run.findUnique({ where: { id: runId }, select: runSelect });
    return NextResponse.json({ run }, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}
