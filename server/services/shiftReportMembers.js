const buildShiftMemberDetailMap = (users = []) => new Map(
  users
    .filter((user) => user?._id)
    .map((user) => [
      user._id.toString(),
      {
        id: user._id.toString(),
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      }
    ])
);

const getShiftMemberDetails = (memberIds = [], detailMap = new Map()) => (
  memberIds
    .map((memberId) => detailMap.get(memberId.toString()))
    .filter(Boolean)
);

module.exports = { buildShiftMemberDetailMap, getShiftMemberDetails };
