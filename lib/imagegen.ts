export const IMAGE_GEN_DISABLED_MESSAGE =
  "AI design generation is not configured yet. Add an image-provider key to enable it.";

/** Whether a text-to-image provider key is present on the server. */
export function isImageGenConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
