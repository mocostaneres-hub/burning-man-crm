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
