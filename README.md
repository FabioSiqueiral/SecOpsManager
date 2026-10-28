# SecOps Manager

Portal corporativo para gestão de atividades de Segurança da Informação, Infraestrutura, Governança, Compliance e Cloud. Projeto independente em `C:\Projetos\SecOpsManager`.

## Executar e testar a interface

Abra esta pasta no VS Code, ou abra `SecOpsManager.code-workspace`. O frontend usa a porta **3300**, a API **5300**, e o SQL local **14339**.

Com Node.js 22 instalado:

```powershell
cd C:\Projetos\SecOpsManager\frontend
npm ci
npm run dev
```

Acesse **http://localhost:3300**. Nesta máquina há também um Node local em `.tools`; `scripts/Start-Demo.ps1` o utiliza quando disponível.

Sem configuração Entra no frontend, a interface abre em **demonstração**: 18 atividades fictícias, filtros, gráficos, Kanban, criação/edição em memória, comentários temporários e CSV de exemplo. Recarregar descarta mudanças. Cronômetros, anexos, PDF/XLSX, IA e auditoria persistida exigem a API autenticada. O modo demo **não** modifica nem libera a autenticação da API.

## Executar a solução com Docker

Pré-requisitos: Docker com suporte a containers Linux, memória disponível para SQL Server e acesso aos registries Microsoft/Docker/NPM/NuGet. A primeira construção baixa imagens e dependências.

```powershell
cd C:\Projetos\SecOpsManager
Copy-Item .env.example .env # somente se .env ainda não existir
# Edite SQL_PASSWORD no .env; utilize senha longa e exclusiva.
docker compose up -d --build
docker compose ps
```

Não versione o `.env`. O serviço `migrate` aplica migrations antes da API. `sql-data` persiste o banco e `attachments` persiste evidências. `docker compose stop` para os serviços e preserva os dados. Não remova volumes se quiser manter o banco.

| Serviço | Endereço local |
| --- | --- |
| Interface | http://localhost:3300 |
| API | http://localhost:5300/api |
| Saúde do processo | http://localhost:5300/health/live |
| SQL Server | `127.0.0.1,14339` / banco `SecOpsManager` |

Somente loopback é publicado. SQL Server Developer é destinado a desenvolvimento/testes. Para produção use edição/licenciamento adequados e conta SQL própria com privilégios mínimos. O Compose local usa `sa` por simplicidade; não leve essa configuração ao ambiente corporativo.

## Executar no Ubuntu Server

A aplicação pode ser hospedada em Ubuntu Server usando Docker Compose; não é necessário instalar .NET, Node.js ou SQL Server diretamente no servidor. Use uma máquina `x86_64`/`amd64`, Docker Engine com o plugin Compose, e libere saída de rede para baixar as imagens e dependências. O SQL Server em container requer recursos de memória próprios.

1. Instale Docker Engine e Docker Compose seguindo a documentação oficial do Docker para sua versão do Ubuntu. Adicione seu usuário ao grupo `docker` somente se isso estiver de acordo com a política de segurança do servidor.
2. Copie o projeto para o servidor e entre na pasta raiz (`SecOpsManager`). Crie e proteja o arquivo de ambiente:

   ```bash
   cp .env.example .env
   chmod 600 .env
   SQL_PASSWORD="Aa$(openssl rand -hex 32)9"
   sed -i "s/^SQL_PASSWORD=.*/SQL_PASSWORD=${SQL_PASSWORD}/" .env
   ```

