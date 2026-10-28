# API REST

Base: `/api`. Endpoints exigem access token Entra v2 com audiência da API, `oid`, escopo `access_as_user` e papel autorizado. JSON usa camelCase e enums como strings.

| Método / caminho | Função | Papel adicional |
| --- | --- | --- |
| POST `/session/login` ou `/session/logout` | Provisiona perfil e registra ação | qualquer papel |
| GET `/catalog` | Categorias, clientes e usuários provisionados | qualquer papel |
| GET `/dashboard` | Indicadores filtrados | qualquer papel |
| GET `/activities` | Lista paginada | qualquer papel |
| GET `/activities/{id}` | Atividade | qualquer papel |
| POST `/activities` | Cria | Analyst/Manager/Admin |
| PUT `/activities/{id}` | Atualiza, exige version | Analyst/Manager/Admin |
| PATCH `/activities/{id}/status` | `{status,version}` | Analyst/Manager/Admin |
| DELETE `/activities/{id}?version=...` | Exclusão lógica | Admin |
| POST `/activities/{id}/approve` | `{status:"Done",version}` | Manager/Admin |
| GET `/activities/{id}/details` | Comentários, anexos, horas, histórico | qualquer papel |
| POST `/activities/{id}/comments` | `{text}` | Analyst/Manager/Admin |
| POST `/activities/{id}/timer/start` | Inicia apontamento do usuário | Analyst/Manager/Admin |
| POST `/activities/{id}/timer/pause` ou `/stop` | Finaliza apontamento atual | Analyst/Manager/Admin |
| POST `/activities/{id}/attachments` | Multipart, campo `file`, até 10 MB | Analyst/Manager/Admin |
| GET `/activities/{id}/attachments/{attachmentId}` | Download autenticado | qualquer papel |
| POST `/activities/{id}/suggestion` | Gera sugestão IA | Analyst/Manager/Admin |
| POST `/clients` | `{text:"Nome do cliente"}` | Admin |
| GET `/reports/{kind}/{format}` | Arquivo exportado | qualquer papel |
| GET `/audit?page=1&pageSize=50` | Histórico global paginado | Manager/Admin |
| GET `/notifications` | Últimas notificações do usuário | qualquer papel |
| GET `/integrations` | Estado das integrações, sem segredos | qualquer papel |

Filtros comuns: `search`, `status`, `categoryId`, `clientId`, `assigneeId`, `from`, `to`, `late`, `blocked`, `sort`. Datas ISO8601 com offset, referentes à criação. Lista inclui `page` e `pageSize` (1–500). Ordenações: `due`, `created`, `priority`, `title`.

```json
{
  "title": "Assessment de segurança",
  "description": "Validar controles e documentar evidências",
  "categoryId": "10000000-0000-0000-0000-000000000001",
  "subcategory": "Assessment",
  "priority": "High",
  "severity": "Normal",
  "assigneeId": null,
  "clientId": null,
  "team": "Security Operations",
  "dueAt": "2026-12-10T18:00:00Z",
  "slaAt": "2026-12-11T18:00:00Z",
  "estimatedHours": 8,
  "blocked": false,
  "version": null
}
```

Na edição, envie `version` retornado pela última consulta. Após 409, recarregue e revise antes de reenviar. Após o login, chame `/session/login` antes de criar dados; a interface já segue essa ordem.

Relatórios: `open`, `late`, `pending`, `completed`, `hours`, `ranking`, `completion`, `vulnerabilities`, `assessments`, `incidents`, `backlog`, `sla`. Formatos: `csv`, `xlsx`, `pdf`. Texto exportado neutraliza fórmulas de planilha e é escapado para CSV. PDF usa fonte Arial no Windows ou DejaVu Sans no contêiner.

Erros seguem Problem Details, incluindo `traceId` nos erros globais: 400 validação, 401 sem autenticação válida, 403 sem escopo/papel, 404 ausente, 409 conflito, 422 regra de negócio/configuração, 429 limite, 500 falha inesperada. Limite inicial: 120 requisições por minuto por identidade/IP, fila desabilitada. Use filtros e paginação; o frontend atualiza a lista a cada 30 segundos quando não está editando.
