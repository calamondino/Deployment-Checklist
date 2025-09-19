"use client";

import { useActorName } from "@/components/WhoAmI";

export function EditorBadge() {
  const { name } = useActorName();
  const label = (name || "").trim();
  if (!label) return null;

  return (
    <div className="fixed bottom-4 right-4 pointer-events-none select-none text-[11px] text-black/80">
      <span className="rounded-full bg-white/90 px-3 py-1 shadow">
        {label.toLowerCase()} <span className="opacity-70">redigerer</span>
      </span>
    </div>
  );
}

export default EditorBadge;
