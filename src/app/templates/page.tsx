// src/app/templates/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActorName } from "@/components/WhoAmI";

type TaskLite = { title: string };
type Template = { id: string; name: string; tasks?: TaskLite[] };

type RunLite = {
  id: string;
  status: "in_progress" | "done" | string;
  templateId: string | null;
  template?: { id: string; name: string } | null;
  items: { checkedAt: string | null }[];
};

async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function TemplatesPage() {
  const router = useRouter();
  const { name: actorName } = useActorName();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [runs, setRuns] = useState<RunLite[]>([]);
  const [loading, setLoading] = useState(true);

  // Load templates once
  useEffect(() => {
    (async () => {
      setLoading(true);

      let res = await fetch("/api/templates", { cache: "no-store" });
      let data = await safeJson<{ templates: Template[] }>(res);

      if (!res.ok || !data?.templates) {
        res = await fetch("/api/templates-all", { cache: "no-store" });
        data = await safeJson<{ templates: Template[] }>(res);
      }

      if (res.ok && data?.templates) setTemplates(data.templates);
      setLoading(false);
    })();
  }, []);

  // Poll runs for the actor's team
  useEffect(() => {
    if (!actorName) return;
    let cancelled = false;

    const load = async () => {
      const res = await fetch(
        `/api/runs/by-team?name=${encodeURIComponent(actorName)}`,
        { cache: "no-store" }
      );
      const data = await safeJson<{ runs: RunLite[] }>(res);
      if (!cancelled && res.ok && data?.runs) setRuns(data.runs);
    };

    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [actorName]);

  // Build map: templateId -> active run (with progress)
  const activeMap = useMemo(() => {
    const m = new Map<string, { runId: string; done: number; total: number }>();
    for (const r of runs) {
      const tid = r.template?.id ?? r.templateId ?? "";
      if (!tid) continue;
      if (r.status === "in_progress") {
        const total = r.items.length;
        const done = r.items.filter((i) => i.checkedAt).length;
        m.set(tid, { runId: r.id, done, total });
      }
    }
    return m;
  }, [runs]);

  async function startRun(templateId: string) {
    const startedBy = (actorName || "").trim() || "Anonymous";

    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, startedBy }),
    });
    const data = await safeJson<{ run?: { id: string } }>(res);

    if (res.ok && data?.run?.id) {
      router.push(`/runs/${data.run.id}`);
    } else {
      alert("Klarte ikke å starte run. Sjekk serverlogg.");
    }
  }

  if (loading) return <div className="p-8 text-zinc-300">Laster…</div>;

  return (
    <main className="min-h-dvh bg-black text-white p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <button
          className="px-3 py-1 rounded border border-white/30 hover:bg-white/10"
          onClick={() => router.push("/")}
        >
          Forside
        </button>
      </div>

      {templates.length === 0 && (
        <div className="text-sm text-white/60">
          Ingen templates enda. Lag ett via seed eller egen admin-side.
        </div>
      )}

      {templates.map((t) => {
        const info = activeMap.get(t.id);
        const tasksLine = t.tasks?.length
          ? t.tasks.map((x) => x.title).join(", ")
          : "—";

        return (
          <div
            key={t.id}
            className="border border-white/10 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="pr-4">
              <div className="font-semibold flex items-center gap-2">
                {t.name}
                {info && (
                  <span className="inline-flex items-center rounded-full bg-emerald-600/20 text-emerald-300 text-xs px-2 py-0.5">
                    Aktiv: {info.done}/{info.total} fullført
                  </span>
                )}
              </div>
              <div className="text-sm text-white/60">{tasksLine}</div>
            </div>

            {info ? (
              <button
                className="px-3 py-1 rounded border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => router.push(`/runs/${info.runId}`)}
              >
                Fortsett
              </button>
            ) : (
              <button
                className="px-3 py-1 rounded border border-white/30 hover:bg-white/10"
                onClick={() => startRun(t.id)}
              >
                Start run
              </button>
            )}
          </div>
        );
      })}
    </main>
  );
}
