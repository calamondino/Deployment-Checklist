"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [me, setMe] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/me").then(r=>r.json()).then(setMe);
  }, []);

  async function submit() {
    const r = await fetch("/api/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, team })
    });
    if (r.ok) router.push("/templates");
    else alert("Kunne ikke registrere");
  }

  if (me?.user) {
    return (
      <main className="p-8 text-white">
        <p>Allerede innlogget som <b>{me.user.name}</b> i <b>{me.team.name}</b>.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Registrer deg</h1>
      <div className="flex flex-col gap-2 max-w-sm">
        <input className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
               placeholder="Navn" value={name} onChange={e=>setName(e.target.value)} />
        <input className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
               placeholder="Team" value={team} onChange={e=>setTeam(e.target.value)} />
        <button onClick={submit}
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded px-3 py-2">
          Registrer
        </button>
      </div>
    </main>
  );
}
