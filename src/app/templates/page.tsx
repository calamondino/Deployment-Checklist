// src/app/templates/page.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TaskLite = { title: string };
type ActiveRun = { id: string; done: number; total: number } | null;
type Template = { id: string; name: string; tasks?: TaskLite[]; activeRun: ActiveRun };


// legg øverst
function getActorName(): string {
  // prøv localStorage først
  try {
    const v = localStorage.getItem("actorName");
    if (v && v.trim()) return v.trim();
  } catch {/* noop */}

  // fallback: cookie
  const m = document.cookie.match(/(?:^|;\s*)actorName=([^;]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]).trim();
  return "";
}

async function startRunForTemplate(templateId: string) {
  const name = getActorName();
  if (!name) {
    alert("Skriv inn og lagre navnet ditt på forsiden først.");
    location.assign("/"); // send brukeren til forsiden for å lagre
    return;
  }

  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, name }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    alert(`Kunne ikke starte run: ${t || res.statusText}`);
    return;
  }
  const data = await res.json().catch(() => null);
  const runId = data?.run?.id ?? data?.id;
  if (!runId) {
    alert("Uventet svar fra server – mangler run-id.");
    return;
  }
  location.assign(`/runs/${encodeURIComponent(runId)}`);
}




export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/templates", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!alive) return;
      setTemplates((data?.templates ?? []) as Template[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onDeleteTemplate(t: Template) {
    const ok = confirm(`Slette malen «${t.name}»?`);
    if (!ok) return;

    let res = await fetch(`/api/templates?id=${encodeURIComponent(t.id)}`, {
      method: "DELETE",
    });

    if (res.status === 409) {
      const forceOk = confirm(
        `Det finnes runs for denne malen.\n\nSlette ALT (runs + items + oppgaver + mal) likevel?\nDette kan ikke angres.`
      );
      if (!forceOk) return;

      res = await fetch(
        `/api/templates?id=${encodeURIComponent(t.id)}&force=1`,
        { method: "DELETE" }
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      alert(`Kunne ikke slette: ${body || res.statusText}`);
      return;
    }

    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    startTransition(() => router.refresh());
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-black text-white p-6">
        <h1 className="text-3xl font-bold mb-4">Templates</h1>
        <p>Laster…</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-black text-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Templates</h1>
        <button
          onClick={() => location.assign("/")}
          className="rounded border border-white/30 hover:bg-white/10 px-3 py-1"
        >
          Forside
        </button>
      </div>

      <div className="space-y-4 max-w-2xl">
        {templates.map((t) => {
          const subt =
            t.tasks?.map((x) => x.title).join(", ") || "Ingen oppgaver definert";
          const hasActive = !!t.activeRun;
          const progress =
            hasActive && t.activeRun
              ? `${t.activeRun.done}/${t.activeRun.total} fullført`
              : null;

          return (
            <section
              key={t.id}
              className="border border-white/10 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{t.name}</h2>
                  {hasActive && progress && (
                    <span className="text-xs rounded-full bg-emerald-700/20 border border-emerald-500/40 px-2 py-0.5">
                      Aktiv: {progress}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/60">{subt}</p>
              </div>

              <div className="flex items-center gap-2">
                {!hasActive && (
  <button
    onClick={() => startRunForTemplate(t.id)}
    className="rounded bg-white text-black px-3 py-1"
  >
    Start run
  </button>
)}

                {hasActive && t.activeRun && (
                  <button
                    onClick={() =>
                      location.assign(`/runs/${encodeURIComponent(t.activeRun!.id)}`)
                    }
                    className="rounded border border-emerald-600 text-emerald-400 px-3 py-1"
                  >
                    Fortsett
                  </button>
                )}

                <button
                  onClick={() => onDeleteTemplate(t)}
                  disabled={isPending}
                  className="rounded border border-red-600 text-red-400 px-3 py-1"
                  title="Slett malen"
                >
                  Slett
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
