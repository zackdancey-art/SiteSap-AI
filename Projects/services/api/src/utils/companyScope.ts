import { Response } from "express";

/**
 * Cross-company guard for fetch-then-mutate flows. If the resource belongs to a
 * different company than the caller, respond 404 (NOT 403) so we never confirm
 * the resource's existence to an outsider, then return false to signal the
 * caller to stop.
 */
export function assertSameCompany(
  resourceCompanyId: string,
  callerCompanyId: string,
  res: Response
): boolean {
  if (resourceCompanyId !== callerCompanyId) {
    res.status(404).json({ error: "Not found." });
    return false;
  }
  return true;
}
