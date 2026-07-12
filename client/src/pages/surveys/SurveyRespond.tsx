import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Badge, Button, Card } from '../../components/ui';
import { Survey, SurveyQuestion } from '../../types';
import { CheckCircle, Search, UserPlus, X } from 'lucide-react';

type EligibleMember = {
  memberId: string;
  name: string;
  email?: string;
  alreadyCovered: boolean;
  eligible: boolean;
  coveredByResponseId?: string | null;
};

type PeopleAnswerValue = {
  memberId: string;
  name: string;
};

type SurveyAnswerValue = string | number | string[] | PeopleAnswerValue[] | null;

type SurveyResponseAnswer = {
  questionId?: string | { _id?: string };
  blockType?: SurveyQuestion['blockType'];
  value?: unknown;
  valueType?: string;
};

type CoveredSurveyResponse = {
  _id?: string;
  answers?: SurveyResponseAnswer[];
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SubmissionConfirmation = {
  responseId: string;
  submitterEmail?: string;
  delegatedMemberNames: string[];
};

type SurveySection = {
  id: string;
  title: string;
  description: string;
  defaultNextSectionId: string;
  questions: SurveyQuestion[];
};

const SUBMIT_TARGET = '__SUBMIT__';

const getQuestionKey = (question: SurveyQuestion): string =>
  question._id || question.localId || String(question.order);

const answerableBlockTypes = new Set([
  'short_answer',
  'paragraph',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'linear_scale',
  'people',
  'date',
  'time'
]);

const sanitizeRichTextHtml = (value: string): string =>
  String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');

const stripHtmlToText = (value: string): string =>
  sanitizeRichTextHtml(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getAnswerQuestionKey = (answer: SurveyResponseAnswer): string => {
  const questionId = answer.questionId;
  if (!questionId) return '';
  if (typeof questionId === 'object') return String(questionId._id || '');
  return String(questionId);
};

const formatObjectValue = (value: Record<string, unknown>): string => {
  const preferred = value.name || value.label || value.title || value.value;
  if (preferred !== undefined && preferred !== null && typeof preferred !== 'object') {
    return String(preferred);
  }
  return JSON.stringify(value);
};

const formatPeopleValue = (value: unknown): string => {
  const formatPerson = (item: unknown): string => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'object') {
      const person = item as Record<string, unknown>;
      const name = person.name || person.label || person.title;
      return name ? String(name) : 'Selected person';
    }
    return String(item);
  };

  if (Array.isArray(value)) {
    const names = value.map(formatPerson).filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'No answer';
  }

  const person = formatPerson(value);
  return person || 'No answer';
};

