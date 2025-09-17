import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-dvh bg-black text-white flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Deploy Checklists</h1>
        <Link href="/templates" className="underline text-zinc-300 hover:text-white">
          Gå til Templates →
        </Link>
      </div>
    </main>
  );
}
