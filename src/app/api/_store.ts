// src/app/api/_store.ts
export type Template = {
  id: string;
  name: string;
  tasks: { id: string; title: string; order: number }[];
};

export type Run = {
  id: string;
  templateId: string;
  startedBy: string;
  status: "in_progress" | "done";
  startedAt: string;
  finishedAt?: string;
  items: { taskId: string; title?: string; checkedBy?: string; checkedAt?: string; note?: string }[]; // <-- title?
};

type Store = { templates: Map<string, Template>; runs: Map<string, Run> };
declare global { var __DEPLOY_CHECKLISTS_STORE__: Store | undefined; }
const createStore = (): Store => ({ templates: new Map(), runs: new Map() });
export const DB: Store = (globalThis.__DEPLOY_CHECKLISTS_STORE__ ??= createStore());
export const uid = () => Math.random().toString(36).slice(2, 10);
