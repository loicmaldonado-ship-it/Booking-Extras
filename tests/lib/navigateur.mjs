// Choix du moteur pour les tests navigateur : BROWSER=chromium (défaut) | webkit (moteur de Safari) | firefox.
// Accepte le certificat auto-signé du relais HTTPS local (scripts/https-local.mjs), nécessaire à WebKit qui n'envoie
// pas les cookies « Secure » sur http://localhost.
export function navigateur(pw, nom = process.env.BROWSER || "chromium") {
  const moteur = pw[nom];
  if (!moteur) throw new Error(`Navigateur inconnu : ${nom}`);
  return {
    name: () => nom,
    launch: async (options) => {
      const b = await moteur.launch(options);
      const ctx = b.newContext.bind(b), page = b.newPage.bind(b);
      // WebKit de test (Linux) se fige sur PushManager.getSubscription() quand un service worker est actif : on bloque
      // le service worker sous WebKit (les notifications push se testent sur un vrai iPhone, carte COM-03).
      const sw = nom === "webkit" ? { serviceWorkers: "block" } : {};
      b.newContext = (o = {}) => ctx({ ignoreHTTPSErrors: true, ...sw, ...o });
      b.newPage = (o = {}) => page({ ignoreHTTPSErrors: true, ...sw, ...o });
      return b;
    },
  };
}
