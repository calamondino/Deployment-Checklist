"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");

  async function handleRegister() {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, team }),
    });
    const data = await res.json();
    console.log("Registered:", data);
    window.location.href = "/templates"; // redirect etterpå
  }

  return (
    <div>
      <h1>Register</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
      />
      <input
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        placeholder="Team"
      />
      <button onClick={handleRegister}>Register</button>
    </div>
  );
}
