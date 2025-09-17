type Template = { id: string; name: string; tasks: { id: string; title: string; order: number }[] };
type Run = { id: string; templateId: string; startedBy: string; status: "in_progress"|"done";
  startedAt: string; finishedAt?: string; items: { taskId: string; checkedBy?: string; checkedAt?: string; note?: string }[] };

export const DB = {
  templates: new Map<string, Template>(),
  runs: new Map<string, Run>(),
};

export const uid = () => Math.random().toString(36).slice(2,10);
