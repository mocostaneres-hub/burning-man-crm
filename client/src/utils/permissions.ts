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

  // For camp accounts, the campId is stored in user.campId OR user._id
  // For admin accounts with camp affiliation, it's in user.campId
  const userCampId = user.campId?.toString() || (user.accountType === 'camp' ? user._id?.toString() : undefined);

  console.log('🔍 [isCampOwner] Checking:', {
    userAccountType: user.accountType,
    userCampId: user.campId,
    userId: user._id,
    derivedUserCampId: userCampId,
    targetCampId: campId,
    match: userCampId === campId
  });

  // Camp owner - compare derived campId
  if (user.accountType === 'camp' && userCampId === campId) {
    console.log('✅ [isCampOwner] User is camp owner');
    return true;
  }

  // Admin with camp affiliation
  if (user.accountType === 'admin' && user.campId && user.campId.toString() === campId) {
    console.log('✅ [isCampOwner] User is camp-affiliated admin');
    return true;
  }

  // System admin (can act as owner for any camp)
  if (user.accountType === 'admin' && !user.campId) {
    console.log('✅ [isCampOwner] User is system admin');
    return true;
  }

  console.log('❌ [isCampOwner] User is not camp owner');
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
  if (!user || !campId) {
    console.log('🔍 [canAssignCampLeadRole] Missing user or campId:', { user: !!user, campId });
    return false;
  }

  console.log('🔍 [canAssignCampLeadRole] Checking:', {
    userAccountType: user.accountType,
    userCampId: user.campId,
    targetCampId: campId,
    match: user.campId === campId,
    userCampIdType: typeof user.campId,
    targetCampIdType: typeof campId
  });

  // Only camp owners can assign roles
  const result = isCampOwner(user, campId);
  console.log('🔍 [canAssignCampLeadRole] Result:', result);
  return result;
}
