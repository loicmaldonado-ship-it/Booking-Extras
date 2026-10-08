import "server-only";
import { computeAge } from "@/lib/documents/fields";

// Profil candidat·e complet (contact, adresse, naissance, mensurations,
// véhicule), lu depuis un formulaire — mêmes règles que le formulaire de
// candidature. Utilisé par l'inscription sans annonce.

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type ProfilCandidat = {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  adresse: string;
  code_postal: string;
  commune_naissance: string;
  date_naissance: string;
  genre: string;
  pronom: string;
  taille_cm: number;
  poids_kg: number;
  pointure: number;
  veste: string;
  pantalon: string;
  a_vehicule: boolean;
  vehicule_voiture: boolean;
  vehicule_velo: boolean;
  vehicule_moto: boolean;
  vehicule_scooter: boolean;
  vehicule_marque: string | null;
};

export function lireProfil(fd: FormData): { profil: ProfilCandidat; age: number } | { error: string } {
  const prenom = str(fd, "prenom");
  const nom = str(fd, "nom");
  const email = str(fd, "email")?.toLowerCase() ?? null;
  const telephone = str(fd, "telephone");
  const ville = str(fd, "ville");
  const adresse = str(fd, "adresse");
  const codePostal = str(fd, "code_postal");
  const communeNaissance = str(fd, "commune_naissance");
  const dateNaissance = str(fd, "date_naissance");
  const genre = str(fd, "genre");
  const pronom = str(fd, "pronom");
  const tailleCm = num(fd, "taille_cm");
  const poidsKg = num(fd, "poids_kg");
  const pointure = num(fd, "pointure");
  const veste = str(fd, "veste");
  const pantalon = str(fd, "pantalon");
  const aVehiculeRaw = str(fd, "a_vehicule");
  const vehiculeMarque = str(fd, "vehicule_marque");
  const vehicule = {
    voiture: fd.get("vehicule_voiture") === "on",
    velo: fd.get("vehicule_velo") === "on",
    moto: fd.get("vehicule_moto") === "on",
    scooter: fd.get("vehicule_scooter") === "on",
  };

  if (!prenom || !nom || !email || !telephone || !ville) return { error: "Tous les champs de contact sont obligatoires." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Adresse email invalide." };
  if (!adresse || !codePostal) return { error: "L'adresse de résidence complète (rue et code postal) est obligatoire." };
  if (!dateNaissance) return { error: "La date de naissance est obligatoire." };
  if (!communeNaissance) return { error: "La commune de naissance est obligatoire." };
  if (!genre || !pronom) return { error: "Le genre et le pronom sont obligatoires." };
  if (!tailleCm || !poidsKg || !pointure) return { error: "Les mensurations (taille, poids, pointure) sont obligatoires." };
  if (pointure < 15 || pointure > 60) return { error: "La pointure doit être comprise entre 15 et 60." };
  if (!veste || !pantalon) return { error: "Les tailles de veste et de pantalon sont obligatoires." };
  if (aVehiculeRaw !== "oui" && aVehiculeRaw !== "non") return { error: "Merci d'indiquer si tu as un véhicule." };
  const aVehicule = aVehiculeRaw === "oui";
  if (aVehicule && !vehicule.voiture && !vehicule.velo && !vehicule.moto && !vehicule.scooter) {
    return { error: "Merci de préciser le type de véhicule (voiture, vélo, moto ou scooter)." };
  }
  if (aVehicule && !vehiculeMarque) return { error: "La marque du véhicule est obligatoire." };

  const age = computeAge(dateNaissance);
  if (age === null || age < 0 || age > 120) return { error: "Date de naissance invalide." };

  return {
    age,
    profil: {
      prenom,
      nom,
      email,
      telephone,
      ville,
      adresse,
      code_postal: codePostal,
      commune_naissance: communeNaissance,
      date_naissance: dateNaissance,
      genre,
      pronom,
      taille_cm: tailleCm,
      poids_kg: poidsKg,
      pointure,
      veste,
      pantalon,
      a_vehicule: aVehicule,
      vehicule_voiture: aVehicule && vehicule.voiture,
      vehicule_velo: aVehicule && vehicule.velo,
      vehicule_moto: aVehicule && vehicule.moto,
      vehicule_scooter: aVehicule && vehicule.scooter,
      vehicule_marque: aVehicule ? vehiculeMarque : null,
    },
  };
}

export const MOT_DE_PASSE_MIN = 8;

// Montre à qui appartient un compte sans révéler l'adresse :
// « l•••@gmail.com ».
export function emailMasque(email: string): string {
  const [local, domaine] = email.split("@");
  if (!domaine) return "•••";
  return `${local.slice(0, 1)}•••@${domaine}`;
}
