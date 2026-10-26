import { redirect } from "next/navigation";
import { getCurrentProjetId } from "@/lib/projet-context";
import { getCurrentProfile, requireProjetAccess } from "@/lib/auth/session";
import { hasSectionAccess } from "@/lib/auth/sections";
import { notFound } from "next/navigation";
export default async function MineursPage() {
 if (!hasSectionAccess(await getCurrentProfile(), "/mineurs")) notFound();
 const project = await getCurrentProjetId();
 if (!project) redirect("/projets");
 await requireProjetAccess(project);
 redirect(`/projets/${project}/mineurs`);
}
