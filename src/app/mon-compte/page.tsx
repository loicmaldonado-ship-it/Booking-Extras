import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { MyProfileForm } from "@/components/auth/my-profile-form";

export default async function MonComptePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Mon profil</h1>
        <p className="mt-1 text-text-muted">Ta fiche membre, visible par le reste de l&apos;équipe.</p>
      </div>
      <MyProfileForm profile={profile} gate={profile.role === "chef" && !profile.profileComplete} />
    </div>
  );
}
