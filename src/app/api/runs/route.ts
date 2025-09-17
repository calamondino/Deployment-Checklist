import { NextResponse } from "next/server";
import { DB, uid, Run } from "../_store";

// Start en "run" fra template
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.templateId || !body?.startedBy) {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const t = DB.templates.get(String(body.templateId));
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const run: Run = {
    id: uid(),
    templateId: t.id,
    startedBy: String(body.startedBy),
    status: "in_progress",
    startedAt: new Date().toISOString(),
    items: t.tasks.map((task) => ({ taskId: task.id, title: task.title })), // <-- title
  };

  DB.runs.set(run.id, run);
  return NextResponse.json({ run });

}

// Huk av / fjern avhuking av en task i en run
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const { runId, taskId, checkedBy, note, done } = body || {};

  const run = DB.runs.get(String(runId));
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const item = run.items.find((i) => i.taskId === String(taskId));
  if (!item) return NextResponse.json({ error: "Task not in run" }, { status: 404 });

  if (done) {
    item.checkedBy = String(checkedBy || "unknown");
    item.checkedAt = new Date().toISOString();
    if (note) item.note = String(note);

    // Ferdig når alle tasks er huket
    if (run.items.every((i) => i.checkedAt)) {
      run.status = "done";
      run.finishedAt = new Date().toISOString();
    }
  } else {
    delete item.checkedBy;
    delete item.checkedAt;
  }

  return NextResponse.json({ run });
}
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const run = DB.runs.get(id);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    return NextResponse.json({ run });
  }
  return NextResponse.json({ runs: Array.from(DB.runs.values()) });
}
