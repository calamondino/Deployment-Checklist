"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Template = { id: string; name: string; tasks: { id: string; title: string; order: number }[] };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [tasks, setTasks] = useState("Build image, Tag, Deploy, Smoke test");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function load() {
    const res = await fetch("/api/templates", { cache: "no-store" });
    const data = await res.json();
    setTemplates(data.templates || []);
  }
  useEffect(() => { load(); }, []);

  async function createTemplate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        tasks: tasks.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch("/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Kunne ikke opprette template");
      setName("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function startRun(tid: string) {
    const res = await fetch("/api/runs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: tid, startedBy: "Phong" }),
    });
    const data = await res.json();
    if (res.ok && data.run?.id) {
      router.push(`/runs/${data.run.id}`);
    } else {
      alert(data?.error ?? "Klarte ikke starte run");
    }
  }

  return (
    <main className="min-h-dvh bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Templates</h1>

      <div className="mb-8 border border-zinc-800 rounded-lg p-4">
        <h2 className="font-semibold mb-2">Ny template</h2>
        <div className="flex flex-col gap-2 max-w-xl">
          <input className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
                 placeholder="Navn (f.eks. Release to staging)" value={name}
                 onChange={(e) => setName(e.target.value)} />
          <input className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
                 placeholder="Tasks (kommaseparert)" value={tasks}
                 onChange={(e) => setTasks(e.target.value)} />
          <button onClick={createTemplate} disabled={loading}
                  className="self-start bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded px-3 py-1.5">
            {loading ? "Lagrer…" : "Opprett"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {templates.map((t) => (
          <div key={t.id} className="border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm text-zinc-400">{t.tasks.length} steg</div>
              </div>
              <button onClick={() => startRun(t.id)}
                      className="bg-green-700/70 hover:bg-green-600 border border-green-500 rounded px-3 py-1.5">
                Start run
              </button>
            </div>
            <ul className="mt-3 text-sm text-zinc-300 list-disc pl-6">
              {t.tasks.sort((a,b)=>a.order-b.order).map(task => <li key={task.id}>{task.title}</li>)}
            </ul>
          </div>
        ))}

        {templates.length === 0 && (
          <p className="text-zinc-400">Ingen templates ennå — lag en over 👆</p>
        )}
      </div>
    </main>
  );
}
