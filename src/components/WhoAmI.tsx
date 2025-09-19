"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type ActorCtx = {
  name: string | null;
  setName: (next: string) => void;
};

const Ctx = createContext<ActorCtx | null>(null);

function readCookie(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)actorName=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function writeCookie(value: string) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `actorName=${encodeURIComponent(value)}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

export function ActorProvider({ children }: { children: React.ReactNode }) {
  const [name, setNameState] = useState<string | null>(null);

  // Init fra cookie/localStorage
  useEffect(() => {
    const fromCookie = readCookie();
    const fromLS = typeof window !== "undefined" ? localStorage.getItem("actorName") : null;
    setNameState(fromCookie || fromLS || null);
  }, []);

  // Lagring + “broadcast” til andre faner
  const setName = (next: string) => {
    const clean = (next || "").trim();
    setNameState(clean || null);
    writeCookie(clean);
    try {
      localStorage.setItem("actorName", clean);
      // Trigger oppdatering i andre faner
      window.dispatchEvent(new StorageEvent("storage", { key: "actorName", newValue: clean }));
    } catch {}
  };

  // Lytt på endringer fra andre faner
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "actorName") {
        setNameState((e.newValue || "").trim() || null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<ActorCtx>(() => ({ name, setName }), [name]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActorName() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActorName must be used inside <ActorProvider>");
  return ctx;
}
