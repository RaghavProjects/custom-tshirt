import type { ArtworkRules } from "@/lib/settings";

export type UploadCheck = { ok: true } | { ok: false; reason: string };

export function validateArtwork(
  file: { type: string; size: number },
  rules: ArtworkRules,
): UploadCheck {
  if (!file.type) {
    return { ok: false, reason: "The file has no type." };
  }
  if (!rules.acceptedTypes.includes(file.type)) {
    return {
      ok: false,
      reason: `Unsupported file type "${file.type}". Allowed: ${rules.acceptedTypes.join(", ")}.`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "The file is empty." };
  }
  if (file.size > rules.maxFileSizeBytes) {
    const mb = (rules.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, reason: `File is larger than the ${mb} MB limit.` };
  }
  return { ok: true };
}
