// CSP complète (02/11/2026), vérifiée dans le navigateur : un gestionnaire d'événement injecté et eval sont bloqués,
// tous les scripts de la page portent le nonce, et la conversion HEIC (WebAssembly dans un worker blob:) reste possible.
// Usage : node tests/csp-navigateur.mjs   (appli sur :3000)
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const BASE = process.env.BASE || "http://localhost:3000";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const navigateur = (await import("./lib/navigateur.mjs")).navigateur(pw, process.env.BROWSER || "chromium");
const b = await navigateur.launch();
try {
  for (const chemin of ["/login", "/compte/inscription"]) {
    const p = await b.newPage();
    const erreurs = [];
    p.on("pageerror", (e) => erreurs.push(e.message));
    await p.goto(BASE + chemin, { waitUntil: "networkidle" });
    const r = await p.evaluate(async () => {
      const out = {};
      const code = `onmessage=async()=>{try{await WebAssembly.instantiate(new Uint8Array([0,97,115,109,1,0,0,0]));postMessage("wasm-ok")}catch(e){postMessage("wasm-ko")}}`;
      const w = new Worker(URL.createObjectURL(new Blob([code], { type: "application/javascript" })));
      out.wasm = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = () => res("worker-ko"); w.postMessage(1); setTimeout(() => res("timeout"), 5000); });
      try { new Function("return 1")(); out.eval = "autorisé"; } catch { out.eval = "bloqué"; }
      const d = document.createElement("div"); d.innerHTML = '<img src="/x-inexistant.png" onerror="window.__xss=1">'; document.body.appendChild(d);
      await new Promise((r) => setTimeout(r, 800));
      out.inline = window.__xss ? "exécuté" : "bloqué";
      out.sansNonce = [...document.querySelectorAll("script")].filter((s) => !s.nonce && !s.src.startsWith("blob:")).length;
      return out;
    });
    assert.deepEqual(r, { wasm: "wasm-ok", eval: "bloqué", inline: "bloqué", sansNonce: 0 }, `${chemin} : ${JSON.stringify(r)}`);
    assert.deepEqual(erreurs, [], `${chemin} : erreurs JS ${erreurs.join(" | ")}`);
    await p.close();
  }
  console.log("PASS: CSP — scripts au nonce, gestionnaires injectés et eval bloqués, WebAssembly en worker autorisé.");
} finally {
  await b.close();
}
