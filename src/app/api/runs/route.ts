// src/app/api/runs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/* ---------- helpers ---------- */
function ciEqual(a?: string | null, b?: string | null) {
  return (a ?? "").toLowerCase().trim() === (b ?? "").toLowerCase().trim();
}

/* ---------- GET /api/runs?id=... | /api/runs?by-team=...&limit=... ---------- */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const byTeam = url.searchParams.get("by-team");
  const limit = Math.max(0, Math.min(100, Number(url.searchParams.get("limit") || "25")));

  try {
    if (id) {
      const run = await prisma.run.findUnique({
        where: { id },
        include: { template: true, items: true },
      });
      if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ run }, { status: 200 });
    }

    if (byTeam) {
      // Finn team (case-insensitivt, uten Prisma mode)
      let team = await prisma.team.findFirst({ where: { name: byTeam } });
      if (!team) {
        const all = await prisma.team.findMany();
        team = all.find(t => ciEqual(t.name, byTeam)) ?? null;
      }
      if (!team) return NextResponse.json({ runs: [] }, { status: 200 });

      const runs = await prisma.run.findMany({
        where: { teamId: team.id },
        orderBy: [{ startedAt: "desc" }],
        take: limit || 25,
        include: {
          template: { select: { id: true, name: true } },
          items: { select: { id: true, checkedAt: true } },
        },
      });
      return NextResponse.json({ runs }, { status: 200 });
    }

    return NextResponse.json({ runs: [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/runs error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* ---------- POST /api/runs  { templateId, startedBy } ---------- */
export async function POST(req: NextRequest) {
  try {
    const { templateId, startedBy } = (await req.json()) as {
      templateId?: string;
      startedBy?: string;
    };

    if (!templateId) {
      return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
    }

    // 1) Hent template + tasks
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: { tasks: true },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // 2) Finn bruker (case-insensitivt)
    const personName = (startedBy ?? "").trim();
    if (!personName) {
      return NextResponse.json({ error: "UserRequired" }, { status: 400 });
    }

    let user =
      (await prisma.user.findFirst({
        where: { name: personName },
        select: { id: true, name: true, teamId: true },
      })) ?? null;

    if (!user) {
      const candidates = await prisma.user.findMany({
        select: { id: true, name: true, teamId: true },
      });
      user = candidates.find((u) => ciEqual(u.name, personName)) ?? null;
    }

    if (!user) {
      return NextResponse.json({ error: "UserNotFound" }, { status: 404 });
    }
    if (!user.teamId) {
      return NextResponse.json(
        { error: "UserMissingTeam", message: "Brukeren mangler team – registrer på forsiden." },
        { status: 400 }
      );
    }

    // 3) Opprett run
    const createdRun = await prisma.run.create({
      data: {
        templateId: template.id,
        startedById: user.id,
        teamId: user.teamId,
      },
    });

    // 4) Opprett run-items (bruk 'title' – schema krever title)
    const items = (template.tasks ?? [])
      .sort((a, b) => a.order - b.order)
      .map((t) => ({
        runId: createdRun.id,
        taskId: t.id, // ok (schema krever det)
        title: t.title,
      }));
    if (items.length) {
      await prisma.runItem.createMany({ data: items });
    }

    // 5) Returnér full run
    const fullRun = await prisma.run.findUnique({
      where: { id: createdRun.id },
      include: { template: true, items: true },
    });
    return NextResponse.json({ run: fullRun }, { status: 201 });
  } catch (err) {
    console.error("POST /api/runs error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* ---------- PATCH /api/runs { runId, taskId, checkedBy, done } | { runId, action:"finish" } ---------- */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { runId, taskId, checkedBy, done, action } = body as {
      runId?: string;
      taskId?: string;
      checkedBy?: string | null;
      done?: boolean;
      action?: "finish";
    };

    if (action === "finish") {
      if (!runId) return NextResponse.json({ error: "Missing runId" }, { status: 400 });
      await prisma.run.update({
        where: { id: runId },
        data: { status: "done", finishedAt: new Date() },
      });
      const run = await prisma.run.findUnique({
        where: { id: runId },
        include: { template: true, items: true },
      });
      return NextResponse.json({ run }, { status: 200 });
    }

    if (!runId || !taskId) {
      return NextResponse.json({ error: "Missing runId or taskId" }, { status: 400 });
    }

    const item = await prisma.runItem.findFirst({ where: { runId, taskId } });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    await prisma.runItem.update({
      where: { id: item.id },
      data: done
        ? { checkedAt: new Date(), checkedById: checkedBy ?? null }
        : { checkedAt: null, checkedById: null },
    });

    // Oppdater run-status
    const siblings = await prisma.runItem.findMany({ where: { runId } });
    const allDone = siblings.every((s) => s.checkedAt);
    await prisma.run.update({
      where: { id: runId },
      data: allDone
        ? { status: "done", finishedAt: new Date() }
        : { status: "in_progress", finishedAt: null },
    });

    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: { template: true, items: true },
    });
    return NextResponse.json({ run }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/runs error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
