import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { validatePdfUpload } from "@/lib/media/validate-upload";

export const dynamic = "force-dynamic";

// The bucket is private: never expose a public Storage URL or trust a path
// supplied by the browser. Resolve the role on the server, then check access
// to its project before downloading the associated file.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId)) {
    return new Response("Document introuvable.", { status: 404 });
  }

  if (!(await getCurrentProfile())) {
    return new Response("Document introuvable.", { status: 404 });
  }

  const supabase = createAdminClient();
  const { data: role, error: roleError } = await supabase
    .from("casting_roles")
    .select("projet_id, pdf_storage_path")
    .eq("id", roleId)
    .maybeSingle();
  if (roleError || !role || !role.pdf_storage_path) {
    return new Response("Document introuvable.", { status: 404 });
  }

  if (await checkProjetAccess(role.projet_id)) {
    // Do not reveal the existence of another team's casting role.
    return new Response("Document introuvable.", { status: 404 });
  }

  // Uploaded role PDFs use the pattern roleId/randomUUID.pdf.
  // Reject inconsistent paths rather than allowing a role to reference any
  // object in the service-role client's private bucket.
  if (!role.pdf_storage_path.startsWith(`${roleId}/`) || !role.pdf_storage_path.endsWith(".pdf")) {
    return new Response("Document indisponible.", { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("casting-role-documents")
    .download(role.pdf_storage_path);
  if (error || !data) {
    return new Response("Impossible d'ouvrir le document.", { status: 404 });
  }

  return new Response(new Uint8Array(await data.arrayBuffer()), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="document-role.pdf"',
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}


/** Separate upload from role creation: a multipart Server Action combining
 * creation + PDF could fail with "Unexpected end of form". Restrict this
 * endpoint to staff with access to the role's project. */
export async function POST(request: Request, { params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId)) {
    return Response.json({ error: "Rôle introuvable." }, { status: 404 });
  }
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
      return Response.json({ error: "Origine non autorisée." }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 21 * 1024 * 1024) {
    return Response.json({ error: "PDF trop volumineux (20 Mo maximum)." }, { status: 413 });
  }
  if (!(await getCurrentProfile())) {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }
  const supabase = createAdminClient();
  const { data: role, error: roleError } = await supabase.from("casting_roles")
    .select("projet_id, pdf_storage_path").eq("id", roleId).maybeSingle();
  if (roleError || !role || await checkProjetAccess(role.projet_id)) {
    return Response.json({ error: "Rôle introuvable." }, { status: 404 });
  }
  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return Response.json({ error: "Le PDF n'a pas pu être reçu. Réessaie." }, { status: 400 });
  }
  const pdf = body.get("pdf");
  if (!(pdf instanceof File)) {
    return Response.json({ error: "Choisis un PDF." }, { status: 400 });
  }
  const validation = await validatePdfUpload(pdf);
  if (validation.error) return Response.json({ error: validation.error }, { status: 400 });

  const path = `${roleId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage.from("casting-role-documents")
    .upload(path, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) return Response.json({ error: "Impossible d'enregistrer le PDF." }, { status: 500 });

  const { error: updateError } = await supabase.from("casting_roles")
    .update({ pdf_storage_path: path, pdf_filename: pdf.name.slice(0, 200) }).eq("id", roleId);
  if (updateError) {
    await supabase.storage.from("casting-role-documents").remove([path]);
    return Response.json({ error: "Le PDF n'a pas pu être associé au rôle." }, { status: 500 });
  }
  if (role.pdf_storage_path && role.pdf_storage_path.startsWith(`${roleId}/`)) {
    await supabase.storage.from("casting-role-documents").remove([role.pdf_storage_path]);
  }
  return Response.json({ success: true });
}
