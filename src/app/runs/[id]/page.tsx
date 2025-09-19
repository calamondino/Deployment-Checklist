"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useActorName } from "@/components/WhoAmI";
import HomeButton from "@/components/HomeButton";


type Item = {
  id: string;
  taskId: string | null;
  title: string;
  checkedAt: string | null;
  checkedById: string | null;
};

type Run = {
  id: string;
  template: { name: string } | null;
  status: "in_progress" | "done" | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  items: Item[];
};

async function safeJson<T = any>(res: Response): Promise<T | null> {
  const txt = await res.text();
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const { name: actorName } = useActorName();

  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/runs?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await safeJson<{ run?: Run; error?: string }>(res);
    if (res.ok && data?.run) setRun(data.run);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Poll hvert 5s mens run er aktivt
  useEffect(() => {
    if (!run || run.status === "done") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status]);

  async function toggle(taskId: string, checked: boolean) {
    if (!run) return;
    setSaving(true);
    const res = await fetch("/api/runs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: run.id,
        taskId,
        checkedBy: actorName || "Ukjent",
        done: checked,
      }),
    });
    const data = await safeJson<{ run?: Run; error?: string }>(res);
    setSaving(false);
    if (res.ok && data?.run) setRun(data.run);
    else alert(data?.error ?? "Kunne ikke oppdatere");
  }

  async function finishRun() {
    if (!run) return;
    setSaving(true);
    const res = await fetch("/api/runs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id, action: "finish" }),
    });
    const data = await safeJson<{ run?: Run; error?: string }>(res);
    setSaving(false);
    if (res.ok && data?.run) setRun(data.run);
    else alert(data?.error ?? "Kunne ikke avslutte run");
  }

  if (loading) return <main className="p-8 text-zinc-300">Laster run…</main>;
  if (!run)    return <main className="p-8 text-red-400">Run ikke funnet</main>;

  return (
    <main className="min-h-dvh bg-black text-white p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold">Run #{run.id.slice(0, 6)}</h1>
    <div className="text-sm text-white/60">{run.template?.name ?? "—"}</div>
  </div>

  <div className="flex items-center gap-3">
    <HomeButton />
    <div
      className={`px-2 py-1 rounded text-sm border ${
        run.status === "done"
          ? "border-green-500 text-green-300"
          : "border-yellow-500 text-yellow-300"
      }`}
      title={run.status ?? "in_progress"}
    >
      {run.status ?? "in_progress"}
    </div>
    {run.status !== "done" && (
      <button
        onClick={finishRun}
        className="px-2 py-1 rounded border border-red-400 text-red-300 hover:bg-red-500/10 text-sm disabled:opacity-60"
        disabled={saving}
        title="Sett run til ferdig nå"
      >
        Avslutt run
      </button>
    )}
  </div>
</div>


      <a href="/templates" className="text-sm underline opacity-80">
        ← Tilbake til Templates
      </a>

      <ul className="space-y-2">
        {run.items.map((it) => {
          const checked = Boolean(it.checkedAt);
          return (
            <li key={it.id} className="flex items-start gap-3 border border-zinc-800 rounded-lg p-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={checked}
                onChange={(e) => toggle((it.taskId ?? it.id), e.target.checked)}
                disabled={saving || run.status === "done"}
              />
              <div className="flex-1">
                <div className="font-medium">{it.title}</div>
                <div className="text-xs opacity-60">
                  {checked
                    ? `Av: ${it.checkedById ?? "Ukjent"} · ${new Date(it.checkedAt!).toLocaleString()}`
                    : "Ikke avkrysset"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
