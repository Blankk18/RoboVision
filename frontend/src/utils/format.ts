/**
 * Pad a part ID with leading zero to ensure 2-digit format (e.g. Part 03, P07).
 */
export const padPartId = (id: number | string): string => {
  return String(id).padStart(2, '0');
};
