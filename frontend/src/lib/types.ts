export const statuses = [
  "Backlog",
  "Todo",
  "Analysis",
  "Execution",
  "Waiting",
  "Validation",
  "Done",
  "Cancelled",
] as const;
export type Status = (typeof statuses)[number];
export const statusNames: Record<Status, string> = {
  Backlog: "Backlog",
  Todo: "A fazer",
  Analysis: "Em análise",
  Execution: "Em execução",
  Waiting: "Aguardando terceiros",
  Validation: "Homologação",
  Done: "Concluído",
  Cancelled: "Cancelado",
};
export const statusColors: Record<Status, string> = {
  Backlog: "#94a3b8",
  Todo: "#6387e6",
  Analysis: "#9c78db",
  Execution: "#14a6a5",
  Waiting: "#e8a849",
  Validation: "#5bb4d6",
  Done: "#56b884",
  Cancelled: "#d68383",
};
export type Priority = "Low" | "Normal" | "High" | "Critical";
export const priorities: Record<Priority, string> = {
  Low: "Baixa",
  Normal: "Normal",
  High: "Alta",
  Critical: "Crítica",
};
export interface Activity {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  category: string;
  subcategory: string;
  priority: Priority;
  severity: Priority;
  assigneeId: string | null;
  assignee: string;
  clientId: string | null;
  client: string;
  team: string;
  requesterId: string;
  status: Status;
  blocked: boolean;
  createdAt: string;
  startedAt: string | null;
  dueAt: string;
  slaAt: string;
  completedAt: string | null;
  estimatedHours: number;
  actualHours: number;
  late: boolean;
  slaViolated: boolean;
  version: string;
  timerRunning: boolean;
  approvedBy: string | null;
}
export interface Catalog {
  categories: { id: string; name: string; subcategories: string[] }[];
  clients: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
}
export interface Filters {
  search: string;
  status: string;
  categoryId: string;
  clientId: string;
  assigneeId: string;
  from: string;
  to: string;
  sort: string;
}
export const emptyFilters: Filters = {
  search: "",
  status: "",
  categoryId: "",
  clientId: "",
  assigneeId: "",
  from: "",
  to: "",
  sort: "due",
};
export interface ActivityDetail {
  comments: { id: string; userId: string; text: string; createdAt: string }[];
  attachments: {
    id: string;
    fileName: string;
    size: number;
    kind: string;
    createdAt: string;
  }[];
  timeEntries: {
    id: string;
    userId: string;
    startedAt: string;
    endedAt: string | null;
  }[];
  history: {
    id: string;
    userId: string;
    action: string;
    details: string;
    createdAt: string;
  }[];
  azureDevOps: unknown;
}
export interface Suggestion {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  businessJustification: string;
  tasks: string[];
}
export type Datum = {
  name: string;
  value: number;
  hours?: number;
  completed?: number;
};
export interface Dashboard {
  total: number;
  inProgress: number;
  completed: number;
  late: number;
  blocked: number;
  slaViolated: number;
  completedThisMonth: number;
  hours: number;
  averageCompletionHours: number;
  categories: Datum[];
  statuses: Datum[];
  assignees: Datum[];
  monthly: { name: string; created: number; completed: number }[];
  sla: Datum[];
  hoursByCategory: Datum[];
  hoursByClient: Datum[];
  hoursByDay: Datum[];
  hoursByWeek: Datum[];
  hoursByMonth: Datum[];
}
