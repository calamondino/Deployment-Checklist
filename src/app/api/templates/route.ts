import { NextResponse } from "next/server";
import { DB, uid, Template } from "../_store";

// List alle templates
export async function GET() {
  return NextResponse.json({ templates: Array.from(DB.templates.values()) });
}

// Opprett ny template
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !Array.isArray(body?.tasks)) {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const t: Template = {
    id: uid(),
    name: String(body.name),
    tasks: (body.tasks as string[]).map((title, i) => ({
      id: uid(),
      title: String(title),
      order: i,
    })),
  };

  DB.templates.set(t.id, t);
  return NextResponse.json({ template: t });
}
