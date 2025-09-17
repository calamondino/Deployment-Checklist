"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Item = { taskId: string; title?: string; checkedBy?: string; checkedAt?: string; note?: string };
type Run = {
  id: string; templateId: string; startedBy: string;
  status: "in_progress"|"done"; startedAt: string; finishedAt?: string; items: Item[];
};

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/runs?id=${id}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setRun(data.run);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function toggle(taskId: string, checked: boolean) {
    if (!run) return;
    const res = await fetch("/api/runs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id, taskId, checkedBy: "Phong", done: checked }),
    });
    const data = await res.json();
    if (res.ok) setRun(data.run);
    else alert(data?.error ?? "Kunne ikke oppdatere");
  }

  if (loading) return <div className="p-8 text-zinc-300">Laster run…</div>;
  if (!run) return <div className="p-8 text-red-300">Run ikke funnet</div>;

  return (
    <main className="min-h-dvh bg-black text-white p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Run #{run.id.slice(0,6)}</h1>
        <div className={`px-2 py-1 rounded text-sm border ${
          run.status === "done" ? "border-green-500 text-green-300" : "border-yellow-500 text-yellow-300"
        }`}>
          {run.status}
        </div>
      </div>

      <ul className="space-y-2 max-w-2xl">
        {run.items.map((it) => {
          const checked = Boolean(it.checkedAt);
          return (
            <li key={it.taskId} className="flex items-center gap-3 border border-zinc-800 rounded p-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => toggle(it.taskId, e.target.checked)}
                className="h-4 w-4"
              />
              <div className="flex-1">
                <div className="font-medium">{it.title ?? it.taskId}</div>
                <div className="text-xs text-zinc-400">
                  {checked ? `✔ ${it.checkedBy} @ ${new Date(it.checkedAt!).toLocaleString()}` : "—"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <button onClick={() => router.push("/templates")}
                className="underline text-zinc-300 hover:text-white">← Tilbake til Templates</button>
      </div>
    </main>
  );
}
