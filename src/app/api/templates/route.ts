import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET() {
  const session = await requireSession();
  const templates = await prisma.template.findMany({
    where: { teamId: session.user!.teamId },
    orderBy: { createdAt: "desc" },
    include: { tasks: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ templates });
}


type Body = { name?: string; tasks?: string }; // tasks = "Build image, Tag, Deploy"

export async function POST(req: NextRequest) {
  const { name, tasks } = await req.json();
  if (!name || !Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: "Missing name/tasks" }, { status: 400 });
  }

  const template = await prisma.template.create({
    data: {
      name: String(name).trim(),
      tasks: {
        create: tasks.map((title: string, i: number) => ({
          title: String(title).trim(),
          order: i + 1,
        })),
      },
    },
    include: { tasks: true },
  });

  return NextResponse.json({ template }, { status: 201 });
}