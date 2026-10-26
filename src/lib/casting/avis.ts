// Avis du·de la réal sur un profil du casting (lien réal).
export type Avis = "oui" | "peut_etre" | "non";

export const AVIS_LIBELLES: Record<Avis, string> = { oui: "Oui", peut_etre: "Peut-être", non: "Non" };

export type AvisReel = { nom: string; role: string; avis: Avis };
