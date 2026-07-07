const { findCampByIdentifier } = require('./campIdentifier');

const resolveMemberApplicationSignup = async (db, signupIntent, applicationCampIdentifier) => {
  if (signupIntent !== 'member_application') {
    return { isMemberApplicationSignup: false, camp: null, error: null };
  }

  const identifier = typeof applicationCampIdentifier === 'string'
    ? applicationCampIdentifier.trim()
    : '';
  if (!identifier) {
    return {
      isMemberApplicationSignup: false,
      camp: null,
      error: { status: 400, message: 'Camp application link is missing camp details' }
    };
  }

  const camp = await findCampByIdentifier(db, identifier);
  if (!camp) {
    return {
      isMemberApplicationSignup: false,
      camp: null,
      error: { status: 400, message: 'Camp application link is invalid' }
    };
  }

  const isPubliclyVisible = camp.isPubliclyVisible !== undefined
    ? camp.isPubliclyVisible
    : camp.isPublic === true;
  if (!isPubliclyVisible) {
    return {
      isMemberApplicationSignup: false,
      camp,
      error: { status: 400, message: 'This camp profile is not publicly visible' }
    };
  }

  const acceptingApplications = camp.acceptingApplications !== undefined
    ? camp.acceptingApplications
    : true;
  if (!acceptingApplications) {
    return {
      isMemberApplicationSignup: false,
      camp,
      error: { status: 400, message: 'This camp is not currently accepting new members' }
    };
  }

  return { isMemberApplicationSignup: true, camp, error: null };
};

module.exports = { resolveMemberApplicationSignup };
