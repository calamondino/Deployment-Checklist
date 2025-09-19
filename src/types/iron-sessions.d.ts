import "iron-session";

declare module "iron-session" {
  interface IronSessionData {
    user?: { userId: string; teamId: string };
  }
}
