import {
  getCampRosterPath,
  getDefaultLandingPath,
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

  it('routes camp admins and delegated leads to their current camp roster by default', () => {
    expect(getDefaultLandingPath({ _id: 'camp-1', accountType: 'camp' } as any)).toBe('/camp/camp-1/roster');
    expect(getDefaultLandingPath({ _id: 'admin-1', accountType: 'admin', campId: 'camp-2' } as any)).toBe('/camp/camp-2/roster');
    expect(getDefaultLandingPath({
      _id: 'member-1',
      accountType: 'personal',
      isCampLead: true,
      campLeadCampId: 'camp-3'
    } as any)).toBe('/camp/camp-3/roster');
    expect(getDefaultLandingPath({
      _id: 'member-2',
      accountType: 'personal',
      isEventsLead: true,
      eventsLeadCampId: 'camp-4'
    } as any)).toBe('/camp/camp-4/roster');
  });

  it('leaves ordinary member default routing unchanged', () => {
    expect(getDefaultLandingPath({ _id: 'member-3', accountType: 'personal' } as any)).toBe('/dashboard');
    expect(getCampRosterPath(null)).toBe('/dashboard');
  });
});
