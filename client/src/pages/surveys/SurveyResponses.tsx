import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Badge, Button, Card } from '../../components/ui';
import { Survey, SurveyBlockType, SurveyQuestion } from '../../types';
import {
  ArrowLeft,
  Calendar,
  Car,
  CheckCircle,
  ClipboardList,
  Clock,
  Edit,
  FileText,
  Filter,
  Home,
  Save,
  Search,
  Users,
  X
} from 'lucide-react';

type SurveyResponseAnswer = {
  questionId?: string | { _id?: string };
  blockType?: SurveyBlockType;
  value?: unknown;
  valueType?: string;
};

type SurveyResponseSaveAnswer = {
  questionId: string;
  blockType: SurveyBlockType;
  value: unknown;
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

type RosterPerson = {
  memberId: string;
  name: string;
};

type MetricKey = 'arrival' | 'departure' | 'rv' | 'tent' | 'shade';
type ResponseFilter = MetricKey | 'edited';

type EditingCell = {
  responseId: string;
  questionKey: string;
};

type MetricCardProps = {
  title: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
  percentage?: number;
};

type FilterButtonProps = {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'warning' | 'success';
};

const metricKeys: MetricKey[] = ['arrival', 'departure', 'rv', 'tent', 'shade'];

const metricLabels: Record<MetricKey, string> = {
  arrival: 'Arrivals',
  departure: 'Departures',
  rv: 'RVs',
  tent: 'Tents',
  shade: 'Shade'
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

const MetricCard: React.FC<MetricCardProps> = ({ title, count, icon, colorClass, percentage }) => (
  <Card className="p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className={`text-2xl font-bold ${colorClass}`}>{count}</p>
          {percentage !== undefined && (
            <p className="text-sm font-medium text-gray-500">({percentage}%)</p>
          )}
        </div>
      </div>
      <div
        className={`rounded-full p-3 ${
          colorClass.includes('red')
            ? 'bg-red-100'
            : colorClass.includes('orange')
              ? 'bg-orange-100'
              : colorClass.includes('blue')
                ? 'bg-blue-100'
                : colorClass.includes('purple')
                  ? 'bg-purple-100'
                  : colorClass.includes('emerald')
                    ? 'bg-emerald-100'
                    : colorClass.includes('slate')
                      ? 'bg-slate-100'
                      : 'bg-green-100'
        }`}
      >
        {icon}
      </div>
    </div>
  </Card>
);

const FilterButton: React.FC<FilterButtonProps> = ({
  label,
  count,
  isActive,
  onClick,
  variant = 'secondary'
}) => {
  const activeClasses = {
    primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
    warning: 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700',
    success: 'bg-green-600 text-white border-green-600 hover:bg-green-700',
    secondary: 'bg-red-600 text-white border-red-600 hover:bg-red-700'
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={`px-2 py-1 text-xs transition-colors duration-200 ${
        isActive ? activeClasses[variant] : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label} ({count})
      {isActive && <X className="ml-1 h-3 w-3" />}
    </Button>
  );
};

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

const toIdString = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof (value as { toString?: () => string }).toString === 'function') {
    const stringValue = (value as { toString: () => string }).toString();
    return stringValue === '[object Object]' ? '' : stringValue;
  }
  return '';
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

const hasMeaningfulAnswer = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
};

const normalizeText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const getMetricKeyForQuestion = (column: QuestionColumn): MetricKey | null => {
  const text = normalizeText(`${column.sectionTitle} ${column.prompt} ${column.helpText}`);

  if (/\b(arrival|arrive|arriving|early arrival|eap)\b/.test(text)) return 'arrival';
  if (/\b(departure|depart|departing|leave|leaving|strike|late departure)\b/.test(text)) return 'departure';
  if (/\b(rv|rvs|recreational vehicle|camper|motorhome|trailer)\b/.test(text)) return 'rv';
  if (/\b(tent|tents|yurt|shiftpod)\b/.test(text)) return 'tent';
  if (/\b(shade|shade structure|shade structures|carport|monkey hut)\b/.test(text)) return 'shade';

  return null;
};

const getQuantityFromAnswer = (answer: SurveyResponseAnswer | undefined): number => {
  if (!answer || !hasMeaningfulAnswer(answer.value)) return 0;
  const value = answer.value;

  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Array.isArray(value)) {
    if (value.length === 0) return 0;
    const numericTotal = value.reduce((total, item) => total + getQuantityFromAnswer({ value: item }), 0);
    return numericTotal > 0 ? numericTotal : value.length;
  }
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const numericCandidate = objectValue.quantity || objectValue.count || objectValue.value;
    const parsed = Number(numericCandidate);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  const text = String(value).trim().toLowerCase();
  if (!text || ['no', 'none', 'n/a', 'na', '0', 'false'].includes(text)) return 0;

  const numericMatch = text.match(/-?\d+(\.\d+)?/);
  if (numericMatch) {
    const parsed = Number(numericMatch[0]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  return /\b(yes|yep|true|bringing|have|need)\b/.test(text) ? 1 : 1;
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

const getRosterPersonName = (memberData: any): string => {
  const user = typeof memberData?.user === 'object' ? memberData.user : memberData?.userDetails || {};
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const playaName = String(user?.playaName || memberData?.playaName || '').trim();
  const fallbackName = String(memberData?.name || '').trim();

  if (fullName && playaName) return `${fullName} (${playaName})`;
  return fullName || playaName || fallbackName || 'Roster member';
};

const buildRosterPeople = (roster: any): RosterPerson[] => {
  const seen = new Set<string>();
  const people: RosterPerson[] = [];

  for (const entry of Array.isArray(roster?.members) ? roster.members : []) {
    const memberData = typeof entry?.member === 'object' ? entry.member : entry?.memberDetails || {};
    const memberId = toIdString(memberData?._id || entry?.member || entry?.memberId || entry?._id);
    if (!memberId || seen.has(memberId)) continue;

    seen.add(memberId);
    people.push({
      memberId,
      name: getRosterPersonName(memberData)
    });
  }

  return people.sort((a, b) => a.name.localeCompare(b.name));
};

const buildDraftValue = (question: SurveyQuestion, value: unknown): unknown => {
  if (question.blockType === 'checkboxes') {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }
  if (question.blockType === 'people') {
    return Array.isArray(value)
      ? value
          .map((item) => {
            if (typeof item === 'object' && item !== null) {
              const person = item as Record<string, unknown>;
              return {
                memberId: String(person.memberId || person._id || person.id || person.value || ''),
                name: String(person.name || person.label || person.title || 'Roster member')
              };
            }
            return null;
          })
          .filter((item): item is RosterPerson => Boolean(item?.memberId))
      : [];
  }
  if (question.blockType === 'date') {
    if (!value) return '';
    const stringValue = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue;
    const parsed = new Date(stringValue);
    return Number.isNaN(parsed.getTime()) ? stringValue : parsed.toISOString().slice(0, 10);
  }
  if (question.blockType === 'time') {
    return value ? String(value).slice(0, 5) : '';
  }
  if (
    question.blockType === 'multiple_choice_grid' ||
    question.blockType === 'checkbox_grid' ||
    question.blockType === 'unsupported'
  ) {
    return typeof value === 'object' ? JSON.stringify(value || {}, null, 2) : String(value || '');
  }
  return value === null || value === undefined ? '' : String(value);
};

const buildSaveValue = (question: SurveyQuestion, draftValue: unknown): unknown => {
  if (question.blockType === 'checkboxes') {
    return Array.isArray(draftValue) ? draftValue.map((item) => String(item)) : [];
  }
  if (question.blockType === 'people') {
    return Array.isArray(draftValue) ? draftValue : [];
  }
  if (question.blockType === 'linear_scale') {
    if (draftValue === '' || draftValue === null || draftValue === undefined) return null;
    const parsed = Number(draftValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (
    question.blockType === 'multiple_choice_grid' ||
    question.blockType === 'checkbox_grid' ||
    question.blockType === 'unsupported'
  ) {
    const text = String(draftValue || '').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_error) {
      return text;
    }
  }
  const textValue = String(draftValue || '').trim();
  return textValue || null;
};

const getValueType = (value: unknown): string => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
};

const normalizeAnswerForSave = (answer: SurveyResponseAnswer): SurveyResponseSaveAnswer | null => {
  const questionId = getAnswerQuestionKey(answer);
  if (!questionId || !answer.blockType) return null;
  return {
    questionId,
    blockType: answer.blockType,
    value: answer.value ?? null,
    valueType: answer.valueType || getValueType(answer.value ?? null)
  };
};

const csvEscape = (value: unknown): string => {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const slugifyFilename = (value: string): string =>
  normalizeText(value)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '') || 'survey';

const SurveyResponses: React.FC = () => {
  const navigate = useNavigate();
  const { surveyId } = useParams<{ surveyId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponseRecord[]>([]);
  const [rosterPeople, setRosterPeople] = useState<RosterPerson[]>([]);
  const [activeFilters, setActiveFilters] = useState<ResponseFilter[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [draftValue, setDraftValue] = useState<unknown>('');
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [peopleSearch, setPeopleSearch] = useState('');

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

      try {
        const roster = await api.get('/rosters/active', { params: { campId: detail.survey.campId } });
        setRosterPeople(buildRosterPeople(roster));
      } catch (_rosterError) {
        setRosterPeople([]);
      }
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

  const columnMetricByKey = useMemo(() => {
    const next = new Map<string, MetricKey>();
    questionColumns.forEach((column) => {
      const metricKey = getMetricKeyForQuestion(column);
      if (metricKey) next.set(column.key, metricKey);
    });
    return next;
  }, [questionColumns]);

  const responseFacts = useMemo(() => {
    const next = new Map<
      string,
      {
        searchText: string;
        metrics: Record<MetricKey, { hasValue: boolean; quantity: number }>;
      }
    >();

    responses.forEach((response) => {
      const metrics = metricKeys.reduce<Record<MetricKey, { hasValue: boolean; quantity: number }>>((acc, key) => {
        acc[key] = { hasValue: false, quantity: 0 };
        return acc;
      }, {} as Record<MetricKey, { hasValue: boolean; quantity: number }>);
      const answerMap = answersByResponseId.get(response._id);
      const answerTexts: string[] = [];

      questionColumns.forEach((column) => {
        const answer = answerMap?.get(column.key);
        const answerText = answer ? formatAnswerValue(answer.value, answer.blockType || column.question.blockType) : '';
        answerTexts.push(answerText);

        const metricKey = columnMetricByKey.get(column.key);
        if (metricKey && answer && hasMeaningfulAnswer(answer.value)) {
          metrics[metricKey].hasValue = true;
          metrics[metricKey].quantity += metricKey === 'arrival' || metricKey === 'departure'
            ? 1
            : getQuantityFromAnswer(answer);
        }
      });

      next.set(response._id, {
        searchText: normalizeText(
          [
            response.submitterName || '',
            ...(response.coveredMembers || []).map((member) => member.name || ''),
            ...answerTexts
          ].join(' ')
        ),
        metrics
      });
    });

    return next;
  }, [answersByResponseId, columnMetricByKey, questionColumns, responses]);

  const filteredResponses = useMemo(() => {
    const query = normalizeText(searchQuery);

    return responses.filter((response) => {
      const facts = responseFacts.get(response._id);
      if (query && !facts?.searchText.includes(query)) return false;

      return activeFilters.every((filter) => {
        if (filter === 'edited') return Boolean(response.lastEditedAt);
        return Boolean(facts?.metrics[filter].hasValue);
      });
    });
  }, [activeFilters, responseFacts, responses, searchQuery]);

  const summary = useMemo(() => {
    const people = new Set<string>();
    const metricTotals = metricKeys.reduce<Record<MetricKey, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<MetricKey, number>);

    filteredResponses.forEach((response) => {
      (response.coveredMembers || []).forEach((member) => {
        const memberKey = member.memberId || member.name;
        if (memberKey) people.add(memberKey);
      });

      const facts = responseFacts.get(response._id);
      metricKeys.forEach((key) => {
        if (!facts?.metrics[key].hasValue) return;
        metricTotals[key] += key === 'arrival' || key === 'departure' ? 1 : facts.metrics[key].quantity;
      });
    });

    return {
      responseCount: filteredResponses.length,
      peopleCoveredCount: people.size,
      metricTotals
    };
  }, [filteredResponses, responseFacts]);

  const quickFilters = useMemo(() => {
    const filters: Array<{ key: ResponseFilter; label: string; count: number; variant?: FilterButtonProps['variant'] }> = [];

    metricKeys.forEach((metricKey) => {
      const hasMatchingColumn = Array.from(columnMetricByKey.values()).includes(metricKey);
      if (!hasMatchingColumn) return;
      const count = responses.filter((response) => responseFacts.get(response._id)?.metrics[metricKey].hasValue).length;
      filters.push({
        key: metricKey,
        label: metricLabels[metricKey],
        count,
        variant: metricKey === 'arrival' || metricKey === 'departure' ? 'primary' : metricKey === 'rv' ? 'warning' : 'success'
      });
    });

    const editedCount = responses.filter((response) => Boolean(response.lastEditedAt)).length;
    if (editedCount > 0) {
      filters.push({ key: 'edited', label: 'Edited', count: editedCount, variant: 'secondary' });
    }

    return filters;
  }, [columnMetricByKey, responseFacts, responses]);

  const calculatePercentage = (count: number) => {
    return responses.length > 0 ? Math.round((count / responses.length) * 100) : 0;
  };

  const getAnswer = (response: SurveyResponseRecord, column: QuestionColumn): SurveyResponseAnswer | undefined =>
    answersByResponseId.get(response._id)?.get(column.key);

  const getCoveredMembersText = (response: SurveyResponseRecord): string => {
    const names = (response.coveredMembers || [])
      .map((member) => member.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : '-';
  };

  const getAnswerText = (response: SurveyResponseRecord, column: QuestionColumn): string => {
    const answer = getAnswer(response, column);
    if (!answer) return 'No answer';
    return formatAnswerValue(answer.value, answer.blockType || column.question.blockType);
  };

  const toggleFilter = (filter: ResponseFilter) => {
    setActiveFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
    );
  };

  const clearFilters = () => {
    setActiveFilters([]);
    setSearchQuery('');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!survey) return;

    const headers = [
      'Submitted',
      'Submitted By',
      'Completed For',
      'Edited',
      ...questionColumns.map((column) => `Q${column.number}: ${column.prompt}`)
    ];

    const rows = filteredResponses.map((response) => [
      formatDateTime(response.submittedAt || response.createdAt),
      response.submitterName || 'Responder',
      getCoveredMembersText(response),
      formatDateTime(response.lastEditedAt || null),
      ...questionColumns.map((column) => getAnswerText(response, column))
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugifyFilename(survey.title)}-responses.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startCellEdit = (response: SurveyResponseRecord, column: QuestionColumn) => {
    const answer = getAnswer(response, column);
    setEditingCell({ responseId: response._id, questionKey: column.key });
    setDraftValue(buildDraftValue(column.question, answer?.value ?? null));
    setPeopleSearch('');
    setError(null);
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
    setDraftValue('');
    setPeopleSearch('');
  };

  const saveCellEdit = async (response: SurveyResponseRecord, column: QuestionColumn) => {
    if (!surveyId) return;

    const saveValue = buildSaveValue(column.question, draftValue);
    const nextAnswer: SurveyResponseSaveAnswer = {
      questionId: column.question._id || column.key,
      blockType: column.question.blockType,
      value: saveValue,
      valueType: getValueType(saveValue)
    };
    const nextByKey = new Map<string, SurveyResponseSaveAnswer>();
    const knownQuestionKeys = new Set(questionColumns.map((item) => item.key));
    const unmatchedAnswers: SurveyResponseSaveAnswer[] = [];

    (response.answers || []).forEach((answer) => {
      const answerKey = getAnswerQuestionKey(answer);
      const saveAnswer = normalizeAnswerForSave(answer);
      if (!saveAnswer) return;
      if (knownQuestionKeys.has(answerKey)) {
        nextByKey.set(answerKey, saveAnswer);
      } else {
        unmatchedAnswers.push(saveAnswer);
      }
    });
    nextByKey.set(column.key, nextAnswer);

    const nextAnswers = [
      ...questionColumns
        .map((questionColumn) => nextByKey.get(questionColumn.key))
        .filter((answer): answer is SurveyResponseSaveAnswer => Boolean(answer)),
      ...unmatchedAnswers
    ];

    try {
      setSavingCellKey(`${response._id}:${column.key}`);
      setError(null);
      await api.editSurveyResponse(surveyId, response._id, {
        answers: nextAnswers,
        editReason: `Updated ${column.prompt}`
      });
      cancelCellEdit();
      await loadResponses();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update response field');
    } finally {
      setSavingCellKey(null);
    }
  };

  const updateCheckboxDraft = (optionValue: string) => {
    setDraftValue((current) => {
      const currentValues = Array.isArray(current) ? current.map((item) => String(item)) : [];
      return currentValues.includes(optionValue)
        ? currentValues.filter((item) => item !== optionValue)
        : [...currentValues, optionValue];
    });
  };

  const addPeopleDraft = (person: RosterPerson) => {
    setDraftValue((current) => {
      const currentPeople = Array.isArray(current) ? (current as RosterPerson[]) : [];
      if (currentPeople.some((item) => item.memberId === person.memberId)) return currentPeople;
      return [...currentPeople, person];
    });
    setPeopleSearch('');
  };

  const removePeopleDraft = (memberId: string) => {
    setDraftValue((current) => {
      const currentPeople = Array.isArray(current) ? (current as RosterPerson[]) : [];
      return currentPeople.filter((item) => item.memberId !== memberId);
    });
  };

  const renderCellEditor = (response: SurveyResponseRecord, column: QuestionColumn) => {
    const question = column.question;
    const saving = savingCellKey === `${response._id}:${column.key}`;
    const editorShell = (children: React.ReactNode) => (
      <div className="min-w-[220px] space-y-2">
        {children}
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" onClick={cancelCellEdit} disabled={saving} className="px-2">
            <X size={14} />
          </Button>
          <Button variant="primary" size="sm" onClick={() => saveCellEdit(response, column)} disabled={saving} className="px-2">
            <Save size={14} />
          </Button>
        </div>
      </div>
    );

    if (question.blockType === 'paragraph') {
      return editorShell(
        <textarea
          value={String(draftValue || '')}
          onChange={(event) => setDraftValue(event.target.value)}
          className="min-h-[90px] w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      );
    }

    if (question.blockType === 'multiple_choice' || question.blockType === 'dropdown') {
      return editorShell(
        <select
          value={String(draftValue || '')}
          onChange={(event) => setDraftValue(event.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">No answer</option>
          {(question.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (question.blockType === 'checkboxes') {
      const draftValues = Array.isArray(draftValue) ? draftValue.map((item) => String(item)) : [];
      return editorShell(
        <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2">
          {(question.options || []).map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={draftValues.includes(option.value)}
                onChange={() => updateCheckboxDraft(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (question.blockType === 'linear_scale') {
      const min = Number(question.linearScale?.min || 1);
      const max = Number(question.linearScale?.max || 5);
      return editorShell(
        <input
          type="number"
          min={min}
          max={max}
          value={String(draftValue || '')}
          onChange={(event) => setDraftValue(event.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      );
    }

    if (question.blockType === 'people') {
      const selectedPeople = Array.isArray(draftValue) ? (draftValue as RosterPerson[]) : [];
      const selectedIds = new Set(selectedPeople.map((person) => person.memberId));
      const query = peopleSearch.trim().toLowerCase();
      const suggestions = query
        ? rosterPeople
            .filter((person) => !selectedIds.has(person.memberId))
            .filter((person) => person.name.toLowerCase().includes(query))
            .slice(0, 8)
        : [];

      return editorShell(
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {selectedPeople.length === 0 ? (
              <span className="text-xs text-gray-500">No people selected</span>
            ) : (
              selectedPeople.map((person) => (
                <span
                  key={person.memberId}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800"
                >
                  {person.name}
                  <button
                    type="button"
                    onClick={() => removePeopleDraft(person.memberId)}
                    className="text-emerald-700 hover:text-emerald-900"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={peopleSearch}
              onChange={(event) => setPeopleSearch(event.target.value)}
              className="w-full rounded border border-gray-300 py-1 pl-8 pr-2 text-sm"
              placeholder="Search roster names"
            />
          </div>
          {query && (
            <div className="max-h-40 overflow-y-auto rounded border border-gray-200 bg-white">
              {suggestions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">No roster members found.</p>
              ) : (
                suggestions.map((person) => (
                  <button
                    type="button"
                    key={person.memberId}
                    onClick={() => addPeopleDraft(person)}
                    className="w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 last:border-b-0"
                  >
                    {person.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      );
    }

    if (
      question.blockType === 'multiple_choice_grid' ||
      question.blockType === 'checkbox_grid' ||
      question.blockType === 'unsupported'
    ) {
      return editorShell(
        <textarea
          value={String(draftValue || '')}
          onChange={(event) => setDraftValue(event.target.value)}
          className="min-h-[110px] w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs"
        />
      );
    }

    return editorShell(
      <input
        type={question.blockType === 'date' ? 'date' : question.blockType === 'time' ? 'time' : 'text'}
        value={String(draftValue || '')}
        onChange={(event) => setDraftValue(event.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
      />
    );
  };

  const renderAnswerCell = (response: SurveyResponseRecord, column: QuestionColumn) => {
    const isEditing = editingCell?.responseId === response._id && editingCell.questionKey === column.key;
    if (isEditing) return renderCellEditor(response, column);

    return (
      <button
        type="button"
        onClick={() => startCellEdit(response, column)}
        className="group flex w-full items-start justify-between gap-2 rounded px-2 py-1 text-left hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200 survey-print-static"
        title="Edit field"
      >
        <span className="whitespace-pre-wrap">{getAnswerText(response, column)}</span>
        <Edit size={13} className="mt-0.5 shrink-0 text-gray-300 group-hover:text-blue-600 survey-print-hidden" />
      </button>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 survey-response-page">
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

          .survey-print-static {
            display: block !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            color: inherit !important;
            text-align: left !important;
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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 survey-print-hidden">
        <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center gap-2">
          <ArrowLeft size={16} />
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={!survey || filteredResponses.length === 0} className="flex items-center gap-2">
            <FileText size={16} />
            Export CSV
          </Button>
          <Button variant="primary" onClick={handlePrint} className="flex items-center gap-2">
            <FileText size={16} />
            Print Responses
          </Button>
        </div>
      </div>

      <div className="mb-6 survey-print-card">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardList size={24} className="text-custom-primary survey-print-hidden" />
          <h1 className="text-h1 font-lato-bold text-custom-text">{survey?.title || 'Survey Responses'}</h1>
          {survey && (
            <Badge variant={survey.status === 'draft' ? 'warning' : survey.status === 'sent' ? 'info' : 'neutral'}>
              {survey.status}
            </Badge>
          )}
        </div>
        {survey?.description && (
          <p className="mt-1 max-w-4xl text-sm text-custom-text-secondary">
            {stripHtmlToText(survey.description)}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 survey-print-hidden">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="p-8 text-center text-sm text-gray-500">Loading survey responses...</Card>
      ) : !survey ? (
        <Card className="p-8 text-center text-sm text-red-600">Survey not found.</Card>
      ) : (
        <div className="space-y-6">
          <div className="survey-print-card">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Summary</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <MetricCard
                title="Responses"
                count={summary.responseCount}
                icon={<Users className="h-6 w-6 text-purple-600" />}
                colorClass="text-purple-600"
                percentage={calculatePercentage(summary.responseCount)}
              />
              <MetricCard
                title="People Covered"
                count={summary.peopleCoveredCount}
                icon={<CheckCircle className="h-6 w-6 text-emerald-600" />}
                colorClass="text-emerald-600"
              />
              <MetricCard
                title="Arrivals"
                count={summary.metricTotals.arrival}
                icon={<Calendar className="h-6 w-6 text-blue-600" />}
                colorClass="text-blue-600"
              />
              <MetricCard
                title="Departures"
                count={summary.metricTotals.departure}
                icon={<Clock className="h-6 w-6 text-green-600" />}
                colorClass="text-green-600"
              />
              <MetricCard
                title="RVs"
                count={summary.metricTotals.rv}
                icon={<Car className="h-6 w-6 text-orange-600" />}
                colorClass="text-orange-600"
              />
              <MetricCard
                title="Tents"
                count={summary.metricTotals.tent}
                icon={<Home className="h-6 w-6 text-slate-600" />}
                colorClass="text-slate-600"
              />
              <MetricCard
                title="Shade"
                count={summary.metricTotals.shade}
                icon={<ClipboardList className="h-6 w-6 text-red-600" />}
                colorClass="text-red-600"
              />
            </div>
          </div>

          <div className="survey-print-hidden">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="flex items-center text-lg font-semibold text-gray-900">
                <Filter className="mr-2 h-5 w-5" />
                Quick Filters
              </h3>
              <div className="relative w-full lg:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm"
                  placeholder="Search responses"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {quickFilters.length > 0 ? (
                quickFilters.map((filter) => (
                  <FilterButton
                    key={filter.key}
                    label={filter.label}
                    count={filter.count}
                    isActive={activeFilters.includes(filter.key)}
                    onClick={() => toggleFilter(filter.key)}
                    variant={filter.variant}
                  />
                ))
              ) : (
                <p className="text-sm text-gray-500">No arrival, departure, RV, tent, or shade fields were detected on this survey.</p>
              )}
              {(activeFilters.length > 0 || searchQuery) && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="ml-2 text-gray-600 hover:text-gray-800">
                  Clear All
                </Button>
              )}
            </div>
          </div>

          <Card className="overflow-hidden p-0 survey-print-card">
            <div className="survey-screen-overflow overflow-x-auto">
              <table className="w-full survey-response-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">#</th>
                    <th className="sticky left-0 z-20 min-w-[14rem] bg-gray-50 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                      Submitted By
                    </th>
                    <th className="min-w-[180px] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Completed For</th>
                    <th className="min-w-[140px] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Submitted</th>
                    <th className="min-w-[120px] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Edited</th>
                    {questionColumns.map((column) => (
                      <th key={column.key} className="min-w-[220px] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        <div className="space-y-1 normal-case tracking-normal">
                          {column.sectionTitle && (
                            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{column.sectionTitle}</div>
                          )}
                          <div className="text-sm font-semibold text-gray-700">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredResponses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={questionColumns.length + 5}
                        className="px-6 py-10 text-center text-sm text-gray-500"
                      >
                        No responses match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredResponses.map((response, index) => (
                      <tr key={response._id} className="align-top hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                        <td className="sticky left-0 z-10 bg-white px-6 py-4 text-sm font-medium text-gray-900 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                          {response.submitterName || 'Responder'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{getCoveredMembersText(response)}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {formatDateTime(response.submittedAt || response.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {formatDateTime(response.lastEditedAt || null)}
                        </td>
                        {questionColumns.map((column) => (
                          <td key={column.key} className="max-w-[340px] px-4 py-3 text-sm text-gray-700">
                            {renderAnswerCell(response, column)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 survey-print-hidden">
              <p className="text-sm text-gray-600">
                Showing <strong>{filteredResponses.length}</strong> of <strong>{responses.length}</strong> responses
                {(activeFilters.length > 0 || searchQuery) && (
                  <span className="ml-2 text-blue-600">
                    ({activeFilters.length + (searchQuery ? 1 : 0)} filter{activeFilters.length + (searchQuery ? 1 : 0) > 1 ? 's' : ''} applied)
                  </span>
                )}
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SurveyResponses;
