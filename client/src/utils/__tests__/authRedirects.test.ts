import {
  getMemberApplicationCampIdentifier,
  getOnboardingRedirectPath,
  getSafeRedirectPath
} from '../authRedirects';

describe('authRedirects', () => {
  it('keeps internal redirect paths, including query strings', () => {
    expect(getSafeRedirectPath('/camps/mudskippers?apply=1')).toBe('/camps/mudskippers?apply=1');
  });

  it('falls back to dashboard for missing or external redirects', () => {
    expect(getSafeRedirectPath(null)).toBe('/dashboard');
    expect(getSafeRedirectPath('https://example.com')).toBe('/dashboard');
    expect(getSafeRedirectPath('//example.com')).toBe('/dashboard');
  });

  it('carries safe redirects through onboarding', () => {
    expect(getOnboardingRedirectPath('/camps/mudskippers?apply=1')).toBe(
      '/onboarding/select-role?redirect=%2Fcamps%2Fmudskippers%3Fapply%3D1'
    );
    expect(getOnboardingRedirectPath('/dashboard')).toBe('/onboarding/select-role');
  });

  it('detects camp application redirects', () => {
    expect(getMemberApplicationCampIdentifier('/camps/mudskippers?apply=1')).toBe('mudskippers');
    expect(getMemberApplicationCampIdentifier('/camps/public/mudskippers?apply=1')).toBe('mudskippers');
    expect(getMemberApplicationCampIdentifier('/camps/mudskippers')).toBeNull();
    expect(getMemberApplicationCampIdentifier('//example.com/camps/mudskippers?apply=1')).toBeNull();
  });
});
