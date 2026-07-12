import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Badge, Button, Card } from '../../components/ui';
import { Survey, SurveyBlockType, SurveyQuestion } from '../../types';
import { ArrowLeft, ClipboardList, FileText } from 'lucide-react';

type SurveyResponseAnswer = {
  questionId?: string | { _id?: string };
  blockType?: SurveyBlockType;
  value?: unknown;
  valueType?: string;
};

type SurveyResponseRecord = {
  _id: string;
  submitterName?: string;
  coveredMembers?: Array<{ memberId: string; name?: string }>;
  answers?: SurveyResponseAnswer[];
  submittedAt?: string;
  createdAt?: string;
  lastEditedAt?: string | null;
  updatedAt?: string;
};

type QuestionColumn = {
  key: string;
  question: SurveyQuestion;
  number: number;
  sectionTitle: string;
  prompt: string;
  helpText: string;
};

const answerableBlockTypes = new Set<SurveyBlockType>([
  'short_answer',
  'paragraph',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'linear_scale',
  'multiple_choice_grid',
  'checkbox_grid',
  'people',
  'date',
  'time',
  'unsupported'
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

const getQuestionKey = (question: SurveyQuestion): string =>
  question._id || question.localId || String(question.order);

const getAnswerQuestionKey = (answer: SurveyResponseAnswer): string => {
  const questionId = answer.questionId;
  if (!questionId) return '';
  if (typeof questionId === 'object') return String(questionId._id || '');
  return String(questionId);
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const formatBlockType = (blockType: SurveyBlockType): string =>
  blockType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

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
    return names.length > 0 ? names.join(', ') : '-';
  }

  const person = formatPerson(value);
  return person || '-';
};

const formatAnswerValue = (value: unknown, blockType?: SurveyBlockType): string => {
  if (blockType === 'people') return formatPeopleValue(value);
  if (value === null || value === undefined || value === '') return '-';

  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    return value
      .map((item) => {
        if (item === null || item === undefined || item === '') return '';
        if (typeof item === 'object') return formatObjectValue(item as Record<string, unknown>);
        return String(item);
      })
      .filter(Boolean)
      .join(', ') || '-';
  }

  if (typeof value === 'object') {
    return formatObjectValue(value as Record<string, unknown>);
  }

  return String(value);
};

const buildQuestionColumns = (questions: SurveyQuestion[]): QuestionColumn[] => {
  let currentSectionTitle = '';
  let answerableCount = 0;

  return questions.reduce<QuestionColumn[]>((columns, question, index) => {
    const prompt = stripHtmlToText(question.prompt || '');

    if (question.blockType === 'section_header') {
      currentSectionTitle = prompt || `Section ${columns.length + 1}`;
      return columns;
    }

    if (!answerableBlockTypes.has(question.blockType)) return columns;

    answerableCount += 1;
    columns.push({
      key: getQuestionKey(question),
      question,
      number: answerableCount,
      sectionTitle: currentSectionTitle,
      prompt: prompt || `Question ${index + 1}`,
      helpText: stripHtmlToText(question.helpText || '')
    });

    return columns;
  }, []);
};

