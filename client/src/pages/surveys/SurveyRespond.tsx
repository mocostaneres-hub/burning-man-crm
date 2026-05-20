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

type SurveyAnswerValue = string | number | string[] | null;

const answerableBlockTypes = new Set([
  'short_answer',
  'paragraph',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'linear_scale',
  'date',
  'time'
]);

const sanitizeRichTextHtml = (value: string): string =>
  String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');

const SurveyRespond: React.FC = () => {
  const navigate = useNavigate();
  const { surveyId } = useParams<{ surveyId: string }>();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [viewer, setViewer] = useState<any>(null);

  const [eligibleMembers, setEligibleMembers] = useState<EligibleMember[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, SurveyAnswerValue>>({});
  const isViewMode = searchParams.get('mode') === 'view' || searchParams.get('view') === '1';

  const loadSurvey = useCallback(async () => {
    if (!surveyId) return;
    try {
      setLoading(true);
      setError(null);
      const detail = await api.getSurveyDetails(surveyId);
      setSurvey(detail.survey);
      setQuestions(detail.questions || []);
      setViewer(detail.viewer || {});

      if (detail.viewer?.canRespond) {
        const eligible = await api.getSurveyEligibleMembers(surveyId);
        setEligibleMembers(eligible.eligibleMembers || []);
        const selfId = eligible.submitterMemberId;
        setSelectedMemberIds(selfId ? [selfId] : []);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  useEffect(() => {
    if (!surveyId || !viewer?.canRespond) return;
    const timer = setTimeout(async () => {
      try {
        const result = await api.getSurveyEligibleMembers(surveyId, memberQuery.trim() || undefined);
        setEligibleMembers(result.eligibleMembers || []);
      } catch (_err) {
        // Keep current list on transient search errors.
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [memberQuery, surveyId, viewer?.canRespond]);

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

  const addMember = (member: EligibleMember) => {
    setSelectedMemberIds((prev) => (prev.includes(member.memberId) ? prev : [...prev, member.memberId]));
    setMemberQuery('');
  };

  const removeMember = (memberId: string) => {
    if (memberId === viewer?.submitterMemberId) return;
    setSelectedMemberIds((prev) => prev.filter((id) => id !== memberId));
  };

  const validateBeforeSubmit = () => {
    if (!survey || !viewer?.canRespond) return false;
    if (!selectedMemberIds.includes(viewer?.submitterMemberId)) {
      setError('Your own roster profile must remain selected.');
      return false;
    }
    for (const question of questions) {
      const key = question._id || String(question.order);
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

  const submitSurvey = async () => {
    if (!surveyId || !survey) return;
    if (!validateBeforeSubmit()) return;

    try {
      setSubmitting(true);
      setError(null);

      const answers = questions
        .filter((question) => answerableBlockTypes.has(question.blockType))
        .map((question) => {
          const questionKey = question._id || String(question.order);
          return {
            questionId: question._id || questionKey,
            blockType: question.blockType,
            value: answersByQuestion[questionKey] ?? null,
            valueType: Array.isArray(answersByQuestion[questionKey]) ? 'array' : typeof answersByQuestion[questionKey]
          };
        });

      await api.submitSurveyResponse(surveyId, {
        coveredMemberIds: selectedMemberIds,
        answers
      });

      navigate('/tasks');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit survey response');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionInput = (question: SurveyQuestion) => {
    const key = question._id || String(question.order);
    const value = answersByQuestion[key];
    const labelClassName = 'block text-sm font-medium text-custom-text mb-1';

    if (question.blockType === 'section_header') {
      return (
        <div className="border-t border-gray-200 pt-3 mt-1">
          <h3 className="text-base font-semibold text-custom-text">{question.prompt}</h3>
        </div>
      );
    }

    if (question.blockType === 'description') {
      return <p className="text-sm text-custom-text-secondary">{question.prompt}</p>;
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
            <label className={labelClassName}>{question.prompt}</label>
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
            <label className={labelClassName}>{question.prompt}</label>
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
            <label className={labelClassName}>{question.prompt}</label>
            <div className="space-y-1">
              {(question.options || []).map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Array.isArray(value) ? value.includes(option.value) : false}
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
            <label className={labelClassName}>{question.prompt}</label>
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
      case 'linear_scale': {
        const min = Number(question.linearScale?.min || 1);
        const max = Number(question.linearScale?.max || 5);
        const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);
        return (
          <div>
            <label className={labelClassName}>{question.prompt}</label>
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
            <label className={labelClassName}>{question.prompt}</label>
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

  const renderQuestionPreview = (question: SurveyQuestion) => {
    const prompt = question.prompt || 'Untitled question';
    if (question.blockType === 'section_header') {
      return <h3 className="text-base font-semibold text-custom-text border-t border-gray-200 pt-3">{prompt}</h3>;
    }
    if (question.blockType === 'description') {
      return <p className="text-sm text-custom-text-secondary">{prompt}</p>;
    }
    if (question.blockType === 'image_block' || question.blockType === 'video_block') {
      return (
        <div className="text-xs text-gray-500">
          Media block: {question.mediaUrl || 'No media URL'}
        </div>
      );
    }
    if (question.blockType === 'linear_scale') {
      const min = Number(question.linearScale?.min || 1);
      const max = Number(question.linearScale?.max || 5);
      return (
        <div>
          <p className="text-sm font-medium text-custom-text">
            {prompt} {question.required ? <span className="text-red-500">*</span> : null}
          </p>
          <p className="text-xs text-gray-600 mt-1">Scale: {min} to {max}</p>
        </div>
      );
    }

    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(question.blockType)) {
      return (
        <div>
          <p className="text-sm font-medium text-custom-text">
            {prompt} {question.required ? <span className="text-red-500">*</span> : null}
          </p>
          <ul className="mt-1 text-sm text-gray-700 list-disc list-inside">
            {(question.options || []).map((option) => (
              <li key={option.value}>{option.label}</li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <div>
        <p className="text-sm font-medium text-custom-text">
          {prompt} {question.required ? <span className="text-red-500">*</span> : null}
        </p>
        <p className="text-xs text-gray-600 mt-1">Answer type: {question.blockType.replace('_', ' ')}</p>
      </div>
    );
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
  const showInteractiveForm = canRespond && !isViewMode;
  const showReadOnlyView = isViewMode || !canRespond || isCovered;

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
            Viewing this survey in read-only mode.
          </p>
          {canRespond && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/surveys/${surveyId}`)}>
                Switch to response mode
              </Button>
            </div>
          )}
        </Card>
      )}

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {isCovered && (
        <Card className="p-5 mb-4 border border-green-200 bg-green-50">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle size={18} />
            <p className="font-medium">You are already marked complete for this survey.</p>
          </div>
          <p className="text-sm text-green-700 mt-1">
            This can happen if another roster member submitted a grouped response that included you.
          </p>
          <div className="mt-3">
            <Button variant="outline" onClick={() => navigate('/tasks')}>
              Back to To-dos
            </Button>
          </div>
        </Card>
      )}

      {!canRespond && !isCovered && !isViewMode && (
        <Card className="p-5 mb-4">
          <p className="text-sm text-gray-700">
            You do not currently have permission to submit this survey.
          </p>
        </Card>
      )}

      {showInteractiveForm && (
        <>
          <Card className="p-5 mb-4">
            <h2 className="text-base font-semibold text-custom-text mb-2">Who are you responding for?</h2>
            <p className="text-sm text-custom-text-secondary mb-3">
              Start typing to select yourself and any additional roster members you are submitting on behalf of.
              Members already covered by another response cannot be selected.
            </p>

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
                placeholder="Search roster members by name or email"
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
                        {member.email && <p className="text-xs text-gray-500">{member.email}</p>}
                      </div>
                      <UserPlus size={14} className="text-gray-400" />
                    </button>
                  ))
                )}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            {questions.map((question, index) => (
              <div key={question._id || `${question.blockType}-${index}`} className="space-y-1">
                {renderQuestionInput(question)}
              </div>
            ))}
          </Card>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/tasks')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitSurvey} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Survey'}
            </Button>
          </div>
        </>
      )}

      {showReadOnlyView && (
        <Card className="p-5 space-y-4 mt-4">
          <h2 className="text-base font-semibold text-custom-text">Survey Questions</h2>
          {questions.length === 0 ? (
            <p className="text-sm text-gray-500">No questions found for this survey.</p>
          ) : (
            questions.map((question, index) => (
              <div key={question._id || `${question.blockType}-${index}`} className="space-y-1">
                {renderQuestionPreview(question)}
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
};

export default SurveyRespond;
