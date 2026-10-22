// pdf-parse v1 ships no types for the lib entry point. The lib entry is imported
// directly to avoid the debug harness in the package's index.js (it reads a
// bundled test PDF from disk and throws ENOENT in serverless).
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdfParse;
}
