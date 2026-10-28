import { Activity, Catalog, Dashboard, Filters, statuses } from "./types";
export const catalog: Catalog = {
  categories: [
    [
      "Segurança",
      "Assessment",
      "Vulnerabilidade",
      "Hardening",
      "Compliance",
      "LGPD",
      "Auditoria",
    ],
    [
      "Infraestrutura",
      "Azure",
      "Microsoft 365",
      "Active Directory",
      "Backup",
      "Virtualização",
    ],
    ["Monitoramento", "Netskope", "Sentinel", "Defender", "Firewall", "SIEM"],
    ["Projetos", "Implementação", "Migração", "Atualização", "Melhoria"],
    ["Suporte", "Incidente", "Problema", "Requisição"],
  ].map((v, i) => ({
    id: `10000000-0000-0000-0000-00000000000${i + 1}`,
    name: v[0],
    subcategories: v.slice(1),
  })),
  clients: [
    { id: "client-1", name: "Operações internas" },
    { id: "client-2", name: "Grupo Atlas" },
    { id: "client-3", name: "Cloud Services" },
  ],
  users: [
    { id: "user-1", name: "Ana Martins", email: "ana@example.test" },
    { id: "user-2", name: "Lucas Ferreira", email: "lucas@example.test" },
    { id: "user-3", name: "Beatriz Costa", email: "beatriz@example.test" },
    { id: "user-4", name: "Rafael Lima", email: "rafael@example.test" },
  ],
};
export function initialActivities(): Activity[] {
  const titles = [
    "Assessment de segurança Netskope",
    "Correção de vulnerabilidades críticas",
    "Revisão de acessos privilegiados",
    "Hardening de servidores Windows",
    "Políticas de Conditional Access",
    "Revisão das regras de firewall",
    "Plano de continuidade e backup",
    "Migração do ambiente de homologação",
    "Investigação de alerta no Sentinel",
    "Adequação de controles LGPD",
    "Atualização dos agentes Defender",
    "Análise de incidente de autenticação",
    "Mapeamento de riscos em Azure",
    "Revisão do processo de onboarding",
    "Evidências para auditoria trimestral",
    "Implementação de MFA para parceiros",
    "Teste de recuperação de desastres",
    "Documentação de resposta a incidentes",
  ];
  const now = Date.now();
  return titles.map((title, i) => {
    const cat = catalog.categories[i % 5],
      person = catalog.users[i % 4],
      client = catalog.clients[i % 3];
    const status = statuses[i % 8];
    const due = new Date(now + ((i % 7) - 2) * 86400000).toISOString();
    return {
      id: `demo-${i + 1}`,
      title,
      description: `Avaliar o cenário atual, identificar riscos e documentar os controles para ${title.toLowerCase()}.\n\nEscopo: ambiente corporativo. Entregáveis: evidências técnicas e plano de ação revisado.`,
      categoryId: cat.id,
      category: cat.name,
      subcategory: cat.subcategories[i % cat.subcategories.length],
      priority: i % 5 === 0 ? "Critical" : i % 3 === 0 ? "High" : "Normal",
      severity: i % 4 === 0 ? "High" : "Normal",
      assigneeId: person.id,
      assignee: person.name,
      clientId: client.id,
      client: client.name,
      team: "Security Operations",
      requesterId: "user-1",
      status,
      blocked: i === 4 || i === 12,
      createdAt: new Date(now - (i * 8 + 1) * 86400000).toISOString(),
      startedAt: new Date(now - i * 86400000).toISOString(),
      dueAt: due,
      slaAt: due,
      completedAt:
        status === "Done" ? new Date(now - i * 86400000).toISOString() : null,
      estimatedHours: 8 + (i % 4) * 4,
      actualHours: Math.round(i * 1.3),
      late: !["Done", "Cancelled"].includes(status) && Date.parse(due) < now,
      slaViolated: status !== "Cancelled" && Date.parse(due) < now,
      version: "demo",
      timerRunning: false,
      approvedBy: null,
    };
  });
}
export function filterDemo(all: Activity[], f: Filters) {
  return all
    .filter(
      (a) =>
        (!f.search ||
          `${a.title} ${a.description} ${a.team}`
            .toLowerCase()
            .includes(f.search.toLowerCase())) &&
        (!f.status || a.status === f.status) &&
        (!f.categoryId || a.categoryId === f.categoryId) &&
        (!f.clientId || a.clientId === f.clientId) &&
        (!f.assigneeId || a.assigneeId === f.assigneeId) &&
        (!f.from || a.createdAt >= f.from) &&
        (!f.to || a.createdAt <= f.to + "T23:59:59Z"),
    )
    .sort((a, b) =>
      f.sort === "created"
        ? b.createdAt.localeCompare(a.createdAt)
        : f.sort === "title"
          ? a.title.localeCompare(b.title)
          : a.dueAt.localeCompare(b.dueAt),
    );
}
export function demoDashboard(all: Activity[]): Dashboard {
  const group = (key: keyof Activity) =>
    Object.entries(
      all.reduce<Record<string, number>>((r, a) => {
        const n = String(a[key]);
        r[n] = (r[n] ?? 0) + 1;
        return r;
      }, {}),
    ).map(([name, value]) => ({ name, value }));
  const done = all.filter((a) => a.status === "Done");
  const hours = all.reduce((s, a) => s + a.actualHours, 0);
  return {
    total: all.length,
    inProgress: all.filter((a) =>
      ["Analysis", "Execution", "Validation"].includes(a.status),
    ).length,
    completed: done.length,
    late: all.filter((a) => a.late).length,
    blocked: all.filter((a) => a.blocked).length,
    slaViolated: all.filter((a) => a.slaViolated).length,
    completedThisMonth: done.filter(
      (a) =>
        a.completedAt?.slice(0, 7) === new Date().toISOString().slice(0, 7),
    ).length,
    hours,
    averageCompletionHours: done.length
      ? Math.round(
          done.reduce(
            (s, a) =>
              s +
              (Date.parse(a.completedAt!) - Date.parse(a.createdAt)) / 3600000,
            0,
          ) / done.length,
        )
      : 0,
    categories: group("category"),
    statuses: group("status"),
    assignees: group("assignee"),
    monthly: Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - 5 + i);
      const month = date.toISOString().slice(0, 7);
      return {
        name: month,
        created: all.filter((a) => a.createdAt.startsWith(month)).length,
        completed: done.filter((a) => a.completedAt?.startsWith(month)).length,
      };
    }),
    sla: [
      { name: "Cumprido", value: done.filter((a) => !a.slaViolated).length },
      { name: "Violado", value: all.filter((a) => a.slaViolated).length },
      {
        name: "Em prazo",
        value: all.filter(
          (a) => !a.slaViolated && !["Done", "Cancelled"].includes(a.status),
        ).length,
      },
    ],
    hoursByCategory: group("category").map((x) => ({
      ...x,
      value: all
        .filter((a) => a.category === x.name)
        .reduce((s, a) => s + a.actualHours, 0),
    })),
    hoursByClient: group("client").map((x) => ({
      ...x,
      value: all
        .filter((a) => a.client === x.name)
        .reduce((s, a) => s + a.actualHours, 0),
    })),
    hoursByDay: [],
    hoursByWeek: [],
    hoursByMonth: [],
  };
}
