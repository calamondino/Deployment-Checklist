// src/app/runs/new/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewRunPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const create = async () => {
      const templateId = sp.get("templateId");
      const startedBy = localStorage.getItem("actorName") || "Anonymous";
      if (!templateId) {
        router.replace("/templates");
        return;
      }
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, startedBy }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.run?.id) {
        router.replace(`/runs/${data.run.id}`);
      } else {
        router.replace("/templates");
      }
    };
    create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="p-8 text-zinc-300">Oppretter run…</div>;
}
