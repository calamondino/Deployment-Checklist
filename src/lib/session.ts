// src/lib/session.ts
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions, type IronSession } from "iron-session";

// 1) Session-shape
export type SessionUser = { userId: string; teamId: string };
export type SessionData = { user?: SessionUser };

// 2) Global type awareness for iron-session
declare module "iron-session" {
  interface IronSessionData {
    user?: SessionUser;
  }
}

// 3) Iron-session options
const sessionOptions: SessionOptions = {
  cookieName: "dc_session",
  // Bruk *samme* navn i .env:
  // SESSION_PASSWORD=<<minst 32 tegn>>
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = cookies();
  const session = await getIronSession<SessionData>(await cookieStore, sessionOptions);
  return session;
}


// 5) Krev innlogget session
export async function requireSession(): Promise<IronSession<SessionData>> {
  const session = await getSession();
  if (!session.user) {
    throw new Error("Not authenticated");
  }
  return session;
}
