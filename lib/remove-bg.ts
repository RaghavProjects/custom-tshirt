/**
 * Remove the background from an uploaded image, in the browser, with no API
 * key (the model runs locally via WASM). Returns a transparent PNG blob.
 */
export async function removeImageBackground(source: Blob): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  return removeBackground(source);
}
