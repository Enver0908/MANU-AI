import { createClient } from "@supabase/supabase-js";
import { buildApprovedSourceImportManifest } from "./phase-85-stage-4c-sources";

export async function importApprovedAiChatSources() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("supabase_service_role_required");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const manifest = buildApprovedSourceImportManifest();
  let processed = 0;

  for (const item of manifest) {
    const { error } = await supabase.rpc("p85_stage_4c_import_approved_source_v1", {
      p_external_source_id: item.externalSourceId,
      p_title: item.title,
      p_publisher: item.publisher,
      p_source_url: item.sourceUrl,
      p_publication_date: item.publicationDate,
      p_version_label: item.versionLabel,
      p_jurisdiction: item.jurisdiction,
      p_approval_status: item.approvalStatus,
      p_source_hash: item.sourceHash,
      p_review_due_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      p_chunks: item.chunks,
    });
    if (error) throw new Error(`${item.externalSourceId}:${error.message}`);
    processed += 1;
  }

  return {
    packVersion: manifest[0]?.packVersion ?? "unknown",
    sourceCount: manifest.length,
    processed,
    idempotent: true,
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  importApprovedAiChatSources()
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
