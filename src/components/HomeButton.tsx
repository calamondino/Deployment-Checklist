"use client";

import Link from "next/link";
import { useActorName } from "@/components/WhoAmI";

export default function HomeButton() {
  const { name } = useActorName();

  return (
    <div className="flex items-center gap-3">
      {name ? (
        <span className="text-xs opacity-70">{name} redigerer</span>
      ) : null}
      <Link
        href="/"
        className="px-2 py-1 rounded border border-white/25 hover:bg-white/10 text-sm"
        title="Gå til forsiden for å bytte bruker"
      >
        Forside
      </Link>
    </div>
  );
}
