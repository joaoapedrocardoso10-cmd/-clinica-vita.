export const PATIENT_PHONE_PATTERN = /^\d{10,13}$/;

export function normalizePatientPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 13);
}

export function isValidPatientPhone(value: string) {
  return PATIENT_PHONE_PATTERN.test(value);
}
