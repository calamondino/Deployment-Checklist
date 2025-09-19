import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function POST(req: Request) {
  const session = await requireSession();

  const form = await req.formData();
  const templateId = String(form.get("templateId") ?? "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "templateId required" }, { status: 400 });
  }

  // Sjekk at templaten er i ditt team
  const template = await prisma.template.findFirst({
    where: { id: templateId, teamId: session.user!.teamId },
    include: { tasks: { orderBy: { order: "asc" } } },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Opprett run + items
  const run = await prisma.run.create({
    data: {
      teamId: session.user!.teamId,
      templateId: template.id,
      startedById: session.user!.userId,
      status: "in_progress",
      items: {
        create: template.tasks.map((t) => ({
          taskId: t.id,
          title: t.title,
        })),
      },
    },
  });

  // Redirect til visningssiden
  return NextResponse.redirect(new URL(`/runs/${run.id}`, req.url));
}
