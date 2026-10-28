"use client";
import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
} from "@mui/material";
import { Activity, Catalog, priorities, Priority } from "@/lib/types";
const localDate = (s: string) => {
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function ActivityEditor({
  activity,
  catalog,
  onClose,
  onSave,
}: {
  activity: Activity | null;
  catalog: Catalog;
  onClose: () => void;
  onSave: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: activity?.title ?? "",
    description: activity?.description ?? "",
    categoryId: activity?.categoryId ?? catalog.categories[0]?.id ?? "",
    subcategory: activity?.subcategory ?? "",
    priority: activity?.priority ?? "Normal",
    severity: activity?.severity ?? "Normal",
    assigneeId: activity?.assigneeId ?? "",
    clientId: activity?.clientId ?? "",
    team: activity?.team ?? "Security Operations",
    dueAt: localDate(
      activity?.dueAt ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    ),
    slaAt: localDate(
      activity?.slaAt ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    ),
    estimatedHours: activity?.estimatedHours ?? 0,
    blocked: activity?.blocked ?? false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof form, value: string | number | boolean) =>
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === "categoryId" ? { subcategory: "" } : {}),
    }));
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave({
              ...form,
              assigneeId: form.assigneeId || null,
              clientId: form.clientId || null,
              dueAt: new Date(form.dueAt).toISOString(),
              slaAt: new Date(form.slaAt).toISOString(),
              version: activity?.version,
            });
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <DialogTitle>
          {activity ? "Editar atividade" : "Nova atividade"}
        </DialogTitle>
        <DialogContent>
          <div className="editor-grid">
            {error && (
              <Alert severity="error" className="span2">
                {error}
              </Alert>
            )}
            <TextField
              label="Título"
              required
              className="span2"
              value={form.title}
              onChange={(e) => field("title", e.target.value)}
              slotProps={{ htmlInput: { minLength: 3, maxLength: 200 } }}
            />
            <TextField
              label="Descrição e entregáveis"
              multiline
              minRows={4}
              className="span2"
              value={form.description}
              onChange={(e) => field("description", e.target.value)}
              slotProps={{ htmlInput: { maxLength: 12000 } }}
            />
            <TextField
              select
              label="Categoria"
              value={form.categoryId}
              onChange={(e) => field("categoryId", e.target.value)}
            >
              {catalog.categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Subcategoria"
              value={form.subcategory}
              onChange={(e) => field("subcategory", e.target.value)}
            >
              <MenuItem value="">Não definida</MenuItem>
              {catalog.categories
                .find((c) => c.id === form.categoryId)
                ?.subcategories.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
            </TextField>
            {(["priority", "severity"] as const).map((k) => (
              <TextField
                key={k}
                select
                label={k === "priority" ? "Prioridade" : "Severidade"}
                value={form[k]}
                onChange={(e) => field(k, e.target.value as Priority)}
              >
                {Object.entries(priorities).map(([v, l]) => (
                  <MenuItem key={v} value={v}>
                    {l}
                  </MenuItem>
                ))}
              </TextField>
            ))}
            <TextField
              select
              label="Responsável"
              value={form.assigneeId}
              onChange={(e) => field("assigneeId", e.target.value)}
            >
              <MenuItem value="">Não atribuído</MenuItem>
              {catalog.users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Cliente"
              value={form.clientId}
              onChange={(e) => field("clientId", e.target.value)}
            >
              <MenuItem value="">Interno</MenuItem>
              {catalog.clients.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Equipe"
              value={form.team}
              onChange={(e) => field("team", e.target.value)}
            />
            <TextField
              label="Horas estimadas"
              type="number"
              value={form.estimatedHours}
              onChange={(e) => field("estimatedHours", Number(e.target.value))}
              slotProps={{ htmlInput: { min: 0, max: 10000, step: 0.25 } }}
            />
            {(["dueAt", "slaAt"] as const).map((k) => (
              <TextField
                key={k}
                label={k === "dueAt" ? "Prazo" : "Limite do SLA"}
                type="datetime-local"
                value={form[k]}
                required
                onChange={(e) => field(k, e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            ))}
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.blocked}
                  onChange={(e) => field("blocked", e.target.checked)}
                />
              }
              label="Atividade bloqueada"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Salvando…" : "Salvar atividade"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
