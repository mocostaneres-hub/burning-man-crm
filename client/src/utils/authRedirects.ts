import type { User } from '../types';

type LandingAccount = Pick<
  User,
  | '_id'
  | 'accountType'
  | 'campId'
  | 'isCampLead'
  | 'campLeadCampId'
  | 'isEventsLead'
  | 'eventsLeadCampId'
  | 'isRosterMember'
>;

const toIdString = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof (value as { toString?: () => string }).toString === 'function') {
    const stringValue = (value as { toString: () => string }).toString();
    return stringValue === '[object Object]' ? '' : stringValue;
  }
  return '';
};

export const getCampRosterPath = (account?: Partial<LandingAccount> | null): string => {
  const campIdentifier =
    toIdString(account?.campId) ||
    (account?.isCampLead ? toIdString(account.campLeadCampId) : '') ||
    (account?.isEventsLead ? toIdString(account.eventsLeadCampId) : '') ||
    toIdString(account?.campLeadCampId) ||
    toIdString(account?.eventsLeadCampId) ||
    (account?.accountType === 'camp' ? toIdString(account?._id) : '');

  return campIdentifier ? `/camp/${campIdentifier}/roster` : '/dashboard';
};

export const getDefaultLandingPath = (account?: Partial<LandingAccount> | null): string => {
  if (
    account?.accountType === 'camp' ||
    account?.campId ||
    account?.isCampLead ||
    account?.campLeadCampId ||
    account?.isEventsLead ||
    account?.eventsLeadCampId
  ) {
    return getCampRosterPath(account);
  }

  if (account?.accountType === 'personal' && account?.isRosterMember) {
    return '/tasks';
  }

  return '/dashboard';
};

export const getSafeRedirectPath = (redirectPath?: string | null): string => {
  if (!redirectPath || !redirectPath.startsWith('/') || redirectPath.startsWith('//')) {
    return '/dashboard';
  }

  return redirectPath;
};

export const getOnboardingRedirectPath = (redirectPath?: string | null): string => {
  const safeRedirect = getSafeRedirectPath(redirectPath);
  return safeRedirect === '/dashboard'
    ? '/onboarding/select-role'
    : `/onboarding/select-role?redirect=${encodeURIComponent(safeRedirect)}`;
};

export const getMemberApplicationCampIdentifier = (redirectPath?: string | null): string | null => {
  const safeRedirect = getSafeRedirectPath(redirectPath);
  if (safeRedirect === '/dashboard') return null;

  try {
    const url = new URL(safeRedirect, 'https://g8road.local');
    if (url.searchParams.get('apply') !== '1') return null;

    const match = url.pathname.match(/^\/camps\/(?:public\/)?([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch (_error) {
    return null;
  }
};
