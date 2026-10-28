# Operação local

## Diagnóstico

```powershell
docker compose ps
docker compose logs api --tail 100
docker compose logs migrate --tail 100
docker compose logs sql --tail 50
Invoke-RestMethod http://localhost:5300/health/live
```

`health/live` confirma o processo HTTP, não o acesso ao SQL, SMTP ou Entra. SQL tem healthcheck próprio; a API só inicia após o job de migration.

**Porta 3300 ocupada**: encerre a execução local do frontend antes de iniciar o frontend Docker. Não encerre processos de outros projetos. Para desenvolvimento em outra porta, ajuste também redirect URI Entra/CORS.

**SQL ainda iniciando**: aguarde `healthy` antes de testes nativos. Use `127.0.0.1,14339` para evitar ambiguidades IPv6 de `localhost` no Windows. Containers usam `sql:1433` pela rede do Compose.

**401**: verificar tenant, audience/API Client ID, versão v2, expiração e access token da API (não ID token).

**403**: verificar app role atribuída no enterprise application da API, consentimento do escopo e token renovado após alterações. Permissão local SQL não substitui a autorização Entra.

**Interface ainda em demo**: faltam variáveis públicas do frontend ou não houve rebuild após preenchê-las. Para `npm run dev`, reinicie após editar `.env.local`.

**E-mail pendente**: Email.Enabled deve estar true, relay acessível e STARTTLS suportado. Consulte tentativas/erro em Notificações e logs da API. Não reative em produção sem destinatários/relay homologados.

**Falha IA**: verifique suporte a JSON mode, modelo/deployment, endpoint e chave. A aplicação não altera a atividade quando a resposta é inválida.

**Anexo não disponível após mudança de servidor**: copie/restaure também o volume de arquivos. Metadados estão no SQL; binários estão no volume `attachments`.

## Atualização

Faça backup consistente do SQL/anexos, valide migrations no ambiente de homologação, construa imagens, execute migration e substitua serviços. Não há rollback automático de banco. Os dados de demonstração ficam só na memória do navegador; não são usados para popular o SQL de produção.

## Desenvolvimento independente

Não existem referências de projeto ou execução a Preacher/PortalAD. Nesta sessão de criação foi usado um SDK .NET já disponível na máquina como ferramenta de compilação. Em outra máquina, use SDK .NET 8 instalado ou o Dockerfile, que traz seu próprio SDK de build.
