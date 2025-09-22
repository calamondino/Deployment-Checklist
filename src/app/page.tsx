"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActorName } from "@/components/WhoAmI";
import EditorBadge from "@/components/EditorBadge";

type TeamInfo = { id: string; name: string };
type MeResponse =
  | { user: { id: string; name: string; team?: TeamInfo | null } }
  | { error: string };

export default function HomePage() {
  // Les navn fra cookie via hooket
  const { name: actorNameRaw } = useActorName();
  const [name, setName] = useState<string>(actorNameRaw ?? "");

  // Tilgangsstatus
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const hasAccess = !!team;

  // Hold input synk med det som ev. endres av andre komponenter
  useEffect(() => {
    if ((actorNameRaw ?? "") !== name) {
      setName(actorNameRaw ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorNameRaw]);

  function saveName() {
    const v = name.trim();
    if (!v) {
      alert("Skriv inn et navn først.");
      return;
    }

    // 1) Cookie (1 år)
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `actorName=${encodeURIComponent(v)}; Path=/; Max-Age=${oneYear}`;

    // 2) “Broadcast” til andre komponenter i appen
    try {
      localStorage.setItem("actorName", v);
      // StorageEvent simuleres i samme fane for enkel live-oppdatering
      window.dispatchEvent(
        new StorageEvent("storage", { key: "actorName", newValue: v })
      );
    } catch {
      /* no-op */
    }
  }

  async function checkAccess() {
    setTeam(null);
    const q = encodeURIComponent(name.trim());
    if (!q) {
      alert("Skriv inn navnet ditt før du sjekker tilgang.");
      return;
    }
    const res = await fetch(`/api/me?name=${q}`, { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as MeResponse | null;

    if (res.ok && data && "user" in data) {
      setTeam(data.user.team ?? null);
    } else {
      setTeam(null);
    }
  }

  return (
    <main className="min-h-dvh bg-black text-white grid place-items-center p-6">
      <div className="w-full max-w-xl text-center space-y-6">
        <h1 className="text-3xl font-bold">Deploy Checklists</h1>

        <div className="flex items-center justify-center gap-2">
          <span className="text-white/80">Jeg heter:</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-64 rounded border border-white/20 bg-transparent px-3 py-1"
          />
          <button
            onClick={saveName}
            className="rounded border border-white/30 hover:bg-white/10 px-3 py-1"
          >
            Lagre
          </button>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={checkAccess}
            className="rounded border border-white/30 hover:bg-white/10 px-3 py-1"
          >
            Sjekk tilgang
          </button>

          <Link
            href="/templates"
            className={`rounded border px-3 py-1 ${
              hasAccess
                ? "border-white/30 hover:bg-white/10"
                : "border-white/10 text-white/30 pointer-events-none"
            }`}
          >
            Gå til Templates →
          </Link>
        </div>

        {/* Tilgangsresultat */}
        {team ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-700/20 px-3 py-1 text-sm">
            <span>Tilgang OK</span>
            <span className="opacity-60">•</span>
            <span>
              Team: <span className="font-medium">{team.name}</span>
            </span>
          </div>
        ) : (
          <div className="text-sm text-red-300/90">
            <span className="rounded-full border border-red-400/30 bg-red-900/20 px-3 py-1 inline-block">
              Ingen tilgang for{" "}
              <span className="font-medium">{name || "—"}</span>. Registrer
              brukeren med team på denne siden.
            </span>
          </div>
        )}

        {/* Registreringsskjema (enkelt) */}
        <RegisterBox currentName={name} onRegistered={checkAccess} />
      </div>

      <EditorBadge />
    </main>
  );
}

function RegisterBox({
  currentName,
  onRegistered,
}: {
  currentName: string;
  onRegistered: () => void;
}) {
  const [teamName, setTeamName] = useState("");

  async function register() {
    const name = currentName.trim();
    const team = teamName.trim();
    if (!name || !team) {
      alert("Fyll inn både navn og team.");
      return;
    }
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, teamName: team }),
    });
    const ok = res.ok;
    if (!ok) {
      const t = await res.text().catch(() => "");
      alert(`Kunne ikke registrere: ${t || res.statusText}`);
      return;
    }
    setTeamName("");
    onRegistered();
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-xl rounded-lg border border-white/10 p-4 text-left">
      <div className="font-semibold mb-2">Registrer bruker</div>
      <div className="text-sm text-white/70 mb-2">
        Velg et team (må finnes fra før).
      </div>
      <div className="flex items-center gap-2">
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Team-navn (f.eks. Bouvet)"
          className="flex-1 rounded border border-white/20 bg-transparent px-3 py-1"
        />
        <button
          onClick={register}
          className="rounded border border-white/30 hover:bg-white/10 px-3 py-1"
        >
          Registrer
        </button>
      </div>
      <p className="mt-2 text-xs text-white/50">
        Registrering oppretter ny bruker i valgt team. Finnes brukeren allerede,
        blir den ikke endret.
      </p>
    </div>
  );
}
