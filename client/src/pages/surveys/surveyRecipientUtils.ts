type SurveyRecipient = {
  userId: string;
};

export const getSelectableSurveyRecipients = <T extends SurveyRecipient>(
  surveyStatus: 'draft' | 'sent' | 'closed',
  rosterUsers: T[],
  completedUserIds: string[] = []
): T[] => {
  if (surveyStatus !== 'sent') return rosterUsers;
  const completed = new Set(completedUserIds.map((userId) => String(userId)));
  return rosterUsers.filter((rosterUser) => !completed.has(String(rosterUser.userId)));
};
