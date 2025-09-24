// src/app/templates/page.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/* ---------------- Types ---------------- */
type TaskLite = { title: string };
type ActiveRun = { id: string; done: number; total: number } | null;
type LastDone = { by: string; at: string | null } | null;
type Template = {
  id: string;
  name: string;
  tasks?: TaskLite[];
  activeRun: ActiveRun;
  lastDone: LastDone;
};

/* ---------------- Utils ---------------- */
function getActorName(): string {
  try {
    const v = localStorage.getItem("actorName");
    if (v && v.trim()) return v.trim();
  } catch { /* noop */ }

  const m = document.cookie.match(/(?:^|;\s*)actorName=([^;]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]).trim();
  return "";
}

async function startRunForTemplate(templateId: string) {
  const name = getActorName();
  if (!name) {
    alert("Skriv inn og lagre navnet ditt på forsiden først.");
    location.assign("/");
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

/* ---------------- New Template Modal ---------------- */
function NewTemplateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: Template) => void;
}) {
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseTasks(): string[] {
    return tasksText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const n = name.trim();
    const team = teamName.trim();
    const tasks = parseTasks();

    if (!n) return setError("Skriv et navn for sjekklisten.");
    if (!team) return setError("Oppgi team-navn (må finnes fra før).");

    setSaving(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, teamName: team, tasks }),
    });
    setSaving(false);

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      setError(t || res.statusText);
      return;
    }

    const data = await res.json().catch(() => null);
    const created = data?.template;
    if (!created) {
      setError("Uventet svar fra server.");
      return;
    }

    // Normaliser til Template-shape vi bruker i UI
    const newTemplate: Template = {
      id: created.id,
      name: created.name,
      tasks: created.tasks ?? [],
      activeRun: null,
      lastDone: null,
    };

    onCreated(newTemplate);
    onClose();
  }

  // Esc for å lukke
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg border border-white/10 bg-zinc-900 p-4 shadow-xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Ny sjekkliste</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/20 px-2 py-1 text-sm hover:bg-white/10"
          >
            Lukk
          </button>
        </div>

        <label className="block text-sm mb-1">Navn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full rounded border border-white/20 bg-transparent px-3 py-2"
          placeholder="F.eks. Release to staging"
        />

        <label className="block text-sm mb-1">Team</label>
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className="mb-3 w-full rounded border border-white/20 bg-transparent px-3 py-2"
          placeholder="F.eks. Bouvet"
        />

        <label className="block text-sm mb-1">Oppgaver (én per linje)</label>
        <textarea
          value={tasksText}
          onChange={(e) => setTasksText(e.target.value)}
          rows={6}
          className="mb-3 w-full rounded border border-white/20 bg-transparent px-3 py-2 font-mono text-sm"
          placeholder={"Tag\nBygg\nDeploy\nSmoke test"}
        />

        {error && (
          <div className="mb-3 rounded border border-red-500/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/20 px-3 py-2 hover:bg-white/10"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-white text-black px-3 py-2 disabled:opacity-60"
          >
            {saving ? "Lagrer…" : "Opprett sjekkliste"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [showNewModal, setShowNewModal] = useState(false);

  // Hent templates
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

  function handleCreated(t: Template) {
    setTemplates((prev) => [t, ...prev]);
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="rounded bg-white text-black px-3 py-1"
          >
            Ny sjekkliste
          </button>
          <button
            onClick={() => location.assign("/")}
            className="rounded border border-white/30 hover:bg-white/10 px-3 py-1"
          >
            Forside
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="max-w-2xl rounded-lg border border-white/10 p-6">
          <p className="mb-3 text-white/70">Ingen sjekklister ennå.</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="rounded bg-white text-black px-3 py-2"
          >
            Opprett din første sjekkliste
          </button>
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {templates.map((t) => {
            const subt =
              t.tasks?.map((x) => x.title).join(", ") || "Ingen oppgaver definert";
            const hasActive = !!t.activeRun;
            const progress =
              hasActive && t.activeRun
                ? `${t.activeRun.done}/${t.activeRun.total} fullført`
                : null;

            const lastDoneText =
              !hasActive && t.lastDone
                ? `Sist fullført: ${t.lastDone.by}${t.lastDone.at ? ` (${new Date(t.lastDone.at).toLocaleString()})` : ""}`
                : null;

            return (
              <section
                key={t.id}
                className="border border-white/10 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold break-words">{t.name}</h2>
                    {hasActive && progress && (
                      <span className="text-xs rounded-full bg-emerald-700/20 border border-emerald-500/40 px-2 py-0.5">
                        Aktiv: {progress}
                      </span>
                    )}
                    {!hasActive && lastDoneText && (
                      <span className="text-xs rounded-full bg-white/10 border border-white/20 px-2 py-0.5">
                        {lastDoneText}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/60 break-words">{subt}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
      )}

      {showNewModal && (
        <NewTemplateModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </main>
  );
}
