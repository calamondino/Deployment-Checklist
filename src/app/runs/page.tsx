"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActorName } from "@/components/WhoAmI";
import Link from "next/link";


type RunLite = {
  id: string;
  status: "in_progress" | "done";
  template: { name: string } | null;
  items: { checkedAt: string | null }[];
};

async function json<T>(r: Response): Promise<T | null> {
  const t = await r.text(); if (!t) return null; try { return JSON.parse(t); } catch { return null; }
}

export default function RunsIndex() {
  const { name } = useActorName();
  const [runs, setRuns] = useState<RunLite[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!name?.trim()) return;
    (async () => {
      setLoading(true);
      const r = await fetch(`/api/runs/by-team?name=${encodeURIComponent(name)}&status=in_progress&limit=20`, { cache: "no-store" });
      const d = await json<{ runs: RunLite[] }>(r);
      if (r.ok && d?.runs) setRuns(d.runs);
      setLoading(false);
    })();
  }, [name]);

  if (!name) return <main className="p-8 text-white">Skriv inn navn på forsiden først.</main>;
  if (loading) return <main className="p-8 text-zinc-300">Laster…</main>;

  return (
    <main className="min-h-dvh bg-black text-white p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Aktive runs</h1>
      {runs.length === 0 ? (
        <div className="text-white/70">Ingen aktive runs i teamet ditt.</div>
      ) : (
        <div className="space-y-2">
          {runs.map(r => {
            const done = r.items.filter(i => i.checkedAt).length;
            return (
              <div key={r.id} className="border border-white/10 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.template?.name ?? `Run #${r.id.slice(0,6)}`}</div>
                  <div className="text-xs opacity-60">{done}/{r.items.length} fullført</div>
                </div>
                <button
                  className="px-3 py-1 rounded border border-white/30 hover:bg-white/10"
                  onClick={() => router.push(`/runs/${r.id}`)}
                >
                  Fortsett
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Link href="/templates" className="...">← Tilbake til Templates</Link>
    </main>
  );
}
