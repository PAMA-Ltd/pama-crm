/**
 * Contact/Company/Deal links remain durable independent of workspace layout.
 * Hiding Sales fields is presentation-only; editing an activity may never erase
 * previously stored associations simply because their inputs are invisible.
 */
export function activityAssociationIds(form: {
  companyId: string;
  contactId: string;
  dealId: string;
}) {
  return {
    companyId: form.companyId === "none" ? undefined : form.companyId,
    contactId: form.contactId === "none" ? undefined : form.contactId,
    dealId: form.dealId === "none" ? undefined : form.dealId,
  };
}
