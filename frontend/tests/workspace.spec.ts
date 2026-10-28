import { test, expect } from "@playwright/test";
test("dashboard, cadastro, filtros, detalhes e modo escuro", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Demonstração local · dados fictícios em memória.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Total de atividades", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nova atividade", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill("Validação automatizada do SecOps");
  await page
    .getByLabel("Descrição e entregáveis")
    .fill("Atividade fictícia criada durante teste de interface.");
  await page
    .getByRole("button", { name: "Salvar atividade", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("button", { name: /Atividades/ })
    .click();
  await page
    .getByRole("textbox", { name: "Buscar atividade" })
    .fill("Validação automatizada");
  await page
    .getByRole("button", {
      name: "Validação automatizada do SecOps",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Validação automatizada do SecOps" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sugerir conteúdo para Azure DevOps" })
    .click();
  await expect(
    page.getByText("Conteúdo pronto para o card", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar tudo" })).toBeVisible();
  await page
    .getByPlaceholder("Registre uma atualização…")
    .fill("Comentário de verificação");
  await page.getByRole("button", { name: "Publicar comentário" }).click();
  await expect(
    page.getByText("Comentário de verificação", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});
test("quadro, relatórios e layout móvel", async ({ page }) => {
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Quadro Kanban" })
    .click();
  await expect(page.locator(".kanban-column")).toHaveCount(8);
  await expect(page.locator(".task")).toHaveCount(18);
  await page.locator("nav").getByRole("button", { name: "Relatórios" }).click();
  await expect(
    page.getByRole("heading", { name: "Vulnerabilidades", exact: true }),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).first().click();
  expect((await downloaded).suggestedFilename()).toBe("demo-open.csv");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator("nav")
    .getByRole("button", { name: "Visão geral" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
});
