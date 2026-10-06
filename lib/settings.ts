import { supabaseAdmin } from "@/lib/supabase/server";
import type { PrintArea } from "@/lib/design";

export type ArtworkRules = {
  acceptedTypes: string[];
  maxFileSizeBytes: number;
  /** true when the owner has not supplied the real values yet (PRD §8). */
  isPlaceholder: boolean;
};

export type StudioSettings = {
  printArea: PrintArea;
  printAreaIsPlaceholder: boolean;
  artworkRules: ArtworkRules;
};

// Owner slots are empty (all null). These placeholders keep the studio usable
// and are flagged in the UI; nothing here is presented as the owner's real spec.
export const PLACEHOLDER_PRINT_AREA: PrintArea = {
  x: 110,
  y: 100,
  width: 300,
  height: 380,
};
export const PLACEHOLDER_ACCEPTED_TYPES = ["image/png", "image/jpeg"];
export const PLACEHOLDER_MAX_BYTES = 10 * 1024 * 1024;

type SettingsData = {
  print_areas?: { front?: PrintArea } | null;
  artwork_rules?: {
    accepted_types?: string[] | null;
    max_file_size_bytes?: number | null;
  } | null;
};

export async function getStudioSettings(): Promise<StudioSettings> {
  const { data, error } = await supabaseAdmin()
    .from("settings")
    .select("data")
    .eq("id", 1)
    .single();

  if (error) throw new Error(`Failed to load settings: ${error.message}`);

  const d = (data?.data ?? {}) as SettingsData;

  const ownerPrintArea = d.print_areas?.front ?? null;
  const accepted = d.artwork_rules?.accepted_types ?? null;
  const maxBytes = d.artwork_rules?.max_file_size_bytes ?? null;

  return {
    printArea: ownerPrintArea ?? PLACEHOLDER_PRINT_AREA,
    printAreaIsPlaceholder: ownerPrintArea === null,
    artworkRules: {
      acceptedTypes: accepted ?? PLACEHOLDER_ACCEPTED_TYPES,
      maxFileSizeBytes: maxBytes ?? PLACEHOLDER_MAX_BYTES,
      isPlaceholder: accepted === null || maxBytes === null,
    },
  };
}
