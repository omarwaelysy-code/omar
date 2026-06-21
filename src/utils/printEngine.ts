/**
 * Unified Print Engine for the ERP System
 * Triggers a global print request for any document type and ID
 */
export function printDocument(
  operationType: string,
  documentId: string,
  templateId?: string,
  profileId?: string
) {
  const event = new CustomEvent('erp-print-document', {
    detail: { operationType, documentId, templateId, profileId }
  });
  window.dispatchEvent(event);
}
