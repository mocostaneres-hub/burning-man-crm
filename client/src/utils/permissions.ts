// Permission utility functions for Camp Lead role

import { User } from '../types';

/**
 * Check if user can manage a camp (owner, admin, or Camp Lead)
 * @param user - Current authenticated user
 * @param campId - Camp ID to check
 * @param campLeadFor - Optional array of camp IDs where user is Camp Lead
 * @returns boolean
 */
export function canManageCamp(
  user: User | null,
  campId: string | undefined,
  campLeadFor?: string[]
): boolean {
  if (!user || !campId) return false;

  // Camp owner
  if (user.accountType === 'camp' && user.campId === campId) {
    return true;
  }

  // System admin (no specific camp)
  if (user.accountType === 'admin' && !user.campId) {
    return true;
  }

  // Camp-affiliated admin
  if (user.accountType === 'admin' && user.campId === campId) {
    return true;
  }

  // Camp Lead for this specific camp
  if (campLeadFor && campLeadFor.includes(campId)) {
    return true;
  }

  return false;
}

/**
 * Check if user is the Main Camp Admin (owner)
 * Camp Leads have limited permissions compared to Main Admin
 * @param user - Current authenticated user
 * @param campId - Camp ID to check
 * @returns boolean
 */
export function isCampOwner(user: User | null, campId: string | undefined): boolean {
  if (!user || !campId) return false;

  // Camp owner
  if (user.accountType === 'camp' && user.campId === campId) {
    return true;
  }

  // System admin (can act as owner)
  if (user.accountType === 'admin' && !user.campId) {
    return true;
  }

  return false;
}

/**
 * Check if user is a Camp Lead (but not Main Admin)
 * Used to show/hide Camp Lead-specific UI
 * @param user - Current authenticated user
 * @param campId - Camp ID to check
 * @param campLeadFor - Array of camp IDs where user is Camp Lead
 * @returns boolean
 */
export function isCampLead(
  user: User | null,
  campId: string | undefined,
  campLeadFor: string[]
): boolean {
  if (!user || !campId || !campLeadFor) return false;

  // Must NOT be the Main Admin
  const isOwner = isCampOwner(user, campId);
  if (isOwner) return false;

  // Check if user is Camp Lead for this camp
  return campLeadFor.includes(campId);
}

/**
 * Check if user can assign Camp Lead roles
 * Only Main Camp Admin can assign/revoke Camp Lead roles
 * @param user - Current authenticated user
 * @param campId - Camp ID to check
 * @returns boolean
 */
export function canAssignCampLeadRole(user: User | null, campId: string | undefined): boolean {
  // Only camp owners can assign roles
  return isCampOwner(user, campId);
}
