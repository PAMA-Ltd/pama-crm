/**
 * Contact/Company/Deal links remain durable independent of workspace layout.
 * Hiding Sales fields is presentation-only; editing an activity may never erase
 * previously stored associations simply because their inputs are invisible.
 */
/**
 * The caller provides already organization-scoped contacts from useContacts().
 * In non-Sales layouts a hidden legacy company association must never filter
 * the visible contact choices. The saved company/deal relationships are separate.
 */
export function contactsForActivity<T extends { companyId?: string }>(
  contacts: readonly T[],
  companyId: string,
  salesEnabled: boolean,
): T[] {
  if (!salesEnabled || companyId === "none") return [...contacts];
  return contacts.filter(contact =>
    !contact.companyId || contact.companyId === companyId
  );
}

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