const SurveyResponses: React.FC = () => {
  const navigate = useNavigate();
  const { surveyId } = useParams<{ surveyId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponseRecord[]>([]);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editingAnswersJson, setEditingAnswersJson] = useState('');
  const [savingResponse, setSavingResponse] = useState(false);

  const loadResponses = useCallback(async () => {
    if (!surveyId) return;

    try {
      setLoading(true);
      setError(null);
      const [detail, responseResult] = await Promise.all([
        api.getSurveyDetails(surveyId),
        api.getSurveyResponses(surveyId)
      ]);

      setSurvey(detail.survey);
      setQuestions(
        (detail.questions || []).map((question: SurveyQuestion, index: number) => ({
          ...question,
          order: index,
          localId: question.localId || `${question.blockType === 'section_header' ? 'section' : 'question'}_${index + 1}`
        }))
      );
      setResponses(responseResult.responses || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load survey responses');
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    loadResponses();
  }, [loadResponses]);

  const questionColumns = useMemo(() => buildQuestionColumns(questions), [questions]);

  const answersByResponseId = useMemo(() => {
    const next = new Map<string, Map<string, SurveyResponseAnswer>>();

    responses.forEach((response) => {
      const answerMap = new Map<string, SurveyResponseAnswer>();
      (response.answers || []).forEach((answer) => {
        const questionKey = getAnswerQuestionKey(answer);
        if (questionKey) answerMap.set(questionKey, answer);
      });
      next.set(response._id, answerMap);
    });

    return next;
  }, [responses]);

  const startEditResponse = (response: SurveyResponseRecord) => {
    setEditingResponseId(response._id);
    setEditingAnswersJson(JSON.stringify(response.answers || [], null, 2));
  };

  const cancelEditResponse = () => {
    setEditingResponseId(null);
    setEditingAnswersJson('');
  };

  const saveEditedResponse = async () => {
    if (!surveyId || !editingResponseId) return;

    try {
      setSavingResponse(true);
      setError(null);
      const parsedAnswers = JSON.parse(editingAnswersJson);
      await api.editSurveyResponse(surveyId, editingResponseId, {
        answers: parsedAnswers,
        editReason: 'Updated from survey response table'
      });
      cancelEditResponse();
      await loadResponses();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update response');
    } finally {
      setSavingResponse(false);
    }
  };

  const getCoveredMembersText = (response: SurveyResponseRecord): string => {
    const names = (response.coveredMembers || [])
      .map((member) => member.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : '-';
  };

  const getAnswerText = (response: SurveyResponseRecord, column: QuestionColumn): string => {
    const answer = answersByResponseId.get(response._id)?.get(column.key);
    if (!answer) return 'No answer';
    return formatAnswerValue(answer.value, answer.blockType || column.question.blockType);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 survey-response-page">
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.35in;
          }

          body {
            background: #ffffff !important;
          }

          .survey-response-page {
            max-width: none !important;
            padding: 0 !important;
          }

          .survey-print-hidden {
            display: none !important;
          }

          .survey-print-card {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .survey-response-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9px !important;
            line-height: 1.25 !important;
          }

          .survey-response-table th,
          .survey-response-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px !important;
            vertical-align: top !important;
          }

          .survey-response-table th {
            background: #f1f5f9 !important;
            color: #111827 !important;
          }

          .survey-response-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .survey-screen-overflow {
            overflow: visible !important;
          }
        }
      `}</style>

      <div className="survey-print-hidden mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center gap-2 self-start">
          <ArrowLeft size={16} />
          Back
        </Button>
        <Button variant="primary" onClick={handlePrint} className="flex items-center gap-2 self-start">
          <FileText size={16} />
          Print Responses
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 survey-print-hidden">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="p-8 text-center text-sm text-gray-500">Loading survey responses...</Card>
      ) : !survey ? (
        <Card className="p-8 text-center text-sm text-red-600">Survey not found.</Card>
      ) : (
        <div className="space-y-5">
          <Card className="p-5 survey-print-card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ClipboardList size={20} className="text-custom-primary" />
                  <h1 className="text-h1 font-lato-bold text-custom-text">{survey.title}</h1>
                  <Badge variant={survey.status === 'draft' ? 'warning' : survey.status === 'sent' ? 'info' : 'neutral'}>
                    {survey.status}
                  </Badge>
                </div>
                {survey.description && (
                  <p className="max-w-4xl text-sm text-custom-text-secondary">
                    {stripHtmlToText(survey.description)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[520px]">
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-xs uppercase text-gray-500">Responses</p>
                  <p className="text-lg font-semibold text-custom-text">{responses.length}</p>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-xs uppercase text-gray-500">Questions</p>
                  <p className="text-lg font-semibold text-custom-text">{questionColumns.length}</p>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-xs uppercase text-gray-500">Sent</p>
                  <p className="text-sm font-semibold text-custom-text">{formatDateTime(survey.sentAt)}</p>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-xs uppercase text-gray-500">Closed</p>
                  <p className="text-sm font-semibold text-custom-text">{formatDateTime(survey.closedAt)}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden p-0 survey-print-card">
            <div className="survey-screen-overflow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm survey-response-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="min-w-[140px] px-4 py-3 font-semibold text-gray-700">Submitted</th>
                    <th className="min-w-[150px] px-4 py-3 font-semibold text-gray-700">Submitted By</th>
                    <th className="min-w-[180px] px-4 py-3 font-semibold text-gray-700">Completed For</th>
                    <th className="min-w-[120px] px-4 py-3 font-semibold text-gray-700">Edited</th>
                    {questionColumns.map((column) => (
                      <th key={column.key} className="min-w-[220px] px-4 py-3 font-semibold text-gray-700">
                        <div className="space-y-1">
                          {column.sectionTitle && (
                            <div className="text-[11px] font-medium uppercase text-gray-500">{column.sectionTitle}</div>
                          )}
                          <div>
                            Q{column.number}. {column.prompt}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[11px] font-normal text-gray-500">
                            <span>{formatBlockType(column.question.blockType)}</span>
                            {column.question.required && (
                              <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 font-semibold text-red-700">
                                Required
                              </span>
                            )}
                          </div>
                          {column.helpText && (
                            <div className="text-[11px] font-normal leading-snug text-gray-500">{column.helpText}</div>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold text-gray-700 survey-print-hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {responses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={questionColumns.length + 5}
                        className="px-4 py-10 text-center text-sm text-gray-500"
                      >
                        No responses submitted yet.
                      </td>
                    </tr>
                  ) : (
                    responses.map((response) => (
                      <tr key={response._id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {formatDateTime(response.submittedAt || response.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {response.submitterName || 'Responder'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{getCoveredMembersText(response)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {formatDateTime(response.lastEditedAt || null)}
                        </td>
                        {questionColumns.map((column) => (
                          <td key={column.key} className="max-w-[320px] whitespace-pre-wrap px-4 py-3 text-gray-700">
                            {getAnswerText(response, column)}
                          </td>
                        ))}
                        <td className="px-4 py-3 survey-print-hidden">
                          <Button variant="outline" size="sm" onClick={() => startEditResponse(response)}>
                            Edit JSON
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {editingResponseId && (
            <Card className="border border-blue-200 bg-blue-50 p-4 survey-print-hidden">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-blue-950">Edit response answers</h2>
              </div>
              <textarea
                value={editingAnswersJson}
                onChange={(event) => setEditingAnswersJson(event.target.value)}
                className="min-h-[220px] w-full rounded border border-blue-200 px-3 py-2 font-mono text-xs"
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={cancelEditResponse}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={saveEditedResponse} disabled={savingResponse}>
                  {savingResponse ? 'Saving...' : 'Save Response'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default SurveyResponses;
