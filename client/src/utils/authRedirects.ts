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
