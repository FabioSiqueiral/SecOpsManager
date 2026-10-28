"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Button,
  IconButton,
  TextField,
  MenuItem,
  Alert,
  Chip,
  LinearProgress,
  Pagination,
} from "@mui/material";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import ViewKanbanOutlined from "@mui/icons-material/ViewKanbanOutlined";
import ChecklistOutlined from "@mui/icons-material/ChecklistOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import PublicOutlined from "@mui/icons-material/PublicOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import Add from "@mui/icons-material/Add";
import Refresh from "@mui/icons-material/Refresh";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import NotificationsOutlined from "@mui/icons-material/NotificationsOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import {
  Activity,
  Dashboard,
  Catalog,
  Filters,
  emptyFilters,
  Status,
  statusNames,
  statuses,
  priorities,
} from "@/lib/types";
import { api, configured, download, login, logout, query } from "@/lib/api";
import {
  catalog as demoCatalog,
  initialActivities,
  filterDemo,
  demoDashboard,
} from "@/lib/demo";
import Charts, { Bars } from "./Charts";
import Kanban from "./Kanban";
import ActivityEditor from "./ActivityEditor";
import ActivityPanel from "./ActivityPanel";
const navigation = [
  { name: "Vis\u00e3o geral", icon: DashboardOutlined },
  { name: "Quadro Kanban", icon: ViewKanbanOutlined },
  { name: "Atividades", icon: ChecklistOutlined },
  { name: "Controle de tempo", icon: ScheduleOutlined },
  { name: "Relat\u00f3rios", icon: AssessmentOutlined },
  { name: "Status Sites/IPs", icon: PublicOutlined },
  { name: "Auditoria", icon: HistoryOutlined },
  { name: "Configura\u00e7\u00f5es", icon: SettingsOutlined },
];
const pageDescriptions = [
  "Acompanhe a operação. Antecipe riscos. Mantenha o controle.",
  "Organize as entregas e acompanhe cada etapa da operação.",
  "Todas as demandas de segurança em um só lugar.",
  "Visibilidade sobre esforço, capacidade e produtividade.",
  "Transforme dados operacionais em decisões.",
  "Valide disponibilidade de sites, domínios, URLs e IPs.",
  "Rastreabilidade das ações realizadas no ambiente.",
  "Gerencie seu ambiente e as conexões corporativas.",
];
const reports = [
  ["open", "Atividades abertas"],
  ["late", "Atividades atrasadas"],
  ["pending", "Pendências e bloqueios"],
  ["completed", "Atividades concluídas"],
  ["hours", "Horas trabalhadas"],
  ["ranking", "Produtividade por responsável"],
  ["completion", "Tempo de conclusão"],
  ["vulnerabilities", "Vulnerabilidades"],
  ["assessments", "Assessments"],
  ["incidents", "Incidentes"],
  ["backlog", "Backlog"],
  ["sla", "Cumprimento de SLA"],
];
type Session = { id: string; name: string; email: string; roles: string[] };
type Audit = {
  id: string;
  action: string;
  userId: string;
  createdAt: string;
  details: string;
};
type StatusResult = {
  item: string;
  type: "URL" | "Domínio" | "IP";
  status: "Online" | "Offline";
  httpCode: number | null;
  responseTimeMs: number;
  checkedAt: string;
  error?: string | null;
};
type InvalidStatusItem = { item: string; reason: string };
export default function Workspace() {
  const demo = !configured;
  const refreshSequence = useRef(0);
  const [dark, setDark] = useState(false);
  const [nav, setNav] = useState(0);
  const [session, setSession] = useState<Session | null>(
    demo
      ? {
          id: "user-1",
          name: "Ana Martins",
          email: "ana@example.test",
          roles: ["Admin"],
        }
      : null,
  );
  const [catalog, setCatalog] = useState<Catalog>(
    demo ? demoCatalog : { categories: [], clients: [], users: [] },
  );
  const [all, setAll] = useState<Activity[]>(initialActivities);
  const [items, setItems] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Activity | null>(null);
  const [editor, setEditor] = useState<{ activity: Activity | null } | null>(
    null,
  );
  const [audit, setAudit] = useState<Audit[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [integrations, setIntegrations] = useState<Record<string, unknown>>({});
  const [clientName, setClientName] = useState("");
  const [notices, setNotices] = useState<
    | { id: string; subject: string; kind: string; sentAt: string | null }[]
    | null
  >(null);
  const [statusText, setStatusText] = useState(
    "google.com\nmicrosoft.com\nhttps://portal.empresa.com.br\n8.8.8.8",
  );
  const [ipMethod, setIpMethod] = useState<"ping" | "tcp">("ping");
  const [tcpPort, setTcpPort] = useState(443);
  const [statusResults, setStatusResults] = useState<StatusResult[]>([]);
  const [invalidStatusItems, setInvalidStatusItems] = useState<
    InvalidStatusItem[]
  >([]);
  const write = !!session?.roles.some((r) =>
    ["Admin", "Manager", "Analyst"].includes(r),
  );
  const manage = !!session?.roles.some((r) => ["Admin", "Manager"].includes(r));
  const admin = !!session?.roles.includes("Admin");
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: dark ? "dark" : "light",
          primary: { main: "#10958a" },
          background: {
            default: dark ? "#111b27" : "#f5f7fa",
            paper: dark ? "#192634" : "#fff",
          },
        },
        typography: {
          fontFamily: "Arial, Helvetica, sans-serif",
          button: { textTransform: "none", fontWeight: 600 },
        },
        shape: { borderRadius: 8 },
        components: {
          MuiButton: { defaultProps: { disableElevation: true } },
          MuiTextField: { defaultProps: { size: "small" } },
        },
      }),
    [dark],
  );
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    if (!session) return;
    if (demo) {
      const list = filterDemo(all, filters);
      setItems(list.slice((page - 1) * pageSize, page * pageSize));
      setTotal(list.length);
      setDashboard(demoDashboard(list));
      return;
    }
    const qs = query({
      ...filters,
      to: filters.to
        ? new Date(filters.to + "T23:59:59.999").toISOString()
        : "",
      from: filters.from
        ? new Date(filters.from + "T00:00:00").toISOString()
        : "",
    });
    const [list, stats] = await Promise.all([
      api<{ items: Activity[]; total: number }>(
        `/activities?${qs}&page=${page}&pageSize=${pageSize}`,
      ),
      api<Dashboard>(`/dashboard?${qs}`),
    ]);
    if (sequence !== refreshSequence.current) return;
    setItems(list.items);
    setTotal(list.total);
    setDashboard(stats);
  }, [session, demo, all, filters, page, pageSize]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    refresh()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (demo || !session || editor || selected) return;
    const timer = setInterval(
      () => refresh().catch((e) => setError(e.message)),
      30000,
    );
    return () => clearInterval(timer);
  }, [demo, session, editor, selected, refresh]);
  useEffect(() => {
    if (!session || demo) return;
    if (nav === 6 && manage)
      api<{ items: Audit[]; total: number }>(`/audit?page=${auditPage}`)
        .then((r) => {
          setAudit(r.items);
          setAuditTotal(r.total);
        })
        .catch((e) => setError(e.message));
    if (nav === 7)
      api<Record<string, unknown>>("/integrations")
        .then(setIntegrations)
        .catch((e) => setError(e.message));
  }, [nav, session, demo, manage, auditPage]);
  useEffect(() => {
    if (!session) return;
    const id = new URLSearchParams(window.location.search).get("activity");
    if (id) {
      if (demo) {
        setSelected(all.find((a) => a.id === id) ?? null);
      } else {
        api<Activity>(`/activities/${id}`)
          .then(setSelected)
          .catch((e) => setError(e.message));
      }
    }
  }, [session, demo]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const demoUpdate = (a: Activity) => {
    setAll((list) => list.map((x) => (x.id === a.id ? a : x)));
    setSelected(a);
  };
  const move = async (a: Activity, status: Status) => {
    if (demo) {
      const completedAt = status === "Done" ? new Date().toISOString() : null;
      demoUpdate({
        ...a,
        status,
        completedAt,
        late:
          !["Done", "Cancelled"].includes(status) &&
          Date.parse(a.dueAt) < Date.now(),
        slaViolated: status !== "Cancelled" && Date.parse(a.slaAt) < Date.now(),
      });
    } else {
      const updated = await api<Activity>(
        `/activities/${a.id}/status`,
        "PATCH",
        { status, version: a.version },
      );
      if (selected?.id === a.id) setSelected(updated);
      await refresh();
    }
  };
  const save = async (input: Record<string, unknown>) => {
    if (demo) {
      const previous = editor?.activity;
      const a = {
        ...initialActivities()[0],
        ...previous,
        ...input,
        id: previous?.id ?? crypto.randomUUID(),
        status: previous?.status ?? "Backlog",
        createdAt: previous?.createdAt ?? new Date().toISOString(),
        category:
          catalog.categories.find((c) => c.id === input.categoryId)?.name ?? "",
        assignee:
          catalog.users.find((u) => u.id === input.assigneeId)?.name ??
          "Sem responsável",
        client:
          catalog.clients.find((c) => c.id === input.clientId)?.name ??
          "Interno",
        actualHours: previous?.actualHours ?? 0,
        version: "demo",
      } as Activity;
      a.late =
        !["Done", "Cancelled"].includes(a.status) &&
        Date.parse(a.dueAt) < Date.now();
      a.slaViolated =
        a.status !== "Cancelled" && Date.parse(a.slaAt) < Date.now();
      setAll((list) =>
        previous ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list],
      );
      if (selected?.id === a.id) setSelected(a);
    } else {
      const a = await api<Activity>(
        editor?.activity ? `/activities/${editor.activity.id}` : "/activities",
        editor?.activity ? "PUT" : "POST",
        input,
      );
      if (selected?.id === a.id) setSelected(a);
      await refresh();
    }
  };
  const changeFilter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const parseStatusItems = () =>
    Array.from(
      new Map(
        statusText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => [line.toLowerCase(), line]),
      ).values(),
    );
  const classifyStatusItem = (item: string): StatusResult["type"] | null => {
    if (
      /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(
        item,
      )
    )
      return "IP";
    try {
      const url = new URL(item);
      if (["http:", "https:"].includes(url.protocol) && url.hostname)
        return "URL";
    } catch {}
    if (
      !item.includes("://") &&
      /^(?=.{1,253}$)(?!-)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/.test(item)
    )
      return "Domínio";
    return null;
  };
  const checkStatusDemo = async (items: string[]) => {
    const now = new Date().toISOString();
    const invalid: InvalidStatusItem[] = [];
    const valid = items.flatMap((item) => {
      const type = classifyStatusItem(item);
      if (!type) {
        invalid.push({ item, reason: "Formato inválido." });
        return [];
      }
      return [{ item, type }];
    });
    const results = await Promise.all(
      valid.map(async ({ item, type }) => {
        const started = performance.now();
        if (type === "IP") {
          await new Promise((resolve) => setTimeout(resolve, 80));
          return {
            item,
            type,
            status: item === "8.8.8.8" ? "Online" : "Offline",
            httpCode: null,
            responseTimeMs: Math.round(performance.now() - started),
            checkedAt: now,
          } as StatusResult;
        }
        try {
          const target = type === "Domínio" ? `https://${item}` : item;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(target, {
            method: "HEAD",
            mode: "no-cors",
            signal: controller.signal,
          });
          clearTimeout(timer);
          return {
            item,
            type,
            status: "Online",
            httpCode: response.status || null,
            responseTimeMs: Math.round(performance.now() - started),
            checkedAt: now,
          } as StatusResult;
        } catch {
          return {
            item,
            type,
            status: "Offline",
            httpCode: null,
            responseTimeMs: Math.round(performance.now() - started),
            checkedAt: now,
          } as StatusResult;
        }
      }),
    );
    setStatusResults(results);
    setInvalidStatusItems(invalid);
  };
  const checkStatuses = async () => {
    const items = parseStatusItems();
    if (!items.length) throw new Error("Informe ao menos um site, domínio ou IP.");
    if (demo) {
      await checkStatusDemo(items);
      return;
    }
    const response = await api<{
      results: StatusResult[];
      invalid: InvalidStatusItem[];
    }>("/status/check", "POST", {
      items,
      ipMethod,
      tcpPort,
      concurrency: 25,
    });
    setStatusResults(response.results);
    setInvalidStatusItems(response.invalid);
  };
  const exportStatusCsv = () => {
    const safe = (value: string) =>
      '"' +
      (/^[\s]*[=+@-]/.test(value) ? "'" : "") +
      value.replaceAll('"', '""') +
      '"';
    const rows = [
      ["Item", "Tipo", "Status", "HTTP", "Tempo", "Data/Hora"],
      ...statusResults.map((r) => [
        r.item,
        r.type,
        r.status,
        r.httpCode?.toString() ?? "N/A",
        `${r.responseTimeMs}ms`,
        new Date(r.checkedAt).toLocaleString("pt-BR"),
      ]),
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((row) => row.map(safe).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `status-sites-ips-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const demoCsv = (kind: string) => {
    let list = filterDemo(all, filters);
    if (kind === "open")
      list = list.filter((a) => !["Done", "Cancelled"].includes(a.status));
    else if (kind === "late") list = list.filter((a) => a.late);
    else if (kind === "completed")
      list = list.filter((a) => a.status === "Done");
    else if (kind === "pending")
      list = list.filter((a) => a.blocked || a.status === "Waiting");
    else if (kind === "backlog")
      list = list.filter((a) => a.status === "Backlog");
    else if (["vulnerabilities", "assessments", "incidents"].includes(kind))
      list = list.filter(
        (a) =>
          a.subcategory ===
          (
            {
              vulnerabilities: "Vulnerabilidade",
              assessments: "Assessment",
              incidents: "Incidente",
            } as Record<string, string>
          )[kind],
      );
    const safe = (s: string) =>
      '"' + (/^[\s]*[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
    const content =
      "\uFEFF" +
      [
        [
          "DEMONSTRAÇÃO - Título",
          "Categoria",
          "Responsável",
          "Status",
          "Horas",
        ],
        ...list.map((a) => [
          a.title,
          a.category,
          a.assignee,
          statusNames[a.status],
          String(a.actualHours),
        ]),
      ]
        .map((row) => row.map(safe).join(";"))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `demo-${kind}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className={`workspace ${dark ? "dark" : ""}`}>
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <ShieldOutlined />
            </div>
            <div>
              SecOps<span>MANAGER</span>
            </div>
          </div>
          <div className="workspace-label">
            WORKSPACE <span>INTERNO</span>
          </div>
          <nav>
            {navigation.map(({ name, icon: Icon }, i) => (
              <button
                key={name}
                className={nav === i ? "active" : ""}
                onClick={() => setNav(i)}
              >
                <Icon fontSize="small" />
                {name}
                {i === 2 && <span className="nav-count">{total}</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="system-dot" />{" "}
            {demo ? "Ambiente de demonstração" : "Ambiente corporativo"}
            <p>Segurança começa com visibilidade.</p>
            <span>SecOps Manager · v1.0</span>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div>
              <span className="breadcrumb">Workspace</span>
              <span className="slash">/</span>
              {navigation[nav].name}
            </div>
            <div className="topbar-actions">
              <Chip
                size="small"
                label={demo ? "Demo" : "Microsoft Entra ID"}
                variant="outlined"
              />
              <IconButton
                aria-label="Atualizar"
                disabled={busy || !session}
                onClick={() => run(refresh)}
              >
                <Refresh fontSize="small" />
              </IconButton>
              <IconButton
                aria-label="Alternar tema"
                onClick={() => setDark((d) => !d)}
              >
                {dark ? (
                  <LightModeOutlined fontSize="small" />
                ) : (
                  <DarkModeOutlined fontSize="small" />
                )}
              </IconButton>
              <IconButton
                aria-label="Notificações"
                onClick={() =>
                  run(async () =>
                    setNotices(
                      notices ? null : demo ? [] : await api("/notifications"),
                    ),
                  )
                }
              >
                <NotificationsOutlined fontSize="small" />
              </IconButton>
              <div className="user">
                <span className="avatar">
                  {session?.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("") ?? "ID"}
                </span>
                <div>
                  {session?.name ?? "Visitante"}
                  <small>
                    {session?.roles.join(", ") ?? "Não autenticado"}
                  </small>
                </div>
              </div>
              {session && !demo && (
                <IconButton
                  aria-label="Sair"
                  onClick={() =>
                    run(async () => {
                      await api("/session/logout", "POST");
                      await logout();
                      setSession(null);
                      setItems([]);
                      setDashboard(null);
                    })
                  }
                >
                  <LogoutOutlined fontSize="small" />
                </IconButton>
              )}
            </div>
          </header>
          {busy && <LinearProgress />}
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">SECURITY OPERATIONS</div>
                <h1>{navigation[nav].name}</h1>
                <p>{pageDescriptions[nav]}</p>
              </div>
              {write && nav < 5 && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setEditor({ activity: null })}
                >
                  Nova atividade
                </Button>
              )}
            </div>
            {demo && (
              <Alert severity="info" className="demo-banner">
                Demonstração local · dados fictícios em memória. Alterações são
                descartadas ao recarregar. Conecte o Microsoft Entra ID e a API
                para usar dados reais.
              </Alert>
            )}
            {error && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => setError("")}
              >
                {error}
              </Alert>
            )}
            {notices && (
              <section className="panel">
                <h3>Notificações</h3>
                {!notices.length ? (
                  <p className="muted">Nenhuma notificação disponível.</p>
                ) : (
                  notices.map((n) => (
                    <p key={n.id}>
                      {n.subject}{" "}
                      <Chip
                        size="small"
                        label={n.sentAt ? "Enviada" : "Pendente"}
                      />
                    </p>
                  ))
                )}
              </section>
            )}
            {!session ? (
              <section className="panel login">
                <ShieldOutlined sx={{ fontSize: 48, color: "primary.main" }} />
                <h2>Acesse seu workspace</h2>
                <p>
                  Use uma conta corporativa com uma função autorizada no SecOps
                  Manager.
                </p>
                <Button
                  variant="contained"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await login();
                      const s = await api<Session>("/session/login", "POST");
                      const c = await api<Catalog>("/catalog");
                      setCatalog(c);
                      setSession(s);
                    })
                  }
                >
                  Entrar com Microsoft
                </Button>
              </section>
            ) : (
              <>
                {nav < 5 && (
                  <section className="filters">
                    <TextField
                      placeholder="Buscar atividade…"
                      value={filters.search}
                      onChange={(e) => changeFilter("search", e.target.value)}
                      className="search"
                      slotProps={{
                        htmlInput: { "aria-label": "Buscar atividade" },
                      }}
                    />
                    {(
                      [
                        "categoryId",
                        "assigneeId",
                        "clientId",
                        "status",
                      ] as const
                    ).map((k, i) => (
                      <TextField
                        key={k}
                        select
                        label={
                          ["Categoria", "Responsável", "Cliente", "Status"][i]
                        }
                        value={filters[k]}
                        onChange={(e) => changeFilter(k, e.target.value)}
                      >
                        <MenuItem value="">Todos</MenuItem>
                        {k === "status"
                          ? statuses.map((s) => (
                              <MenuItem key={s} value={s}>
                                {statusNames[s]}
                              </MenuItem>
                            ))
                          : catalog[
                              k === "categoryId"
                                ? "categories"
                                : k === "assigneeId"
                                  ? "users"
                                  : "clients"
                            ].map((x) => (
                              <MenuItem key={x.id} value={x.id}>
                                {x.name}
                              </MenuItem>
                            ))}
                      </TextField>
                    ))}
                    <TextField
                      type="date"
                      label="Criada de"
                      value={filters.from}
                      onChange={(e) => changeFilter("from", e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      type="date"
                      label="Até"
                      value={filters.to}
                      onChange={(e) => changeFilter("to", e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <Button
                      onClick={() => {
                        setFilters(emptyFilters);
                        setPage(1);
                      }}
                    >
                      Limpar
                    </Button>
                  </section>
                )}
                {nav === 0 && dashboard && (
                  <>
                    <div className="section-heading">
                      <h3>Panorama da operação</h3>
                      <span className="muted">
                        {new Date().toLocaleDateString("pt-BR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="metrics">
                      {(
                        [
                          [
                            "Total de atividades",
                            dashboard.total,
                            "Todas as demandas",
                            "neutral",
                          ],
                          [
                            "Em andamento",
                            dashboard.inProgress,
                            "Análise, execução e homologação",
                            "blue",
                          ],
                          [
                            "Concluídas",
                            dashboard.completed,
                            "Entregas finalizadas",
                            "green",
                          ],
                          [
                            "Atrasadas",
                            dashboard.late,
                            "Precisam de atenção",
                            "red",
                          ],
                          [
                            "Bloqueadas",
                            dashboard.blocked,
                            "Dependências pendentes",
                            "amber",
                          ],
                          [
                            "SLA violado",
                            dashboard.slaViolated,
                            "Fora do prazo de atendimento",
                            "red",
                          ],
                          [
                            "Concluídas no mês",
                            dashboard.completedThisMonth,
                            "Mês corrente",
                            "green",
                          ],
                          [
                            "Horas trabalhadas",
                            dashboard.hours.toFixed(1) + "h",
                            "Esforço registrado",
                            "blue",
                          ],
                          [
                            "Tempo médio",
                            dashboard.averageCompletionHours.toFixed(1) + "h",
                            "Início até a conclusão",
                            "neutral",
                          ],
                        ] as const
                      ).map(([label, value, caption, color]) => (
                        <article className={`metric ${color}`} key={label}>
                          <div>
                            {label}
                            <span className="metric-dot" />
                          </div>
                          <strong>{value}</strong>
                          <small>{caption}</small>
                        </article>
                      ))}
                    </div>
                    <Charts data={dashboard} />
                    <section className="panel">
                      <div className="section-heading">
                        <h3>Atenção aos prazos</h3>
                        <Button onClick={() => setNav(2)}>
                          Ver atividades →
                        </Button>
                      </div>
                      {items
                        .filter((a) => a.late || a.blocked)
                        .slice(0, 5)
                        .map((a) => (
                          <button
                            className="attention-row"
                            key={a.id}
                            onClick={() => setSelected(a)}
                          >
                            <span>
                              <strong>{a.title}</strong>
                              <small>
                                {a.assignee} · {a.client}
                              </small>
                            </span>
                            <Chip
                              label={a.blocked ? "Bloqueada" : "Atrasada"}
                              size="small"
                              color={a.blocked ? "warning" : "error"}
                              variant="outlined"
                            />
                          </button>
                        ))}
                      {!items.some((a) => a.late || a.blocked) && (
                        <p className="muted">
                          Nenhuma pendência nos resultados carregados.
                        </p>
                      )}
                    </section>
                  </>
                )}
                {(nav === 1 || nav === 2) && (
                  <>
                    <div className="section-heading">
                      <span className="muted">
                        {total} atividades · {items.length} nesta página
                      </span>
                      <div className="detail-actions">
                        <TextField
                          select
                          label="Ordenar"
                          value={filters.sort}
                          onChange={(e) => changeFilter("sort", e.target.value)}
                        >
                          {[
                            ["due", "Prazo"],
                            ["created", "Mais recentes"],
                            ["priority", "Prioridade"],
                            ["title", "Título"],
                          ].map(([v, n]) => (
                            <MenuItem key={v} value={v}>
                              {n}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="Resultados"
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setPage(1);
                          }}
                        >
                          {[50, 100, 200, 500].map((n) => (
                            <MenuItem key={n} value={n}>
                              {n}
                            </MenuItem>
                          ))}
                        </TextField>
                      </div>
                    </div>
                    {nav === 1 ? (
                      <>
                        <p className="muted">
                          Arraste pelo ícone ⠿ ou abra uma atividade para
                          alterar o status. O quadro mostra a página atual.
                        </p>
                        <Kanban
                          items={items}
                          onOpen={setSelected}
                          disabled={!write || busy}
                          onMove={(a, s) => run(() => move(a, s))}
                        />
                      </>
                    ) : (
                      <section className="panel table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Atividade</th>
                              <th>Categoria</th>
                              <th>Responsável</th>
                              <th>Status</th>
                              <th>Prioridade</th>
                              <th>Prazo</th>
                              <th>Horas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((a) => (
                              <tr key={a.id}>
                                <td>
                                  <button
                                    className="table-link"
                                    onClick={() => setSelected(a)}
                                  >
                                    {a.title}
                                  </button>
                                  <small>
                                    {a.client}
                                    {a.blocked ? " · Bloqueada" : ""}
                                  </small>
                                </td>
                                <td>{a.category}</td>
                                <td>{a.assignee}</td>
                                <td>
                                  <Chip
                                    size="small"
                                    label={statusNames[a.status]}
                                    variant="outlined"
                                  />
                                </td>
                                <td>
                                  <span className={`priority ${a.priority}`}>
                                    {priorities[a.priority]}
                                  </span>
                                </td>
                                <td className={a.late ? "late" : ""}>
                                  {new Date(a.dueAt).toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </td>
                                <td>{a.actualHours.toFixed(1)}h</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!items.length && (
                          <p className="empty-column">
                            Nenhuma atividade encontrada.
                          </p>
                        )}
                      </section>
                    )}
                    <Pagination
                      sx={{ mt: 3 }}
                      count={Math.max(1, Math.ceil(total / pageSize))}
                      page={page}
                      onChange={(_, p) => setPage(p)}
                      color="primary"
                    />
                  </>
                )}
                {nav === 3 && dashboard && (
                  <>
                    <section className="panel">
                      <h3>
                        Esforço registrado: {dashboard.hours.toFixed(2)} horas
                      </h3>
                      <p className="muted">
                        Abra uma atividade para iniciar, pausar ou encerrar seu
                        cronômetro. Totais consideram os filtros de criação
                        acima; períodos de horas usam a data de início do
                        apontamento.
                      </p>
                      <Button onClick={() => setNav(2)}>
                        Abrir atividades
                      </Button>
                    </section>
                    <div className="charts">
                      {[
                        ["Por categoria", dashboard.hoursByCategory],
                        ["Por cliente", dashboard.hoursByClient],
                        ["Por dia", dashboard.hoursByDay],
                        ["Por semana", dashboard.hoursByWeek],
                        ["Por mês", dashboard.hoursByMonth],
                      ].map(([name, data]) => (
                        <section className="panel" key={String(name)}>
                          <h3>{String(name)}</h3>
                          <Bars data={data as Dashboard["hoursByDay"]} />
                        </section>
                      ))}
                    </div>
                  </>
                )}
                {nav === 4 && (
                  <>
                    {demo && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        CSV de exemplo disponível. XLSX e PDF são gerados pela
                        API autenticada.
                      </Alert>
                    )}
                    <div className="reports">
                      {reports.map(([kind, name]) => (
                        <section className="panel report-card" key={kind}>
                          <AssessmentOutlined color="primary" />
                          <h3>{name}</h3>
                          <p className="muted">
                            Exportação considerando os filtros selecionados.
                          </p>
                          <div className="detail-actions">
                            {["csv", "xlsx", "pdf"].map((format) => (
                              <Button
                                key={format}
                                size="small"
                                variant="outlined"
                                disabled={busy || (demo && format !== "csv")}
                                onClick={() =>
                                  run(async () => {
                                    if (demo) demoCsv(kind);
                                    else
                                      await download(
                                        `/reports/${kind}/${format}?${query({ ...filters, to: filters.to ? new Date(filters.to + "T23:59:59.999").toISOString() : "" })}`,
                                        `secops-${kind}.${format}`,
                                      );
                                  })
                                }
                              >
                                {format.toUpperCase()}
                              </Button>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </>
                )}
                {nav === 5 && (
                  <>
                    <section className="panel status-input">
                      <div className="section-heading">
                        <h3>Lista para consulta</h3>
                        <div className="detail-actions">
                          <Button
                            component="label"
                            variant="outlined"
                            startIcon={<UploadFileOutlined />}
                          >
                            Upload TXT
                            <input
                              hidden
                              type="file"
                              accept=".txt,text/plain"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                file.text().then(setStatusText);
                                e.target.value = "";
                              }}
                            />
                          </Button>
                          <TextField
                            select
                            label="Teste IP"
                            value={ipMethod}
                            onChange={(e) =>
                              setIpMethod(e.target.value as "ping" | "tcp")
                            }
                          >
                            <MenuItem value="ping">Ping</MenuItem>
                            <MenuItem value="tcp">TCP</MenuItem>
                          </TextField>
                          {ipMethod === "tcp" && (
                            <TextField
                              label="Porta TCP"
                              type="number"
                              value={tcpPort}
                              onChange={(e) =>
                                setTcpPort(Number(e.target.value))
                              }
                              slotProps={{ htmlInput: { min: 1, max: 65535 } }}
                            />
                          )}
                        </div>
                      </div>
                      <TextField
                        multiline
                        minRows={8}
                        fullWidth
                        value={statusText}
                        onChange={(e) => setStatusText(e.target.value)}
                        placeholder={
                          "google.com\n8.8.8.8\nportal.empresa.com.br"
                        }
                      />
                      <div className="detail-actions">
                        <Button
                          variant="contained"
                          disabled={busy}
                          onClick={() => run(checkStatuses)}
                        >
                          Verificar
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<FileDownloadOutlined />}
                          disabled={!statusResults.length}
                          onClick={exportStatusCsv}
                        >
                          Exportar CSV
                        </Button>
                        <span className="muted">
                          {parseStatusItems().length} itens únicos prontos para
                          consulta
                        </span>
                      </div>
                    </section>
                    <div className="metrics status-summary">
                      {[
                        [
                          "Online",
                          statusResults.filter((r) => r.status === "Online")
                            .length,
                          "green",
                        ],
                        [
                          "Offline",
                          statusResults.filter((r) => r.status === "Offline")
                            .length,
                          "red",
                        ],
                        ["Total", statusResults.length, "blue"],
                      ].map(([label, value, color]) => (
                        <article className={`metric ${color}`} key={label}>
                          <div>
                            {label}
                            <span className="metric-dot" />
                          </div>
                          <strong>{value}</strong>
                          <small>Total consultado</small>
                        </article>
                      ))}
                    </div>
                    {invalidStatusItems.length > 0 && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {invalidStatusItems.length} item(ns) inválido(s):{" "}
                        {invalidStatusItems.map((i) => i.item).join(", ")}
                      </Alert>
                    )}
                    <section className="panel table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Tipo</th>
                            <th>Status</th>
                            <th>HTTP</th>
                            <th>Tempo</th>
                            <th>Data/Hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statusResults.map((r) => (
                            <tr key={`${r.item}-${r.checkedAt}`}>
                              <td>{r.item}</td>
                              <td>{r.type}</td>
                              <td>
                                <span
                                  className={`status-pill ${r.status.toLowerCase()}`}
                                >
                                  {r.status}
                                </span>
                              </td>
                              <td>{r.httpCode ?? "N/A"}</td>
                              <td>{r.responseTimeMs}ms</td>
                              <td>
                                {new Date(r.checkedAt).toLocaleString("pt-BR")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!statusResults.length && (
                        <p className="empty-column">
                          Nenhuma consulta executada ainda.
                        </p>
                      )}
                    </section>
                  </>
                )}
                {nav === 6 &&
                  (!manage ? (
                    <Alert severity="warning">
                      A auditoria é restrita a administradores e gestores.
                    </Alert>
                  ) : (
                    <section className="panel table-wrap">
                      <h3>Registro de auditoria</h3>
                      {demo && (
                        <p className="muted">
                          Os registros persistidos estarão disponíveis no
                          ambiente autenticado.
                        </p>
                      )}
                      <table>
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Ação</th>
                            <th>Usuário</th>
                            <th>Detalhes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audit.map((a) => (
                            <tr key={a.id}>
                              <td>
                                {new Date(a.createdAt).toLocaleString("pt-BR")}
                              </td>
                              <td>{a.action}</td>
                              <td>
                                {catalog.users.find((u) => u.id === a.userId)
                                  ?.name ?? a.userId}
                              </td>
                              <td className="history-details">{a.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Pagination
                        page={auditPage}
                        count={Math.max(1, Math.ceil(auditTotal / 50))}
                        onChange={(_, p) => setAuditPage(p)}
                      />
                    </section>
                  ))}
                {nav === 7 && (
                  <>
                    <div className="reports">
                      {[
                        [
                          "Microsoft Entra ID",
                          demo ? "Não configurado" : "Autenticação ativa",
                          "Papéis Admin, Manager, Analyst e Reader.",
                        ],
                        [
                          "Assistente de IA",
                          integrations.aiEnabled
                            ? "Habilitado"
                            : "Desabilitado",
                          "Configure o provedor e as credenciais no servidor.",
                        ],
                        [
                          "Notificações por e-mail",
                          integrations.emailEnabled
                            ? "Habilitadas"
                            : "Desabilitadas",
                          "Lembretes, atribuições, conclusões e comentários via SMTP.",
                        ],
                        [
                          "Azure DevOps",
                          "Integração futura",
                          "Contrato e modelo preparados. Sincronização remota ainda não implementada.",
                        ],
                      ].map(([name, state, desc]) => (
                        <section className="panel" key={name}>
                          <h3>{name}</h3>
                          <Chip size="small" label={state} />
                          <p className="muted">{desc}</p>
                        </section>
                      ))}
                    </div>
                    <section className="panel">
                      <h3>Clientes</h3>
                      <div className="detail-actions">
                        {catalog.clients.map((c) => (
                          <Chip key={c.id} label={c.name} />
                        ))}
                      </div>
                      {admin && (
                        <form
                          className="detail-actions"
                          onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                              const c = demo
                                ? { id: crypto.randomUUID(), name: clientName }
                                : await api<{ id: string; name: string }>(
                                    "/clients",
                                    "POST",
                                    { text: clientName },
                                  );
                              setCatalog((old) => ({
                                ...old,
                                clients: [...old.clients, c],
                              }));
                              setClientName("");
                            });
                          }}
                        >
                          <TextField
                            label="Novo cliente"
                            required
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                          />
                          <Button
                            type="submit"
                            disabled={busy || !clientName.trim()}
                          >
                            Adicionar cliente
                          </Button>
                        </form>
                      )}
                    </section>
                    <section className="panel">
                      <h3>Categorias</h3>
                      {catalog.categories.map((c) => (
                        <p key={c.id}>
                          <strong>{c.name}</strong>
                          <br />
                          <span className="muted">
                            {c.subcategories.join(" · ")}
                          </span>
                        </p>
                      ))}
                    </section>
                  </>
                )}
              </>
            )}
            <footer>
              SecOps Manager <span>Gestão de segurança, com clareza.</span>
            </footer>
          </main>
        </div>
        {selected && (
          <ActivityPanel
            key={selected.id}
            activity={selected}
            catalog={catalog}
            demo={demo}
            write={write}
            manage={manage}
            admin={admin}
            onClose={() => setSelected(null)}
            onEdit={() => setEditor({ activity: selected })}
            onMove={move}
            onRefresh={async () => {
              await refresh();
              if (!demo)
                setSelected(await api<Activity>(`/activities/${selected.id}`));
            }}
            onDemoUpdate={demoUpdate}
            onDemoDelete={() =>
              setAll((list) => list.filter((a) => a.id !== selected.id))
            }
          />
        )}{" "}
        {editor && (
          <ActivityEditor
            activity={editor.activity}
            catalog={catalog}
            onClose={() => setEditor(null)}
            onSave={save}
          />
        )}
      </div>
    </ThemeProvider>
  );
}
