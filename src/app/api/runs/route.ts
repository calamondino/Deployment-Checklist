import { NextResponse } from "next/server";
import { DB, uid } from "../_store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.templateId || !body?.startedBy) {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  const t = DB.templates.get(String(body.templateId));
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const run = {
    id: uid(),
    templateId: t.id,
    startedBy: String(body.startedBy),
    status: "in_progress" as const,
    startedAt: new Date().toISOString(),
    items: t.tasks.map((task) => ({ taskId: task.id })),
  };
  DB.runs.set(run.id, run);
  return NextResponse.json({ run });
}

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

