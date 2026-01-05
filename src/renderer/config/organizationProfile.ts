// D:\AttendancePro\src\renderer\config\organizationProfile.ts
// TEMPORARY organization profile for printed documents.
// This file will later be replaced or populated by the Settings module.

export const organizationProfile = {
  organizationName: 'AttendancePro Organization',
  organizationAddress: 'Address: ________________________________',
  organizationContacts: 'Tel: __________________ | Email: __________________',

  // Mandatory disclaimer for ALL formal printed documents
  disclaimerText:
    'This document is provided for informational purposes only. ' +
    'The organization accepts no responsibility or liability for any use, interpretation, ' +
    'or reliance placed on this document.',

  signatureLabel: 'Signature',
  stampLabel: 'Electronic Stamp (if available)',
} as const;
