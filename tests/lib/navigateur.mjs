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
      b.newContext = (o = {}) => ctx({ ignoreHTTPSErrors: true, ...o });
      b.newPage = (o = {}) => page({ ignoreHTTPSErrors: true, ...o });
      return b;
    },
  };
}
