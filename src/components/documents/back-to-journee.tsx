import Link from "next/link";

export function BackToJournee({ projetId, date }: { projetId: string; date: string }) {
  return (
    <Link
      href={`/bookings/documents?projet_id=${projetId}&date=${date}`}
      className="print-hide inline-flex items-center gap-1 text-sm text-text-muted hover:text-coral"
    >
      ← Retour à la journée
    </Link>
  );
}
