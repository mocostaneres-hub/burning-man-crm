import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Badge, Button, Card, Modal } from '../../components/ui';
import { Survey, SurveyQuestion } from '../../types';
import { Plus, Send, Clock, ClipboardList, Eye } from 'lucide-react';

type AssignmentMode = 'ALL_ROSTER' | 'LEADS_ONLY' | 'SELECTED_USERS';

const defaultQuestion = (): SurveyQuestion => ({
  order: 0,
  blockType: 'short_answer',
  prompt: '',
  required: false,
  options: [],
  supportLevel: 'supported'
});

const optionBlockTypes = new Set(['multiple_choice', 'checkboxes', 'dropdown']);

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

const CampSurveys: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { campIdentifier } = useParams<{ campIdentifier?: string }>();

  const [campId, setCampId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([defaultQuestion()]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [descriptionPreviewMode, setDescriptionPreviewMode] = useState(false);
  const descriptionEditorRef = useRef<HTMLDivElement | null>(null);
  const [descriptionEditorInitialHtml, setDescriptionEditorInitialHtml] = useState('');

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const [assignmentModeBySurvey, setAssignmentModeBySurvey] = useState<Record<string, AssignmentMode>>({});
  const [selectedUsersBySurvey, setSelectedUsersBySurvey] = useState<Record<string, string[]>>({});
  const [rosterUsers, setRosterUsers] = useState<Array<{ userId: string; name: string; isLead: boolean }>>([]);
  const [sendingSurveyId, setSendingSurveyId] = useState<string | null>(null);
  const [closingSurveyId, setClosingSurveyId] = useState<string | null>(null);

  const [responsesModalOpen, setResponsesModalOpen] = useState(false);
  const [activeResponsesSurvey, setActiveResponsesSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editingAnswersJson, setEditingAnswersJson] = useState<string>('');
  const [savingResponse, setSavingResponse] = useState(false);

  const canImportFromPublicLink = useMemo(
    () => user?.accountType === 'camp' || (user?.accountType === 'admin' && !!user?.campId),
    [user?.accountType, user?.campId]
  );

  const canManageCamp = useMemo(
    () => user?.accountType === 'camp' || user?.isCampLead === true || (user?.accountType === 'admin' && !!user?.campId),
    [user?.accountType, user?.isCampLead, user?.campId]
  );

  const loadCampContext = useCallback(async () => {
    if (!user) return '';
    if (user.accountType === 'camp' || (user.accountType === 'admin' && user.campId)) {
      const myCamp = await api.getMyCamp();
      return myCamp?._id?.toString?.() || '';
    }
    if (user.isCampLead && user.campLeadCampId) {
      return user.campLeadCampId;
    }
    return '';
  }, [user]);

  const loadSurveys = useCallback(
    async (resolvedCampId?: string) => {
      try {
        const cid = resolvedCampId || campId;
        if (!cid) return;
        setLoading(true);
        const [surveyRes, memberRes] = await Promise.all([
          api.getCampSurveys(cid),
          api.getCampMembers(cid)
        ]);
        setSurveys(surveyRes.surveys || []);
        const users = (memberRes.members || [])
          .map((member: any) => {
            const userDoc = member.user;
            if (!userDoc || !userDoc._id) return null;
            const name = `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || userDoc.email || 'Member';
            return {
              userId: userDoc._id,
              name,
              isLead:
                member.isCampLead === true ||
                ['camp-lead', 'project-lead', 'lead', 'admin'].includes(String(member.role || '').toLowerCase())
            };
          })
          .filter(Boolean);
        setRosterUsers(users as Array<{ userId: string; name: string; isLead: boolean }>);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load surveys');
      } finally {
        setLoading(false);
      }
    },
    [campId]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resolvedCampId = await loadCampContext();
        if (!mounted) return;
        if (!resolvedCampId) {
          setError('Unable to resolve camp context');
          setLoading(false);
          return;
        }
        if (campIdentifier && campIdentifier !== resolvedCampId && campIdentifier !== user?.campLeadCampSlug) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setCampId(resolvedCampId);
        await loadSurveys(resolvedCampId);
      } catch (err: any) {
        if (mounted) {
          setError(err?.response?.data?.message || 'Failed to initialize surveys');
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [campIdentifier, loadCampContext, loadSurveys, navigate, user?.campLeadCampSlug]);

  useEffect(() => {
    const editSurveyId = searchParams.get('editSurveyId');
    if (!editSurveyId || editorOpen || surveys.length === 0) return;
    const targetSurvey = surveys.find((survey) => survey._id === editSurveyId);
    if (!targetSurvey) return;

    openEditModal(targetSurvey);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('editSurveyId');
    setSearchParams(nextParams, { replace: true });
  }, [editorOpen, searchParams, setSearchParams, surveys]);

  const resetEditor = () => {
    setEditingSurveyId(null);
    setTitle('');
    setDescription('');
    setDescriptionEditorInitialHtml('');
    setQuestions([defaultQuestion()]);
    setImportWarnings([]);
    setDescriptionPreviewMode(false);
  };

  const openCreateModal = () => {
    resetEditor();
    setEditorOpen(true);
    setTimeout(() => {
      if (descriptionEditorRef.current) {
        descriptionEditorRef.current.innerHTML = '';
      }
    }, 0);
  };

  const openEditModal = async (survey: Survey) => {
    try {
      const detail = await api.getSurveyDetails(survey._id);
      const nextDescription = detail.survey.description || '';
      setEditingSurveyId(survey._id);
      setTitle(detail.survey.title || '');
      setDescription(nextDescription);
      setDescriptionEditorInitialHtml(nextDescription);
      setQuestions((detail.questions || []).map((question: any, index: number) => ({ ...question, order: index })));
      setEditorOpen(true);
      setDescriptionPreviewMode(false);
      setTimeout(() => {
        if (descriptionEditorRef.current) {
          descriptionEditorRef.current.innerHTML = nextDescription;
        }
      }, 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load survey details');
    }
  };

  useEffect(() => {
    if (!editorOpen || !descriptionEditorRef.current) return;
    descriptionEditorRef.current.innerHTML = descriptionEditorInitialHtml || '';
  }, [editorOpen, editingSurveyId, descriptionEditorInitialHtml]);

  const setQuestion = (index: number, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) => (qIndex === index ? { ...question, ...patch, order: qIndex } : question))
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { ...defaultQuestion(), order: prev.length }]);
  };

  const reorderQuestions = (fromIndex: number, toIndex: number) => {
    setQuestions((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((question, index) => ({ ...question, order: index }));
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index).map((question, i) => ({ ...question, order: i })));
  };

  const addOptionField = (questionIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) =>
        qIndex === questionIndex
          ? {
              ...question,
              options: [...(question.options || []), { label: '', value: '' }]
            }
          : question
      )
    );
  };

  const setOptionField = (questionIndex: number, optionIndex: number, nextLabel: string) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) => {
        if (qIndex !== questionIndex) return question;
        const nextOptions = [...(question.options || [])];
        nextOptions[optionIndex] = {
          ...(nextOptions[optionIndex] || { isOther: false }),
          label: nextLabel,
          value: nextLabel
        };
        return { ...question, options: nextOptions };
      })
    );
  };

  const removeOptionField = (questionIndex: number, optionIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) => {
        if (qIndex !== questionIndex) return question;
        const nextOptions = [...(question.options || [])].filter((_, index) => index !== optionIndex);
        return { ...question, options: nextOptions };
      })
    );
  };

  const reorderOptionFields = (questionIndex: number, fromIndex: number, toIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) => {
        if (qIndex !== questionIndex) return question;
        const nextOptions = [...(question.options || [])];
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= nextOptions.length ||
          toIndex >= nextOptions.length
        ) {
          return question;
        }
        const [moved] = nextOptions.splice(fromIndex, 1);
        nextOptions.splice(toIndex, 0, moved);
        return { ...question, options: nextOptions };
      })
    );
  };

  const handleQuestionTypeChange = (questionIndex: number, nextType: SurveyQuestion['blockType']) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) => {
        if (qIndex !== questionIndex) return question;
        if (optionBlockTypes.has(nextType)) {
          const currentOptions = Array.isArray(question.options) ? question.options : [];
          return {
            ...question,
            blockType: nextType,
            options: currentOptions.length > 0 ? currentOptions : [{ label: '', value: '' }]
          };
        }
        return { ...question, blockType: nextType };
      })
    );
  };

  const applyDescriptionFormat = (command: string) => {
    document.execCommand(command, false);
    if (descriptionEditorRef.current) {
      setDescription(descriptionEditorRef.current.innerHTML);
    }
  };

  const insertDescriptionLink = () => {
    const href = window.prompt('Enter URL', 'https://');
    if (!href) return;
    document.execCommand('createLink', false, href);
    if (descriptionEditorRef.current) {
      setDescription(descriptionEditorRef.current.innerHTML);
    }
  };

  const openSurveyViewMode = (surveyId: string) => {
    navigate(`/surveys/${surveyId}?mode=view`);
  };

  const saveDraft = async () => {
    if (!campId || !title.trim()) {
      setError('Survey title is required');
      return;
    }
    const sanitizedQuestions = questions
      .map((question, index) => ({
        ...question,
        order: index,
        prompt: String(question.prompt || '').trim(),
        options: Array.isArray(question.options)
          ? question.options
              .map((option) => {
                const nextLabel = String(option.label || option.value || '').trim();
                return {
                  ...option,
                  label: nextLabel,
                  value: nextLabel
                };
              })
              .filter((option) => option.label && option.value)
          : []
      }))
      .filter((question) => question.blockType === 'section_header' || question.blockType === 'description' || question.prompt);

    if (sanitizedQuestions.length === 0) {
      setError('Add at least one question or section before saving');
      return;
    }

    try {
      setSavingDraft(true);
      setError(null);
      if (editingSurveyId) {
        await api.updateSurveyDraft(editingSurveyId, {
          title: title.trim(),
          description: description.trim(),
          questions: sanitizedQuestions
        });
      } else {
        await api.createSurveyDraft({
          campId,
          title: title.trim(),
          description: description.trim(),
          questions: sanitizedQuestions
        });
      }
      setEditorOpen(false);
      resetEditor();
      await loadSurveys();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save survey draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const runImportSuggestion = async () => {
    if (!campId || !importUrl.trim()) return;
    try {
      setImportLoading(true);
      setError(null);
      const response = await api.importSurveyFromPublicForm({
        campId,
        url: importUrl.trim(),
        saveDraft: true
      });
      if (response.survey) {
        setImportWarnings(response.survey.importWarnings || response.suggestion?.warnings || []);
        setImportModalOpen(false);
        setImportUrl('');
        await loadSurveys();
      } else {
        setError(response?.message || 'Could not parse this form. You can continue manually.');
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'Public form could not be imported. You can continue by creating your survey manually.'
      );
    } finally {
      setImportLoading(false);
    }
  };

  const handleSendSurvey = async (survey: Survey) => {
    try {
      setSendingSurveyId(survey._id);
      setError(null);
      const assignmentMode = assignmentModeBySurvey[survey._id] || 'ALL_ROSTER';
      const selectedUserIds = selectedUsersBySurvey[survey._id] || [];
      await api.sendSurvey(survey._id, {
        assignmentMode,
        selectedUserIds
      });
      await loadSurveys();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send survey');
    } finally {
      setSendingSurveyId(null);
    }
  };

  const handleCloseSurvey = async (survey: Survey) => {
    try {
      setClosingSurveyId(survey._id);
      setError(null);
      await api.closeSurvey(survey._id);
      await loadSurveys();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to close survey');
    } finally {
      setClosingSurveyId(null);
    }
  };

  const openResponsesModal = async (survey: Survey) => {
    try {
      setActiveResponsesSurvey(survey);
      setResponsesModalOpen(true);
      setEditingResponseId(null);
      setEditingAnswersJson('');
      const response = await api.getSurveyResponses(survey._id);
      setResponses(response.responses || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load survey responses');
    }
  };

  const startEditResponse = (response: any) => {
    setEditingResponseId(response._id);
    setEditingAnswersJson(JSON.stringify(response.answers || [], null, 2));
  };

  const saveEditedResponse = async () => {
    if (!activeResponsesSurvey || !editingResponseId) return;
    try {
      setSavingResponse(true);
      const parsedAnswers = JSON.parse(editingAnswersJson);
      await api.editSurveyResponse(activeResponsesSurvey._id, editingResponseId, {
        answers: parsedAnswers,
        editReason: 'Updated from camp survey manager'
      });
      const response = await api.getSurveyResponses(activeResponsesSurvey._id);
      setResponses(response.responses || []);
      setEditingResponseId(null);
      setEditingAnswersJson('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update response');
    } finally {
      setSavingResponse(false);
    }
  };

  if (!canManageCamp) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <Card className="p-6">
          <p className="text-red-600">Camp management access is required to use surveys.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-h1 font-lato-bold text-custom-text">Surveys</h1>
          <p className="text-sm text-custom-text-secondary">Create draft surveys, import suggestions, and send to roster members.</p>
        </div>
        <div className="flex items-center gap-2">
          {canImportFromPublicLink && (
            <Button variant="outline" onClick={() => setImportModalOpen(true)} className="flex items-center gap-2">
              <ClipboardList size={16} />
              Create from public form link
            </Button>
          )}
          <Button variant="primary" onClick={openCreateModal} className="flex items-center gap-2">
            <Plus size={16} />
            New Survey
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {importWarnings.length > 0 && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          <p className="font-medium mb-1">Imported survey warnings</p>
          <ul className="list-disc list-inside space-y-1">
            {importWarnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <Card className="p-8 text-center text-sm text-gray-500">Loading surveys...</Card>
      ) : surveys.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="mx-auto mb-3 text-gray-400" />
          <p className="text-custom-text-secondary">No surveys yet. Create your first draft to get started.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {surveys.map((survey) => {
            const assignmentMode = assignmentModeBySurvey[survey._id] || 'ALL_ROSTER';
            const selectedUsers = selectedUsersBySurvey[survey._id] || [];
            return (
              <Card key={survey._id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold text-custom-text truncate">{survey.title}</h2>
                      <Badge variant={survey.status === 'draft' ? 'warning' : survey.status === 'sent' ? 'info' : 'neutral'}>
                        {survey.status}
                      </Badge>
                      {survey.isLocked && <Clock size={14} className="text-gray-500" />}
                    </div>
                    <p className="text-sm text-custom-text-secondary mb-2">{stripHtmlToText(survey.description || '') || 'No description'}</p>
                    {survey.completionStats && (
                      <p className="text-xs text-gray-600">
                        Completion: {survey.completionStats.completedMembers}/{survey.completionStats.totalRosterMembers} ({survey.completionStats.completionRate}%)
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 lg:w-[360px]">
                    {survey.status === 'draft' && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <label className="col-span-1 sm:col-span-1">
                            <span className="block text-gray-600 mb-1">Targeting</span>
                            <select
                              value={assignmentMode}
                              onChange={(e) =>
                                setAssignmentModeBySurvey((prev) => ({
                                  ...prev,
                                  [survey._id]: e.target.value as AssignmentMode
                                }))
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="ALL_ROSTER">All roster</option>
                              <option value="LEADS_ONLY">Leads only</option>
                              <option value="SELECTED_USERS">Selected users</option>
                            </select>
                          </label>
                          {assignmentMode === 'SELECTED_USERS' && (
                            <div className="col-span-1 sm:col-span-2 border border-gray-200 rounded p-2 max-h-28 overflow-y-auto">
                              {rosterUsers.map((rosterUser) => (
                                <label key={rosterUser.userId} className="flex items-center gap-2 text-xs py-0.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedUsers.includes(rosterUser.userId)}
                                    onChange={() =>
                                      setSelectedUsersBySurvey((prev) => {
                                        const current = prev[survey._id] || [];
                                        const exists = current.includes(rosterUser.userId);
                                        return {
                                          ...prev,
                                          [survey._id]: exists
                                            ? current.filter((id) => id !== rosterUser.userId)
                                            : [...current, rosterUser.userId]
                                        };
                                      })
                                    }
                                  />
                                  <span>{rosterUser.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openSurveyViewMode(survey._id)} className="flex items-center gap-1">
                            <Eye size={14} />
                            Open View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditModal(survey)}>
                            Edit Draft
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex items-center gap-1"
                            onClick={() => handleSendSurvey(survey)}
                            disabled={sendingSurveyId === survey._id}
                          >
                            <Send size={14} />
                            {sendingSurveyId === survey._id ? 'Sending...' : 'Send Survey'}
                          </Button>
                        </div>
                      </>
                    )}

                    {survey.status !== 'draft' && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openSurveyViewMode(survey._id)} className="flex items-center gap-1">
                          <Eye size={14} />
                          Open View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openResponsesModal(survey)}>
                          Review Responses
                        </Button>
                        {survey.status === 'sent' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCloseSurvey(survey)}
                            disabled={closingSurveyId === survey._id}
                          >
                            {closingSurveyId === survey._id ? 'Closing...' : 'Close Survey'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={editorOpen} onClose={() => setEditorOpen(false)} title={editingSurveyId ? 'Edit Survey Draft' : 'Create Survey Draft'} size="xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Survey title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Volunteer Preferences Survey"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <div className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => applyDescriptionFormat('bold')}>Bold</Button>
                <Button variant="outline" size="sm" onClick={() => applyDescriptionFormat('italic')}>Italic</Button>
                <Button variant="outline" size="sm" onClick={() => applyDescriptionFormat('insertUnorderedList')}>Bullets</Button>
                <Button variant="outline" size="sm" onClick={insertDescriptionLink}>Link</Button>
                <Button
                  variant={descriptionPreviewMode ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setDescriptionPreviewMode((prev) => !prev)}
                >
                  {descriptionPreviewMode ? 'Editing' : 'Preview'}
                </Button>
              </div>
              {!descriptionPreviewMode ? (
                <div
                  ref={descriptionEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => setDescription(descriptionEditorRef.current?.innerHTML || '')}
                  className="min-h-[120px] p-3 outline-none text-sm"
                />
              ) : (
                <div
                  className="min-h-[120px] p-3 text-sm prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(description || '<p class="text-gray-500">No description yet.</p>') }}
                />
              )}
            </div>
            <div className="mt-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              <p className="font-semibold mb-1">Formatting guide</p>
              <p>Use bold, italic, bullets, and links to explain survey context. Toggle preview to check exactly what roster members will read.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-custom-text">Questions</h3>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                Add Question
              </Button>
            </div>
            {questions.map((question, index) => (
              <div key={`question-${index}`} className="border border-gray-200 rounded p-3 space-y-2">
                <div
                  className="flex justify-between items-center cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-question-index', String(index));
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const fromIndexRaw = event.dataTransfer.getData('application/x-question-index');
                    const fromIndex = Number(fromIndexRaw);
                    if (Number.isFinite(fromIndex)) {
                      reorderQuestions(fromIndex, index);
                    }
                  }}
                >
                  <p className="text-xs font-semibold text-gray-600">
                    Question #{index + 1} <span className="text-gray-400 ml-1">(drag to reorder)</span>
                  </p>
                  <span className="text-gray-400 text-sm">::</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Prompt</label>
                    <input
                      value={question.prompt}
                      onChange={(e) => setQuestion(index, { prompt: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1"
                      placeholder="Question prompt"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Type</label>
                    <select
                      value={question.blockType}
                      onChange={(e) => handleQuestionTypeChange(index, e.target.value as any)}
                      className="w-full border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="short_answer">Short Answer</option>
                      <option value="paragraph">Paragraph</option>
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="checkboxes">Checkboxes</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="linear_scale">Linear Scale</option>
                      <option value="date">Date</option>
                      <option value="time">Time</option>
                      <option value="section_header">Section Header</option>
                    </select>
                  </div>
                </div>

                {optionBlockTypes.has(question.blockType) && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">Options</label>
                    <div className="space-y-2">
                      {(question.options || []).map((option, optionIndex) => (
                        <div
                          key={`option-${index}-${optionIndex}`}
                          className="flex items-center gap-2 cursor-grab active:cursor-grabbing"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData(
                              'application/x-option-index',
                              JSON.stringify({ questionIndex: index, optionIndex })
                            );
                            event.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            const payload = event.dataTransfer.getData('application/x-option-index');
                            if (!payload) return;
                            try {
                              const parsed = JSON.parse(payload);
                              if (parsed.questionIndex !== index) return;
                              const fromIndex = Number(parsed.optionIndex);
                              if (Number.isFinite(fromIndex)) {
                                reorderOptionFields(index, fromIndex, optionIndex);
                              }
                            } catch (_error) {
                              // Ignore malformed drag payload
                            }
                          }}
                        >
                          <span className="text-gray-400 text-sm">::</span>
                          <input
                            value={option.label}
                            onChange={(e) => setOptionField(index, optionIndex, e.target.value)}
                            className="flex-1 border border-gray-300 rounded px-2 py-1"
                            placeholder={`Option ${optionIndex + 1}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeOptionField(index, optionIndex)}
                            disabled={(question.options || []).length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => addOptionField(index)}>
                        Add Option
                      </Button>
                    </div>
                  </div>
                )}

                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={question.required === true}
                    onChange={(e) => setQuestion(index, { required: e.target.checked })}
                  />
                  Required question
                </label>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => removeQuestion(index)} disabled={questions.length === 1}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {editingSurveyId && (
              <Button variant="outline" onClick={() => openSurveyViewMode(editingSurveyId)}>
                Preview as Recipient
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveDraft} disabled={savingDraft}>
              {savingDraft ? 'Saving...' : editingSurveyId ? 'Save Draft' : 'Create Draft'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Create from public form link" size="md">
        <div className="space-y-4">
          <p className="text-sm text-custom-text-secondary">
            Paste a publicly accessible form URL. G8Road will suggest a similar draft survey. Private/protected forms are rejected.
          </p>
          <input
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="https://example.com/public-form"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={runImportSuggestion} disabled={importLoading || !importUrl.trim()}>
              {importLoading ? 'Analyzing...' : 'Generate Draft Suggestion'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={responsesModalOpen}
        onClose={() => {
          setResponsesModalOpen(false);
          setEditingResponseId(null);
          setEditingAnswersJson('');
          setResponses([]);
          setActiveResponsesSurvey(null);
        }}
        title={activeResponsesSurvey ? `Responses · ${activeResponsesSurvey.title}` : 'Responses'}
        size="xl"
      >
        <div className="space-y-3">
          {responses.length === 0 ? (
            <p className="text-sm text-gray-500">No responses submitted yet.</p>
          ) : (
            responses.map((response) => (
              <div key={response._id} className="border border-gray-200 rounded p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium text-sm">{response.submitterName || 'Responder'}</p>
                    <p className="text-xs text-gray-500">
                      Covered: {(response.coveredMembers || []).map((member: any) => member.name).join(', ') || 'None'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => startEditResponse(response)}>
                    Edit Response
                  </Button>
                </div>
                <div className="text-xs text-gray-600">
                  {(response.answers || []).length} answer field(s)
                </div>
              </div>
            ))
          )}

          {editingResponseId && (
            <div className="border border-blue-200 bg-blue-50 rounded p-3 space-y-2">
              <p className="text-sm font-medium text-blue-900">Editing response answers (JSON)</p>
              <textarea
                value={editingAnswersJson}
                onChange={(e) => setEditingAnswersJson(e.target.value)}
                className="w-full min-h-[180px] border border-blue-200 rounded px-2 py-2 text-xs font-mono"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingResponseId(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={saveEditedResponse} disabled={savingResponse}>
                  {savingResponse ? 'Saving...' : 'Save Response'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default CampSurveys;
