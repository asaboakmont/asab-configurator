export const MAX_GLB_BYTES = 50 * 1024 * 1024;
/** Only self-contained GLB v2 assets; external resources would break portability. */
export function validateGLB(buffer: ArrayBuffer): void {
  if (buffer.byteLength < 20 || buffer.byteLength > MAX_GLB_BYTES) throw new Error("GLB invalid sau mai mare de 50 MB.");
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error("Fisierul nu este un GLB v2 valid.");
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || length > buffer.byteLength - 20) throw new Error("GLB: structura JSON invalida.");
  const data = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)).trim());
  if (data.asset?.version !== "2.0" || !Array.isArray(data.meshes) || !data.meshes.length) throw new Error("GLB trebuie sa contina cel putin un mesh.");
  for (const item of [...(data.buffers ?? []), ...(data.images ?? [])]) {
    if (item.uri && !String(item.uri).startsWith("data:")) throw new Error("Exportati GLB cu texturi si date incluse, fara fisiere externe.");
  }
  if ((data.extensionsRequired ?? []).some((name: string) => ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"].includes(name))) throw new Error("Reexportati GLB fara compresie Draco/Meshopt/KTX2.");
}