const formatAnswerValue = (value: unknown, blockType?: SurveyQuestion['blockType']): string => {
  if (blockType === 'people') return formatPeopleValue(value);
  if (value === null || value === undefined || value === '') return 'No answer';

  if (Array.isArray(value)) {
    if (value.length === 0) return 'No answer';
    return value
      .map((item) => {
        if (item === null || item === undefined || item === '') return '';
        if (typeof item === 'object') return formatObjectValue(item as Record<string, unknown>);
        return String(item);
      })
      .filter(Boolean)
      .join(', ') || 'No answer';
  }

  if (typeof value === 'object') {
    return formatObjectValue(value as Record<string, unknown>);
  }

  return String(value);
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const formatNameList = (names: string[]): string => {
  const cleanNames = names.map((name) => name.trim()).filter(Boolean);
  if (cleanNames.length === 0) return '';
  if (cleanNames.length === 1) return cleanNames[0];
  if (cleanNames.length === 2) return `${cleanNames[0]} and ${cleanNames[1]}`;
  return `${cleanNames.slice(0, -1).join(', ')}, and ${cleanNames[cleanNames.length - 1]}`;
};

const buildSelfPeopleAnswers = (
  surveyQuestions: SurveyQuestion[],
  submitterMember: EligibleMember | undefined
): Record<string, SurveyAnswerValue> => {
  if (!submitterMember) return {};
  return surveyQuestions
    .filter((question) => question.blockType === 'people')
    .reduce<Record<string, SurveyAnswerValue>>((nextAnswers, question) => {
      nextAnswers[getQuestionKey(question)] = [
        {
          memberId: submitterMember.memberId,
          name: submitterMember.name
        }
      ];
      return nextAnswers;
    }, {});
};

const SurveyRespond: React.FC = () => {
  const navigate = useNavigate();
  const { surveyId } = useParams<{ surveyId: string }>();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionConfirmation, setSubmissionConfirmation] = useState<SubmissionConfirmation | null>(null);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [viewer, setViewer] = useState<any>(null);

  const [eligibleMembers, setEligibleMembers] = useState<EligibleMember[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, SurveyAnswerValue>>({});
  const [peopleQueryByQuestion, setPeopleQueryByQuestion] = useState<Record<string, string>>({});
  const [currentSectionId, setCurrentSectionId] = useState<string>('');
  const [sectionHistory, setSectionHistory] = useState<string[]>([]);
  const isViewMode = searchParams.get('mode') === 'view' || searchParams.get('view') === '1';

  const loadSurvey = useCallback(async () => {
    if (!surveyId) return;
    try {
      setLoading(true);
      setError(null);
      setSubmissionConfirmation(null);
      const detail = await api.getSurveyDetails(surveyId);
      const nextQuestions = (detail.questions || []).map((question: SurveyQuestion, index: number) => ({
        ...question,
        order: index,
        localId: question.localId || `${question.blockType === 'section_header' ? 'section' : 'question'}_${index + 1}`
      }));
      setSurvey(detail.survey);
      setQuestions(nextQuestions);
      setViewer(detail.viewer || {});
      setAnswersByQuestion({});
      setCurrentSectionId('');
      setSectionHistory([]);

      if (detail.viewer?.canRespond || isViewMode) {
        try {
          const eligible = await api.getSurveyEligibleMembers(surveyId);
          setEligibleMembers(eligible.eligibleMembers || []);
          const selfId = eligible.submitterMemberId;
          setSelectedMemberIds(selfId ? [selfId] : []);
          const submitterMember =
            eligible.submitterMember ||
            (eligible.eligibleMembers || []).find((member: EligibleMember) => member.memberId === selfId);
          setAnswersByQuestion(buildSelfPeopleAnswers(nextQuestions, submitterMember));
        } catch (_eligibleError) {
          if (isViewMode && detail.survey?.campId) {
            const membersResponse = await api.getCampMembers(detail.survey.campId);
            const previewMembers = (membersResponse.members || [])
              .map((member: any) => {
                const userDoc = member.user;
                if (!userDoc || !userDoc._id) return null;
                const fullName = `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || userDoc.email || 'Member';
                return {
                  memberId: member._id || userDoc._id,
                  name: fullName,
                  email: userDoc.email,
                  alreadyCovered: false,
                  eligible: true,
                  coveredByResponseId: null
                };
              })
              .filter(Boolean) as EligibleMember[];
            setEligibleMembers(previewMembers);
            setSelectedMemberIds([]);
            setAnswersByQuestion({});
          }
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  }, [surveyId, isViewMode]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  const selectedMembers = useMemo(
    () =>
      selectedMemberIds
        .map((id) => eligibleMembers.find((member) => member.memberId === id))
        .filter(Boolean) as EligibleMember[],
    [eligibleMembers, selectedMemberIds]
  );

  const visibleSuggestions = useMemo(
    () =>
      eligibleMembers.filter(
        (member) =>
          member.eligible &&
          !selectedMemberIds.includes(member.memberId) &&
          (!memberQuery.trim() ||
            `${member.name} ${member.email || ''}`.toLowerCase().includes(memberQuery.toLowerCase()))
      ),
    [eligibleMembers, selectedMemberIds, memberQuery]
  );

  const sections = useMemo<SurveySection[]>(() => {
    const grouped: SurveySection[] = [];
    let current: SurveySection = {
      id: 'intro',
      title: survey?.title || 'Survey',
      description: '',
      defaultNextSectionId: '',
      questions: []
    };

    for (const question of questions) {
      if (question.blockType === 'section_header') {
        if (current.questions.length > 0 || current.id !== 'intro') {
          grouped.push(current);
        }
        current = {
          id: question.localId || `section_${grouped.length + 1}`,
          title: question.prompt || `Section ${grouped.length + 1}`,
          description: question.helpText || '',
          defaultNextSectionId: question.navigation?.defaultNextSectionId || '',
          questions: []
        };
      } else {
        current.questions.push(question);
      }
    }

    if (current.questions.length > 0 || grouped.length === 0 || current.id !== 'intro') {
      grouped.push(current);
    }

    return grouped;
  }, [questions, survey?.title]);

  useEffect(() => {
    if (sections.length === 0) return;
    setCurrentSectionId((prev) => {
      if (prev && sections.some((section) => section.id === prev)) return prev;
      return sections[0].id;
    });
  }, [sections]);

  const currentSection = useMemo(
    () => sections.find((section) => section.id === currentSectionId) || sections[0],
    [currentSectionId, sections]
  );

  const coveredResponse = viewer?.coveredResponse as CoveredSurveyResponse | undefined;
  const coveredAnswerByQuestionKey = useMemo(() => {
    const next = new Map<string, SurveyResponseAnswer>();
    (coveredResponse?.answers || []).forEach((answer) => {
      const answerKey = getAnswerQuestionKey(answer);
      if (answerKey) next.set(answerKey, answer);
    });
    return next;
  }, [coveredResponse]);

  const getCoveredAnswerText = (question: SurveyQuestion): string => {
    const answer = coveredAnswerByQuestionKey.get(getQuestionKey(question));
    if (!answer) return 'No answer';
    return formatAnswerValue(answer.value, answer.blockType || question.blockType);
  };

  const setAnswer = (questionKey: string, value: SurveyAnswerValue) => {
    setAnswersByQuestion((prev) => ({ ...prev, [questionKey]: value }));
  };

  const toggleCheckboxOption = (questionKey: string, optionValue: string) => {
    setAnswersByQuestion((prev) => {
      const current = Array.isArray(prev[questionKey]) ? [...(prev[questionKey] as string[])] : [];
      const exists = current.includes(optionValue);
      return {
        ...prev,
        [questionKey]: exists ? current.filter((item) => item !== optionValue) : [...current, optionValue]
      };
    });
  };

  const getPeopleAnswer = (questionKey: string): PeopleAnswerValue[] => {
    const value = answersByQuestion[questionKey];
    if (!Array.isArray(value)) return [];
    return (value as unknown[]).filter(
      (item): item is PeopleAnswerValue =>
        typeof item === 'object' && item !== null && 'memberId' in item
    );
  };

  const responseCopyDelegateNames = useMemo(() => {
    const memberById = new Map(eligibleMembers.map((member) => [member.memberId, member]));
    const delegateIds = new Set(
      selectedMemberIds.filter((memberId) => memberId !== viewer?.submitterMemberId)
    );
    const reachedSectionIds = new Set([...sectionHistory, currentSection?.id].filter(Boolean));
    sections
      .filter((section) => reachedSectionIds.has(section.id))
      .flatMap((section) => section.questions)
      .filter((question) => question.blockType === 'people')
      .forEach((question) => {
        const value = answersByQuestion[getQuestionKey(question)];
        const peopleAnswers = Array.isArray(value)
          ? (value as unknown[]).filter(
              (item): item is PeopleAnswerValue =>
                typeof item === 'object' && item !== null && 'memberId' in item
            )
          : [];
        peopleAnswers.forEach((member) => {
          if (member.memberId !== viewer?.submitterMemberId) {
            delegateIds.add(member.memberId);
          }
        });
      });

    return Array.from(delegateIds)
      .map((memberId) => memberById.get(memberId)?.name)
      .filter(Boolean) as string[];
  }, [answersByQuestion, currentSection?.id, eligibleMembers, sectionHistory, sections, selectedMemberIds, viewer?.submitterMemberId]);

  const getPeopleSuggestions = (questionKey: string) => {
    const query = String(peopleQueryByQuestion[questionKey] || '').trim().toLowerCase();
    const selectedIds = new Set(getPeopleAnswer(questionKey).map((member) => member.memberId));
    if (!query) return [];
    return eligibleMembers.filter((member) => {
      const searchable = member.name.toLowerCase();
      return searchable.includes(query) && !selectedIds.has(member.memberId);
    });
  };

  const addPeopleAnswer = (questionKey: string, member: EligibleMember) => {
    if (!member.eligible) return;
    setAnswersByQuestion((prev) => {
      const current = Array.isArray(prev[questionKey])
        ? (prev[questionKey] as PeopleAnswerValue[]).filter((item) => typeof item === 'object' && item !== null)
        : [];
      if (current.some((item) => item.memberId === member.memberId)) return prev;
      return {
        ...prev,
        [questionKey]: [...current, { memberId: member.memberId, name: member.name }]
      };
    });
    setPeopleQueryByQuestion((prev) => ({ ...prev, [questionKey]: '' }));
  };

  const removePeopleAnswer = (questionKey: string, memberId: string) => {
    setAnswersByQuestion((prev) => ({
      ...prev,
      [questionKey]: getPeopleAnswer(questionKey).filter((member) => member.memberId !== memberId)
    }));
  };

  const addMember = (member: EligibleMember) => {
    setSelectedMemberIds((prev) => (prev.includes(member.memberId) ? prev : [...prev, member.memberId]));
    setMemberQuery('');
  };

  const removeMember = (memberId: string) => {
    if (!isViewMode && memberId === viewer?.submitterMemberId) return;
    setSelectedMemberIds((prev) => prev.filter((id) => id !== memberId));
  };

  const getReachedSectionIds = (activeSectionId?: string) =>
    new Set([...sectionHistory, activeSectionId || currentSection?.id].filter(Boolean));

  const getSubmittableQuestions = () => {
    const reachedSectionIds = getReachedSectionIds();
    return sections
      .filter((section) => reachedSectionIds.has(section.id))
      .flatMap((section) => section.questions)
      .filter((question) => answerableBlockTypes.has(question.blockType));
  };

  const validateQuestions = (questionsToValidate: SurveyQuestion[]) => {
    if (!survey || (!viewer?.canRespond && !isViewMode)) return false;
    if (!isViewMode && !selectedMemberIds.includes(viewer?.submitterMemberId)) {
      setError('Your own roster profile must remain selected.');
      return false;
    }
    for (const question of questionsToValidate) {
      const key = getQuestionKey(question);
      if (!question.required || !answerableBlockTypes.has(question.blockType)) continue;
      const value = answersByQuestion[key];
      if (Array.isArray(value)) {
        if (value.length === 0) {
          setError(`"${question.prompt}" is required.`);
          return false;
        }
      } else if (value === null || value === undefined || String(value).trim() === '') {
        setError(`"${question.prompt}" is required.`);
        return false;
      }
    }
    return true;
  };

  const validateBeforeSubmit = () => validateQuestions(getSubmittableQuestions());

  const getSectionRouteTarget = (section: SurveySection | undefined) => {
    if (!section) return '';
    for (const question of section.questions) {
      if (question.blockType !== 'multiple_choice' && question.blockType !== 'dropdown') continue;
      const value = answersByQuestion[getQuestionKey(question)];
      if (!value || Array.isArray(value)) continue;
      const matchedOption = (question.options || []).find((option) => option.value === String(value));
      if (matchedOption?.nextSectionId) {
        return matchedOption.nextSectionId;
      }
    }
    return '';
  };

  const getDefaultNextSectionId = (section: SurveySection | undefined) => {
    if (!section) return null;
    const currentIndex = sections.findIndex((item) => item.id === section.id);
    return currentIndex >= 0 ? sections[currentIndex + 1]?.id || null : null;
  };

  const getResolvedNextSectionId = (section: SurveySection | undefined) => {
    const target = getSectionRouteTarget(section);
    if (target === SUBMIT_TARGET) return null;
    if (target && target !== section?.id && sections.some((item) => item.id === target)) return target;
    const defaultTarget = section?.defaultNextSectionId || '';
    if (defaultTarget === SUBMIT_TARGET) return null;
    if (defaultTarget && defaultTarget !== section?.id && sections.some((item) => item.id === defaultTarget)) {
      return defaultTarget;
    }
    return getDefaultNextSectionId(section);
  };

  const goToPreviousSection = () => {
    setSectionHistory((prev) => {
      const nextHistory = [...prev];
      const previousSectionId = nextHistory.pop();
      if (previousSectionId) {
        setCurrentSectionId(previousSectionId);
      }
      return nextHistory;
    });
  };

  const goToNextSection = async () => {
    if (!currentSection) return;
    if (!validateQuestions(currentSection.questions)) return;
    const nextSectionId = getResolvedNextSectionId(currentSection);
    if (!nextSectionId) {
      if (isViewMode) return;
      await submitSurvey();
      return;
    }
    setSectionHistory((prev) => [...prev, currentSection.id]);
    setCurrentSectionId(nextSectionId);
    setError(null);
  };

  const submitSurvey = async () => {
    if (!surveyId || !survey) return;
    if (!validateBeforeSubmit()) return;

    try {
      setSubmitting(true);
      setError(null);

      const questionsToSubmit = getSubmittableQuestions();
      const peopleCoveredMemberIds = questionsToSubmit
        .filter((question) => question.blockType === 'people')
        .flatMap((question) => getPeopleAnswer(getQuestionKey(question)).map((member) => member.memberId));

      const answers = questionsToSubmit
        .map((question) => {
          const questionKey = getQuestionKey(question);
          return {
            questionId: question._id || questionKey,
            blockType: question.blockType,
            value: answersByQuestion[questionKey] ?? null,
            valueType: Array.isArray(answersByQuestion[questionKey]) ? 'array' : typeof answersByQuestion[questionKey]
          };
        });

      const submitResult = await api.submitSurveyResponse(surveyId, {
        coveredMemberIds: Array.from(new Set([...selectedMemberIds, ...peopleCoveredMemberIds])),
        answers
      });

      setSubmissionConfirmation({
        responseId: submitResult.responseId,
        submitterEmail: submitResult.emailReceipt?.submitterEmail || viewer?.submitterEmail || '',
        delegatedMemberNames: submitResult.emailReceipt?.delegatedMemberNames || responseCopyDelegateNames
      });
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit survey response');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionInput = (question: SurveyQuestion) => {
    const key = getQuestionKey(question);
    const value = answersByQuestion[key];
    const labelClassName = 'block text-sm font-medium text-custom-text mb-1';
    const renderQuestionLabel = () => (
      <>
        <label className={labelClassName}>
          {question.prompt}
          {question.required && (
            <span className="ml-2 align-middle text-xs font-semibold text-red-600">
              Required
            </span>
          )}
        </label>
        {question.helpText && (
          <div
            className="text-xs text-custom-text-secondary mb-2"
            dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(question.helpText) }}
          />
        )}
      </>
    );

    if (question.blockType === 'section_header') {
      return (
        <div className="border-t border-gray-200 pt-3 mt-1">
          <h3 className="text-base font-semibold text-custom-text">{question.prompt}</h3>
        </div>
      );
    }

    if (question.blockType === 'description') {
      return (
        <div
          className="text-sm text-custom-text-secondary"
          dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(question.prompt || question.helpText || '') }}
        />
      );
    }

    if (question.blockType === 'image_block' || question.blockType === 'video_block') {
      return (
        <div className="text-xs text-gray-500">
          Media block imported from original form. URL: {question.mediaUrl || 'N/A'}
        </div>
      );
    }

    if (!answerableBlockTypes.has(question.blockType)) {
      return (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This field type is not directly supported and needs manual review.
        </div>
      );
    }

    switch (question.blockType) {
      case 'paragraph':
        return (
          <div>
            {renderQuestionLabel()}
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 min-h-[90px]"
              value={String(value || '')}
              onChange={(e) => setAnswer(key, e.target.value)}
            />
          </div>
        );
      case 'multiple_choice':
        return (
          <div>
            {renderQuestionLabel()}
            <div className="space-y-1">
              {(question.options || []).map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`question-${key}`}
                    checked={value === option.value}
                    onChange={() => setAnswer(key, option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'checkboxes':
        return (
          <div>
            {renderQuestionLabel()}
            <div className="space-y-1">
              {(question.options || []).map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Array.isArray(value) ? (value as string[]).includes(option.value) : false}
                    onChange={() => toggleCheckboxOption(key, option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'dropdown':
        return (
          <div>
            {renderQuestionLabel()}
            <select
              value={String(value || '')}
              onChange={(e) => setAnswer(key, e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">Select one</option>
              {(question.options || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );
      case 'people': {
        const selectedPeople = getPeopleAnswer(key);
        const suggestions = getPeopleSuggestions(key);
        const query = peopleQueryByQuestion[key] || '';
        return (
          <div>
            {renderQuestionLabel()}
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedPeople.map((member) => (
                <span
                  key={member.memberId}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-xs px-3 py-1"
                >
                  {member.name}
                  <button onClick={() => removePeopleAnswer(key, member.memberId)} className="text-emerald-700 hover:text-emerald-900">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) =>
                  setPeopleQueryByQuestion((prev) => ({
                    ...prev,
                    [key]: e.target.value
                  }))
                }
                className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm"
                placeholder="Start typing a roster name"
              />
            </div>
            {query.trim() && (
              <div className="mt-2 border border-gray-200 rounded max-h-48 overflow-y-auto">
                {suggestions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-500">No roster members found.</p>
                ) : (
                  suggestions.map((member) => (
                    <button
                      type="button"
                      key={member.memberId}
                      onClick={() => addPeopleAnswer(key, member)}
                      disabled={!member.eligible}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 disabled:cursor-not-allowed disabled:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm text-custom-text">{member.name}</p>
                      </div>
                      {member.eligible ? (
                        <UserPlus size={14} className="text-gray-400" />
                      ) : (
                        <span className="text-xs text-gray-500">Already covered</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        );
      }
      case 'linear_scale': {
        const min = Number(question.linearScale?.min || 1);
        const max = Number(question.linearScale?.max || 5);
        const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);
        return (
          <div>
            {renderQuestionLabel()}
            <div className="flex flex-wrap gap-2">
              {options.map((num) => (
                <label key={num} className="inline-flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name={`scale-${key}`}
                    checked={Number(value) === num}
                    onChange={() => setAnswer(key, num)}
                  />
                  <span>{num}</span>
                </label>
              ))}
            </div>
          </div>
        );
      }
      case 'date':
      case 'time':
      case 'short_answer':
      default:
        return (
          <div>
            {renderQuestionLabel()}
            <input
              type={question.blockType === 'date' ? 'date' : question.blockType === 'time' ? 'time' : 'text'}
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={String(value || '')}
              onChange={(e) => setAnswer(key, e.target.value)}
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Card className="p-8 text-center text-sm text-gray-500">Loading survey...</Card>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Card className="p-6">
          <p className="text-red-600">Survey not found.</p>
        </Card>
      </div>
    );
  }

  const isCovered = viewer?.isCovered;
  const canRespond = viewer?.canRespond;
  const showInteractiveForm = canRespond || isViewMode;
  const currentSectionIndex = currentSection
    ? Math.max(sections.findIndex((section) => section.id === currentSection.id), 0)
    : 0;
  const nextSectionId = getResolvedNextSectionId(currentSection);
  const hasNextSection = !!nextSectionId;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Card className="p-6 mb-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h1 className="text-h2 font-lato-bold text-custom-text">{survey.title}</h1>
            {survey.description ? (
              <div
                className="text-sm text-custom-text-secondary mt-1"
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(survey.description) }}
              />
            ) : (
              <p className="text-sm text-custom-text-secondary mt-1">No description</p>
            )}
          </div>
          <Badge variant={survey.status === 'sent' ? 'info' : survey.status === 'closed' ? 'neutral' : 'warning'}>
            {survey.status}
          </Badge>
        </div>
      </Card>

      {isViewMode && (
        <Card className="p-4 mb-4 border border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-900">
            Preview mode: this behaves like recipient view, but submit is disabled.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {viewer?.canEditSurveyDefinition && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/camp/${survey.campId}/surveys?editSurveyId=${survey._id}`)}
              >
                Edit Survey
              </Button>
            )}
            {canRespond && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/surveys/${surveyId}`)}>
                Switch to response mode
              </Button>
            )}
          </div>
        </Card>
      )}

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {submissionConfirmation && (
        <Card className="p-5 mb-4 border border-green-200 bg-green-50">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle size={18} />
            <p className="font-medium">Survey submitted.</p>
          </div>
          <p className="text-sm text-green-700 mt-1">
            A copy of your responses will be sent to{' '}
            {submissionConfirmation.submitterEmail || 'the email address we have on file for you'}.
            {submissionConfirmation.delegatedMemberNames.length > 0 && (
              <>
                {' '}A copy will also be sent to the email address we have on file for{' '}
                {formatNameList(submissionConfirmation.delegatedMemberNames)}.
              </>
            )}
          </p>
          <div className="mt-3">
            <Button variant="outline" onClick={() => navigate('/tasks')}>
              Back to To-dos
            </Button>
          </div>
        </Card>
      )}

      {!submissionConfirmation && isCovered && (
        <Card className="p-5 mb-4 border border-green-200 bg-green-50">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle size={18} />
            <p className="font-medium">You are already marked complete for this survey.</p>
          </div>
          <p className="text-sm text-green-700 mt-1">
            {viewer?.coveredBySelf
              ? 'You have responded to this survey.'
              : `${viewer?.coveredBySubmitterName || 'A camp member'} has responded to this survey on your behalf. For any questions, please contact your camp lead.`}
          </p>
          <div className="mt-3">
            <Button variant="outline" onClick={() => navigate('/tasks')}>
              Back to To-dos
            </Button>
          </div>
        </Card>
      )}

      {!submissionConfirmation && isCovered && coveredResponse && (
        <Card className="p-5 mb-4">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-custom-text">Your response</h2>
              <p className="text-sm text-custom-text-secondary">
                Read-only view
                {viewer?.coveredBySelf
                  ? ''
                  : `, submitted by ${viewer?.coveredBySubmitterName || 'a camp member'}`}
                {formatDateTime(coveredResponse.submittedAt || coveredResponse.createdAt)
                  ? ` on ${formatDateTime(coveredResponse.submittedAt || coveredResponse.createdAt)}`
                  : ''}
              </p>
            </div>
            <Badge variant="success">Completed</Badge>
          </div>

          <div className="space-y-5">
            {sections
              .map((section) => ({
                ...section,
                questions: section.questions.filter((question) => answerableBlockTypes.has(question.blockType))
              }))
              .filter((section) => section.questions.length > 0)
              .map((section) => (
                <div key={section.id} className="space-y-3">
                  {sections.length > 1 && (
                    <div className="border-b border-gray-200 pb-2">
                      <h3 className="text-sm font-semibold text-custom-text">{section.title}</h3>
                      {section.description && (
                        <p className="mt-1 text-xs text-custom-text-secondary">
                          {stripHtmlToText(section.description)}
                        </p>
                      )}
                    </div>
                  )}
                  {section.questions.map((question) => (
                    <div key={getQuestionKey(question)} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-custom-text">{question.prompt}</p>
                        {question.required && (
                          <span className="text-xs font-semibold text-red-600">Required</span>
                        )}
                      </div>
                      {question.helpText && (
                        <p className="mt-1 text-xs text-custom-text-secondary">
                          {stripHtmlToText(question.helpText)}
                        </p>
                      )}
                      <p className="mt-2 whitespace-pre-wrap text-sm text-custom-text">
                        {getCoveredAnswerText(question)}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </Card>
      )}

      {!submissionConfirmation && !canRespond && !isCovered && !isViewMode && (
        <Card className="p-5 mb-4">
          <p className="text-sm text-gray-700">
            You do not currently have permission to submit this survey.
          </p>
        </Card>
      )}

      {showInteractiveForm && !isCovered && !submissionConfirmation && (
        <>
          <Card className="p-5 mb-4">
            <h2 className="text-base font-semibold text-custom-text mb-2">Who are you responding for?</h2>
            <p className="text-sm text-custom-text-secondary mb-3">
              Start typing to select yourself and any additional roster members you are submitting on behalf of.
              Members already covered by another response cannot be selected.
            </p>
            <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              A copy of your responses will be sent to{' '}
              <span className="font-semibold">{viewer?.submitterEmail || 'the email address we have on file for you'}</span>.
              {responseCopyDelegateNames.length > 0 && (
                <>
                  {' '}A copy will also be sent to the email address we have on file for{' '}
                  <span className="font-semibold">{formatNameList(responseCopyDelegateNames)}</span>.
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {selectedMembers.map((member) => (
                <span
                  key={member.memberId}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 text-xs px-3 py-1"
                >
                  {member.name}
                  {member.memberId !== viewer?.submitterMemberId && (
                    <button onClick={() => removeMember(member.memberId)} className="text-blue-700 hover:text-blue-900">
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm"
                placeholder="Search roster members by name"
              />
            </div>
            {memberQuery.trim() && (
              <div className="mt-2 border border-gray-200 rounded max-h-48 overflow-y-auto">
                {visibleSuggestions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-500">No eligible members found.</p>
                ) : (
                  visibleSuggestions.map((member) => (
                    <button
                      type="button"
                      key={member.memberId}
                      onClick={() => addMember(member)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm text-custom-text">{member.name}</p>
                      </div>
                      <UserPlus size={14} className="text-gray-400" />
                    </button>
                  ))
                )}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            {currentSection && (sections.length > 1 || currentSection.description) && (
              <div className="border-b border-gray-200 pb-4">
                {sections.length > 1 && (
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Section {currentSectionIndex + 1} of {sections.length}
                  </p>
                )}
                <h2 className="text-lg font-semibold text-custom-text">{currentSection.title}</h2>
                {currentSection.description && (
                  <div
                    className="text-sm text-custom-text-secondary mt-1"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(currentSection.description) }}
                  />
                )}
              </div>
            )}
            {(currentSection?.questions || []).map((question, index) => (
              <div key={question._id || `${question.blockType}-${index}`} className="space-y-1">
                {renderQuestionInput(question)}
              </div>
            ))}
          </Card>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {sectionHistory.length > 0 && (
              <Button variant="outline" onClick={goToPreviousSection}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/tasks')}>
              Cancel
            </Button>
            {hasNextSection ? (
              <Button variant="primary" onClick={goToNextSection} disabled={submitting}>
                Next
              </Button>
            ) : !isViewMode ? (
              <Button variant="primary" onClick={submitSurvey} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Survey'}
              </Button>
            ) : (
              <Button variant="primary" disabled>
                Submit Survey
              </Button>
            )}
          </div>
          {isViewMode && (
            <p className="text-xs text-gray-500 mt-2">
              Submit is disabled in preview mode.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default SurveyRespond;
