import {
  PublicClientApplication,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
const clientId = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
export const configured =
  !!clientId &&
  !!process.env.NEXT_PUBLIC_ENTRA_TENANT_ID &&
  !!process.env.NEXT_PUBLIC_API_SCOPE;
let instance: PublicClientApplication | undefined;
let initialization: Promise<void> | undefined;
async function auth() {
  if (!instance) {
    instance = new PublicClientApplication({
      auth: {
        clientId: clientId!,
        authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_ENTRA_TENANT_ID}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    initialization = instance.initialize();
  }
  await initialization;
  return instance;
}
const scopes = () => [process.env.NEXT_PUBLIC_API_SCOPE!];
export async function login() {
  const a = await auth();
  const r = await a.loginPopup({ scopes: scopes() });
  a.setActiveAccount(r.account);
  return r.account;
}
export async function logout() {
  const a = await auth();
  await a.logoutPopup({
    account: a.getActiveAccount() ?? a.getAllAccounts()[0],
    postLogoutRedirectUri: window.location.origin,
  });
}
async function token() {
  const a = await auth();
  const account = a.getActiveAccount() ?? a.getAllAccounts()[0];
  if (!account) throw new Error("Entre com sua conta Microsoft.");
  try {
    return (await a.acquireTokenSilent({ scopes: scopes(), account }))
      .accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError)
      return (await a.acquireTokenPopup({ scopes: scopes(), account }))
        .accessToken;
    throw e;
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await token()}`,
  };
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5300"}/api${path}`,
    {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    },
  );
  if (!response.ok) {
    const problem = await response
      .json()
      .catch(() => ({ title: `HTTP ${response.status}` }));
    throw new Error(problem.title ?? "Falha na consulta.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export async function download(path: string, name: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5300"}/api${path}`,
    { headers: { Authorization: `Bearer ${await token()}` } },
  );
  if (!response.ok) {
    const p = await response
      .json()
      .catch(() => ({ title: "Exportação indisponível" }));
    throw new Error(p.title);
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function query(filters: Record<string, unknown>) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) p.set(k, String(v));
  });
  return p.toString();
}
