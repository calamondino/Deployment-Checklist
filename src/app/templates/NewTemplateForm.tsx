"use client";
import { useState } from "react";

export default function NewTemplateForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [tasks, setTasks] = useState("Build image, Tag, Deploy, Smoke test");
  const [saving, setSaving] = useState(false);

  async function create() {
    const titles = tasks.split(",").map(s => s.trim()).filter(Boolean);
    if (!name.trim() || titles.length === 0) {
      alert("Fyll inn navn og minst én task");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), tasks: titles }),
    });
    setSaving(false);
    if (res.ok) {
      setName("");
      setTasks("");
      onCreated?.();
    } else {
      const txt = await res.text();
      alert(txt || "Kunne ikke opprette template");
    }
  }

  return (
    <div className="border border-white/10 rounded-lg p-4 space-y-3">
      <div className="font-semibold">Ny template</div>
      <input
        className="w-full rounded bg-black/40 border border-white/15 px-3 py-2"
        placeholder="Navn (f.eks. Release til staging)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full rounded bg-black/40 border border-white/15 px-3 py-2"
        placeholder="Tasks, kommaseparert"
        value={tasks}
        onChange={(e) => setTasks(e.target.value)}
      />
      <button
        className="px-3 py-1 rounded border border-white/30 hover:bg-white/10"
        onClick={create}
        disabled={saving}
      >
        {saving ? "Oppretter…" : "Opprett"}
      </button>
    </div>
  );
}
