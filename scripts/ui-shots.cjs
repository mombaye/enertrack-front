// Captures d'écran automatiques de « Suivis Consommations » (utile pour comparer avant/après). Prérequis : ui-demo.sh lancé + `npx playwright install chromium`.
//   node scripts/ui-shots.cjs [dossier_sortie]   (Playwright : `npm i --no-save playwright && npx playwright install chromium`, rien n'est ajouté à package.json)
const { chromium } = require("playwright");
const { mkdirSync } = require("node:fs");

const out = process.argv[2] ?? "captures-ui";
mkdirSync(out, { recursive: true });
const API = process.env.API_URL ?? "http://localhost:8000", WEB = process.env.WEB_URL ?? "http://localhost:5173";
(async () => {
const login = await (await fetch(`${API}/api/auth/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "demo", password: "demo-egrid-123" }) })).json();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([a, r]) => { localStorage.setItem("enertrack_access", a); localStorage.setItem("enertrack_refresh", r); }, [login.access, login.refresh]);
const page = await ctx.newPage();
await page.goto(`${WEB}/modules/suivi-carburant/consommations`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/01_page_complete.png`, fullPage: true });
await page.getByRole("button", { name: /Voir le détail/ }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/02_detail_site.png` });
await browser.close();
console.log(`Captures dans ${out}/`);
})();
