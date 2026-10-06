/**
 * Pure helper: builds the studio URL for a chosen product/colour/size.
 * No server imports, so it is safe in client components and unit tests.
 */
export function buildStudioUrl(
  productId: string,
  colorHex: string,
  sizeLabel: string,
): string {
  const params = new URLSearchParams({
    product: productId,
    color: colorHex,
    size: sizeLabel,
  });
  return `/studio?${params.toString()}`;
}
