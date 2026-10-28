"use client";
import { useEffect, useState } from "react";
import {
  Drawer,
  Button,
  IconButton,
  TextField,
  MenuItem,
  Alert,
  Divider,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import {
  Activity,
  ActivityDetail,
  Catalog,
  Status,
  statusNames,
  statuses,
  Suggestion,
} from "@/lib/types";
import { api, download } from "@/lib/api";

function buildLocalSuggestion(a: Activity): Suggestion {
  const scope =
    a.description?.trim() ||
    "Descrever o contexto, escopo e resultado esperado.";
  return {
    title: a.title,
    description: `Objetivo\n${scope}\n\nContexto operacional: ${a.category}${a.subcategory ? ` / ${a.subcategory}` : ""}. Cliente: ${a.client}. Equipe: ${a.team}.`,
    acceptanceCriteria: [
      "Escopo e critérios de sucesso validados com o solicitante.",
      "Execução registrada no card com evidências anexadas.",
      `Resultado revisado pelo responsável ${a.assignee}.`,
      "Status e próximos passos atualizados no Azure DevOps.",
    ],
    businessJustification: `Tratar esta atividade reduz risco operacional e mantém a rastreabilidade de ${a.category.toLowerCase()} (${a.priority.toLowerCase()}).`,
    tasks: [
      "Levantar contexto, dependências e acessos necessários.",
      "Executar a análise ou implementação prevista no escopo.",
      "Registrar evidências, decisões e desvios encontrados.",
      "Validar o resultado com o solicitante e atualizar o card.",
    ],
  };
}

function suggestionAsText(s: Suggestion) {
  return [
    `Título:\n${s.title}`,
    `Descrição:\n${s.description}`,
    `Critérios de aceite:\n${s.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}`,
    `Justificativa:\n${s.businessJustification}`,
    `Tarefas:\n${s.tasks.map((item) => `- ${item}`).join("\n")}`,
  ].join("\n\n");
}
export default function ActivityPanel({
  activity: a,
  catalog,
  demo,
  write,
  manage,
  admin,
  onClose,
  onEdit,
  onMove,
  onRefresh,
  onDemoUpdate,
  onDemoDelete,
}: {
  activity: Activity;
  catalog: Catalog;
  demo: boolean;
  write: boolean;
  manage: boolean;
  admin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMove: (a: Activity, s: Status) => Promise<void>;
  onRefresh: () => Promise<void>;
  onDemoUpdate: (a: Activity) => void;
  onDemoDelete: () => void;
}) {
  const [detail, setDetail] = useState<ActivityDetail>({
    comments: [],
    attachments: [],
    timeEntries: [],
    history: [],
    azureDevOps: null,
  });
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [copied, setCopied] = useState("");
  const load = async () => {
    if (!demo)
      setDetail(await api<ActivityDetail>(`/activities/${a.id}/details`));
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [a.id, a.version]);
  const run = async (fn: () => Promise<void>, removing = false) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (!removing) {
        await onRefresh();
        await load();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copySuggestion = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setError(
        "Não foi possível copiar o conteúdo. Selecione o texto manualmente.",
      );
    }
  };
  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", md: 660 }, p: 3 } } }}
    >
      <div className="section-heading">
        <span className="eyebrow">DETALHES DA ATIVIDADE</span>
        <IconButton onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </IconButton>
      </div>
      <h2>{a.title}</h2>
      <p className="muted">
        {a.category} / {a.subcategory || "Geral"} · {a.client}
      </p>
      {error && <Alert severity="error">{error}</Alert>}
      <div className="detail-actions">
        <TextField
          select
          size="small"
          label="Status"
          value={a.status}
          disabled={!write || busy}
          onChange={(e) => run(() => onMove(a, e.target.value as Status))}
        >
          {statuses.map((s) => (
            <MenuItem key={s} value={s}>
              {statusNames[s]}
            </MenuItem>
          ))}
        </TextField>
        {write && <Button onClick={onEdit}>Editar</Button>}
        {manage && a.status === "Done" && !a.approvedBy && (
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (demo) onDemoUpdate({ ...a, approvedBy: "demo" });
                else
                  await api(`/activities/${a.id}/approve`, "POST", {
                    status: a.status,
                    version: a.version,
                  });
              })
            }
          >
            Aprovar conclusão
          </Button>
        )}
        {a.approvedBy && (
          <Chip label="Conclusão aprovada" color="success" size="small" />
        )}
      </div>
      <p className="description">{a.description || "Sem descrição."}</p>
      <div className="facts">
        <div>
          <small>Responsável</small>
          {a.assignee}
        </div>
        <div>
          <small>Equipe</small>
          {a.team}
        </div>
        <div>
          <small>Prazo</small>
          {new Date(a.dueAt).toLocaleString("pt-BR")}
        </div>
        <div>
          <small>Limite do SLA</small>
          {new Date(a.slaAt).toLocaleString("pt-BR")}
        </div>
        <div>
          <small>Criada em</small>
          {new Date(a.createdAt).toLocaleString("pt-BR")}
        </div>
        <div>
          <small>Solicitante</small>
          {catalog.users.find((u) => u.id === a.requesterId)?.name ??
            a.requesterId}
        </div>
      </div>
      <Divider sx={{ my: 3 }} />
      <h3>
        Controle de tempo{" "}
        <small>
          {a.actualHours.toFixed(2)}h / {a.estimatedHours}h estimadas
        </small>
      </h3>
      {a.timerRunning && (
        <Alert severity="info">
          Há um cronômetro em andamento nesta atividade.
        </Alert>
      )}
      <div className="detail-actions">
        {(["start", "pause", "stop"] as const).map((action, i) => (
          <Button
            key={action}
            disabled={!write || busy || demo}
            variant={i === 0 ? "contained" : "outlined"}
            onClick={() =>
              run(async () => {
                await api(`/activities/${a.id}/timer/${action}`, "POST");
              })
            }
          >
            {["Iniciar", "Pausar", "Encerrar"][i]}
          </Button>
        ))}
      </div>
      {demo && (
        <p className="muted">
          Cronômetros persistidos ficam disponíveis após conectar a API.
        </p>
      )}
      {detail.timeEntries.slice(0, 10).map((t) => (
        <p key={t.id} className="muted">
          {catalog.users.find((u) => u.id === t.userId)?.name ?? t.userId}:{" "}
          {new Date(t.startedAt).toLocaleString("pt-BR")} →{" "}
          {t.endedAt
            ? new Date(t.endedAt).toLocaleString("pt-BR")
            : "Em andamento"}
        </p>
      ))}
      <Divider sx={{ my: 3 }} />
      <h3>Comentários</h3>
      <TextField
        placeholder="Registre uma atualização…"
        fullWidth
        multiline
        minRows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={!write}
        slotProps={{ htmlInput: { maxLength: 8000 } }}
      />
      <Button
        sx={{ my: 1 }}
        disabled={!write || busy || !comment.trim()}
        onClick={() =>
          run(async () => {
            if (demo)
              setDetail((d) => ({
                ...d,
                comments: [
                  {
                    id: crypto.randomUUID(),
                    userId: "user-1",
                    text: comment,
                    createdAt: new Date().toISOString(),
                  },
                  ...d.comments,
                ],
              }));
            else
              await api(`/activities/${a.id}/comments`, "POST", {
                text: comment,
              });
            setComment("");
          })
        }
      >
        Publicar comentário
      </Button>
      {detail.comments.map((c) => (
        <div key={c.id} className="comment">
          <strong>
            {catalog.users.find((u) => u.id === c.userId)?.name ?? "Usuário"}
          </strong>
          <small>{new Date(c.createdAt).toLocaleString("pt-BR")}</small>
          <p>{c.text}</p>
        </div>
      ))}
      <Divider sx={{ my: 3 }} />
      <h3>Anexos e evidências</h3>
      <Button
        component="label"
        variant="outlined"
        disabled={!write || busy || demo}
      >
        Enviar arquivo
        <input
          hidden
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.xlsx,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              run(async () => {
                const data = new FormData();
                data.append("file", file);
                await api(`/activities/${a.id}/attachments`, "POST", data);
              });
            e.target.value = "";
          }}
        />
      </Button>
      <p className="muted">Até 10 MB. PDF, imagem, TXT, CSV, XLSX ou DOCX.</p>
      {detail.attachments.map((f) => (
        <Button
          key={f.id}
          onClick={() =>
            run(() =>
              download(`/activities/${a.id}/attachments/${f.id}`, f.fileName),
            )
          }
        >
          {f.fileName} · {Math.ceil(f.size / 1024)} KB
        </Button>
      ))}
      <Divider sx={{ my: 3 }} />
      <h3>Sugestão para card Azure DevOps</h3>
      <p className="muted">
        Gera uma sugestão estruturada para Azure DevOps. Revise o conteúdo antes
        de utilizá-lo.
      </p>
      <Button
        startIcon={<AutoAwesomeOutlined />}
        variant="contained"
        color="primary"
        disabled={!write || busy}
        onClick={() =>
          run(async () => {
            if (demo) setSuggestion(buildLocalSuggestion(a));
            else
              setSuggestion(
                await api<Suggestion>(`/activities/${a.id}/suggestion`, "POST"),
              );
          })
        }
      >
        Sugerir conteúdo para Azure DevOps
      </Button>
      {suggestion && (
        <div className="suggestion">
          <div className="suggestion-header">
            <strong>Conteúdo pronto para o card</strong>
            <Button
              size="small"
              startIcon={
                copied === "all" ? <CheckOutlined /> : <ContentCopyOutlined />
              }
              onClick={() =>
                copySuggestion("all", suggestionAsText(suggestion))
              }
            >
              {copied === "all" ? "Copiado" : "Copiar tudo"}
            </Button>
          </div>
          <h4>{suggestion.title}</h4>
          <p className="suggestion-text">{suggestion.description}</p>
          <strong>Critérios de aceite</strong>
          <ul>
            {suggestion.acceptanceCriteria.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <strong>Justificativa</strong>
          <p>{suggestion.businessJustification}</p>
          <strong>Tarefas</strong>
          <ul>
            {suggestion.tasks.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <Divider sx={{ my: 3 }} />
      <h3>Histórico</h3>
      {!detail.history.length && (
        <p className="muted">
          Nenhum registro carregado{demo ? " neste exemplo" : ""}.
        </p>
      )}
      {detail.history.map((h) => (
        <div className="comment" key={h.id}>
          <strong>{h.action}</strong>
          <small>{new Date(h.createdAt).toLocaleString("pt-BR")}</small>
          <p className="history-details">{h.details}</p>
        </div>
      ))}
      {admin && (
        <Button
          color="error"
          sx={{ mt: 3 }}
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Excluir esta atividade? O histórico será preservado.",
              )
            )
              run(async () => {
                if (demo) onDemoDelete();
                else
                  await api(
                    `/activities/${a.id}?version=${encodeURIComponent(a.version)}`,
                    "DELETE",
                  );
                onClose();
              }, true);
          }}
        >
          Excluir atividade
        </Button>
      )}
    </Drawer>
  );
}
