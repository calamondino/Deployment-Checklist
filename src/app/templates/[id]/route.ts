import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type Params = { params: { id: string } };

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireSession();

  // Sikkerhet: slett bare fra eget team
  await prisma.template.deleteMany({
    where: { id: params.id, teamId: session.user!.teamId },
  });

  return NextResponse.json({ ok: true });
}
