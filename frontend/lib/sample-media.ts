/**
 * Shared client-side helpers for multimodal image upload testing (Postman #16 & #22).
 */

export const SAMPLE_DIAGNOSTIC_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Build a Pillow-valid PNG File for multipart /api/v1/telemetry/ingest uploads. */
export function createSampleDiagnosticPngFile(
  filename = "sample-diagnostic-scan.png",
): File {
  const binary = atob(SAMPLE_DIAGNOSTIC_PNG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: "image/png" });
}

/** Read a File as a raw base64 string (without data URL prefix) for JSON endpoints. */
export async function fileToRawBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
