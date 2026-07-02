import { CompanyRole, UserRole } from "../utils/authToken";

/**
 * The authenticated principal passed into every store call. Company scoping is
 * enforced on `companyId`; `companyRole` gates write/owner-only operations.
 * The legacy `role` is retained during the transition but no longer grants any
 * cross-company bypass.
 */
export type Actor = {
  email: string;
  role: UserRole;
  companyId: string;
  companyRole: CompanyRole;
};

/** Crew are the only company role scoped below the whole company. */
export function isCrew(actor: Actor): boolean {
  return actor.companyRole === "crew";
}