3. Edite `.env` e substitua os endereços de exemplo pelo domínio HTTPS da implantação. Use o mesmo origin (esquema e domínio, sem caminho) nas duas variáveis:

   ```dotenv
   FRONTEND_URL=https://secops.exemplo.com
   PUBLIC_API_URL=https://secops.exemplo.com
   ```

   Configure também `ENTRA_TENANT_ID`, `ENTRA_API_CLIENT_ID`, `ENTRA_FRONTEND_CLIENT_ID` e `ENTRA_API_SCOPE` conforme a seção [Conectar Microsoft Entra ID](#conectar-microsoft-entra-id). O URI de redirecionamento SPA no Entra deve ser `https://secops.exemplo.com`. As variáveis públicas de frontend são incorporadas na imagem, então alterações nelas exigem reconstruir o frontend.
4. Configure Nginx ou outro proxy reverso com TLS para encaminhar `/api/` e `/health/live` para `http://127.0.0.1:5300` e o restante das solicitações para `http://127.0.0.1:3300`. Preserve o caminho da solicitação e encaminhe o cabeçalho `Host`. As portas do Compose ficam limitadas ao loopback; no firewall público, permita somente HTTPS (e HTTP se for usado para redirecionar/emitir certificado). Não publique as portas da API ou do SQL Server na Internet.
5. Inicie os serviços e confira o estado:

   ```bash
   docker compose up -d --build
   docker compose ps
   docker compose logs --tail=100 api
   ```

   O Compose executa as migrations antes da API, persiste banco e anexos em volumes e configura reinício automático após reinicialização do servidor. Para atualizar, obtenha a nova versão do projeto e execute novamente `docker compose up -d --build`. `docker compose down` preserva os volumes; **não** use `docker compose down -v` se precisar dos dados.

O Compose usa SQL Server Developer por padrão, apropriado somente para desenvolvimento e testes. Para uma implantação de produção, confirme o licenciamento e defina `MSSQL_PID` no `.env` para uma edição licenciada suportada, além de avaliar uma conta SQL de privilégio mínimo em vez da conta `sa` usada pela configuração simplificada do Compose.

## Conectar Microsoft Entra ID

Use dois registros de aplicativo, restritos ao seu tenant:

1. **API**: anote Tenant ID e Application/Client ID. Em *Expose an API*, use `api://<API_CLIENT_ID>` e exponha o escopo delegado `access_as_user`. Configure emissão de access tokens v2 (`api.requestedAccessTokenVersion: 2` no manifesto).
2. No registro **API**, crie app roles com valores exatos `Admin`, `Manager`, `Analyst`, `Reader`, permitidos para usuários/grupos. Em *Enterprise applications*, atribua pessoas/grupos às funções e habilite a exigência de atribuição, conforme a política do tenant.
3. **SPA/frontend**: configure a plataforma *Single-page application*, redirect URI `http://localhost:3300` para desenvolvimento e a URL HTTPS final em produção. Conceda à SPA a permissão delegada da API `access_as_user`; forneça consentimento de administrador quando necessário. Não crie client secret para a SPA.
4. Preencha no `.env`:

```dotenv
ENTRA_TENANT_ID=<tenant-guid>
ENTRA_API_CLIENT_ID=<api-guid>
ENTRA_FRONTEND_CLIENT_ID=<spa-guid>
ENTRA_API_SCOPE=api://<api-guid>/access_as_user
```

5. Execute `docker compose up -d --build`. Variáveis `NEXT_PUBLIC_*` são incorporadas na construção do Next.js: alterar Entra ou URL da API exige reconstruir o frontend.
6. Entre com Microsoft. O primeiro login cadastra a identidade e seus papéis no SQL. Usuários aparecem no seletor de responsáveis após o primeiro acesso; administradores podem cadastrar clientes na tela Configurações.

Para frontend fora de Docker, copie `frontend/.env.example` para `frontend/.env.local` e preencha os quatro campos correspondentes. Para backend local, use variáveis de ambiente ou `backend/src/SecOps.Api/appsettings.Local.json`, que não é versionado.

A API valida assinatura, emissor do tenant, audiência, validade, `oid`, escopo delegado e papel. Não aceita um ID token no lugar do access token. A autenticação usa OAuth/OIDC; não depende de LDAP nem de permissões nos controladores de domínio.

| Papel | Permissões |
| --- | --- |
| Reader | Consultar dashboard, atividades, anexos e exportar relatórios |
| Analyst | Reader + criar/editar, status, comentários, anexos, cronômetro e sugestões |
| Manager | Analyst + aprovar conclusão e consultar auditoria |
| Admin | Manager + excluir atividades e cadastrar clientes |

Referência: [Microsoft — validar escopos e app roles](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-protected-web-api-verification-scope-app-roles).

## Backend local e migrations

Instale o SDK .NET 8 e configure `ConnectionStrings__SqlServer`. A configuração padrão usa autenticação integrada e deve ser adaptada ao SQL escolhido.

```powershell
cd backend
dotnet restore
dotnet build
dotnet run --project src/SecOps.Api -- --migrate
dotnet run --project src/SecOps.Api --urls http://localhost:5300
```

Para criar migrations:

```powershell
dotnet tool install --global dotnet-ef --version 8.0.31
dotnet ef migrations add NomeDaMudanca --project src/SecOps.Infrastructure --startup-project src/SecOps.Api
```

Swagger está disponível em `/swagger` quando `ASPNETCORE_ENVIRONMENT=Development`. Para produção, documentação interativa fica desativada. A API continua exigindo Bearer token nos endpoints de negócio.

## IA: Gerar Sugestão Azure DevOps

Na atividade, o botão gera `Title`, `Description`, `AcceptanceCriteria`, `BusinessJustification` e `Tasks`. O resultado é uma sugestão para revisão humana; não cria work items.

No `.env`, configure `AI_ENABLED=true`, `AI_ENDPOINT`, `AI_MODEL` e `AI_KEY`. Para OpenAI, `AI_AUTH_MODE=Bearer`; para endpoint compatível do Azure OpenAI, `AI_AUTH_MODE=Azure`. Use um modelo/deployment que suporte Chat Completions e JSON mode, e a URL completa correspondente à sua implantação, incluindo versão da API quando exigida. O serviço rejeita endpoint sem HTTPS e resposta estruturalmente inválida.

Somente título, descrição, categoria, subcategoria, prioridade e estimativa são enviados. Não envie informações confidenciais ao provedor sem a autorização interna apropriada. Credenciais ficam exclusivamente no servidor. Referências: [OpenAI — Structured Outputs e JSON mode](https://developers.openai.com/api/docs/guides/structured-outputs), [Microsoft — JSON mode](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/json-mode).

## E-mails

Configure `EMAIL_ENABLED`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_FROM`, `EMAIL_USERNAME`, `EMAIL_PASSWORD` e opcionalmente `EMAIL_LOGO_URL` HTTPS. O cliente usa STARTTLS; valide se o relay corporativo aceita esse mecanismo. A URL dos links vem de `FRONTEND_URL`.

O worker roda a cada minuto: vencimento em 7/3/0 dias, atraso, SLA vencido. Atribuição, conclusão e comentário geram mensagens na mesma transação da atividade. A caixa de saída SQL permite até cinco tentativas, consultáveis em Notificações. Lembretes de atraso/SLA são deduplicados por atividade, responsável e dia. A entrega é *pelo menos uma vez*: uma falha entre o envio SMTP e a gravação pode duplicar o e-mail. Execute uma instância do worker nesta versão; múltiplas réplicas exigem coordenação/lease no SQL. Não foram enviados e-mails na instalação inicial.

## Relatórios e regras

- 12 opções na tela Relatórios, com CSV, XLSX real (ClosedXML) e PDF real (PDFsharp).
- Filtros globais de período referem-se à **criação da atividade**. Timestamps são UTC no SQL; agrupamentos do dashboard usam `BusinessTimeZone`, padrão `America/Sao_Paulo`.
- Tempo de conclusão: início da atividade até conclusão; se nunca iniciada, criação até conclusão. Não corresponde exclusivamente a horas de esforço.
- Cronômetro por atividade/usuário. Pausar e encerrar finalizam o apontamento; iniciar novamente cria outro. Concluir/cancelar exige que todos os cronômetros da atividade estejam parados.
- Horas de um apontamento, inclusive em andamento, são atribuídas ao dia/semana/mês de seu início. Apontamentos que cruzam meia-noite não são rateados nesta versão.
- SLA compara prazo com conclusão quando concluída, ou agora quando aberta. Canceladas não violam SLA. Reabrir remove conclusão e aprovação.
- Paginação de atividades: 50, 100, 200, 500; Kanban mostra a página atual. Dashboard recusa mais de 20.000 atividades e relatórios mais de 10.000, pedindo filtros; não exibe totais truncados como completos.
- Exclusão é lógica. A auditoria global é paginada; detalhes mostram os 500 registros mais recentes de comentários, apontamentos e histórico.

## Testes

```powershell
cd backend
dotnet test --filter "Category!=Integration"
# SQL de desenvolvimento, com permissão para aplicar migrations:
$env:SECOPS_TEST_SQL='Server=127.0.0.1,14339;Database=SecOpsManager;User Id=...;Password=...;Encrypt=True;TrustServerCertificate=True'
dotnet test --filter "Category=Integration"
```

O teste SQL cria dados dentro de transação e desfaz as alterações; as migrations permanecem aplicadas. Nunca aponte o teste para produção.

```powershell
cd frontend
npm ci
npm run build
npm run typecheck
# Com interface demo rodando na porta 3300 e Microsoft Edge instalado:
npx playwright test
```

Os testes de autorização usam um handler somente no assembly de testes para verificar as políticas. Não há autenticação de teste registrada na API publicada.

## Implantação corporativa

Use HTTPS com certificado confiável e reverse proxy para Next.js/API, ajuste `FRONTEND_URL`, `PUBLIC_API_URL` e redirect URI Entra. Configure limites de upload, monitoramento e restrição de rede; a API limita requisições por usuário/IP. Execute migrations como job controlado antes da atualização. Separe credenciais de migration e runtime. Configure backup/restauração do SQL e do volume de anexos em conjunto, retenção de auditoria e verificação de arquivos conforme a política da empresa. O armazenamento atual valida extensão/tamanho e entrega anexos como download autenticado; não inclui antivírus.

Credenciais em `.env` são apenas para operação local; utilize o gerenciador de segredos da infraestrutura em produção. Não exponha SQL à internet. Para IIS, hospede a API com Hosting Bundle .NET 8 e um application pool dedicado; hospede Next.js como processo Node gerenciado ou contêiner, com proxy HTTPS. O worker de notificações precisa de processo sempre ativo.

## Entregáveis e limites externos

Consulte [arquitetura e modelo](docs/ARCHITECTURE.md), [referência da API](docs/API.md) e [operação local](docs/OPERATIONS.md). A camada Azure DevOps contém interface e tabela de sincronização, com adapter desativado para implementação futura, conforme a especificação. Login Entra, SMTP e IA precisam ser homologados com as credenciais corporativas; a aplicação não contém credenciais nem dados reais dessas integrações.
