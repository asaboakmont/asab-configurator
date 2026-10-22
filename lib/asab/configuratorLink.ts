/** Save only the kitchen snapshot. Customer contact details do not belong in a share link. */
export async function createExportConfiguratorLink(config: Record<string, unknown>): Promise<string> {
  const response = await fetch("/api/config/save", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Configuratia nu a putut fi salvata pentru linkul din document.");
  if (typeof result.url !== "string" || !/^https?:\/\//.test(result.url)) throw new Error("Serviciul de salvare nu a returnat un link valid pentru configurator.");
  return result.url;
}
