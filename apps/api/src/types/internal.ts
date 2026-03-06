import type { DocumentDTO } from "@vistra/shared";

// DocumentInternal is API-private — it MUST NOT be exported from @vistra/shared.
// It extends DocumentDTO by adding s3Key, which is an internal storage detail
// that must be stripped (via toDocumentDTO mapper) before sending to clients.
export interface DocumentInternal extends DocumentDTO {
  s3Key: string;
}
