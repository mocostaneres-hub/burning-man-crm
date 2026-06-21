import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Card, Modal, Input, TimePicker } from '../../components/ui';
import { Calendar, Users, Plus, Eye, Edit, Trash2, Save, X } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Event } from '../../types';
import { formatShiftDate, formatShiftTime, formatDate, utcToPdtDateInput, utcToPdtTimeInput, PDT_LABEL } from '../../utils/dateFormatters';
import { useSkills } from '../../hooks/useSkills';

const deriveRosterMeta = (roster: any) => {
  const members = Array.isArray(roster?.members) ? roster.members : [];
  const analyzed = members.map((entry: any) => {
    const member = entry?.member || {};
    const signupSource = String(member?.signupSource || '').toLowerCase();
    const isShiftsOnly = member?.isShiftsOnly === true || signupSource === 'shifts_only_invite' || member?.status === 'roster_only';
    const isFullMembership = member?.isShiftsOnly === false
      || signupSource === 'application'
      || signupSource === 'standard_invite'
      || (!isShiftsOnly && Boolean(member?.user));
    return { isShiftsOnly, isFullMembership };
  });
  return {
    hasActiveRoster: Boolean(roster?._id),
    memberCount: members.length,
    hasShiftsOnlyRoster: analyzed.some((entry) => entry.isShiftsOnly),
    hasFullMembershipRoster: analyzed.some((entry) => entry.isFullMembership)
  };
};

type RosterMemberLite = {
  _id: string;
  memberId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  isLead: boolean;
  skills?: string[];
};

type ReportMember = {
  id: string;
  personName: string;
  email?: string;
  link?: string;
};

type PersonReportRow = {
  personName: string;
  member: ReportMember;
  date: string;
  dateValue: string;
  eventName: string;
  shiftTitle: string;
  shiftTime: string;
  description: string;
};

type ShiftReportRow = {
  eventName: string;
  shift: any;
  date: string;
  dateValue: string;
  shiftTime: string;
  description: string;
  signedUpMembers: ReportMember[];
};

type PersonReportGroup = {
  member: ReportMember;
  shifts: PersonReportRow[];
};

type DayReportGroup = {
  date: string;
  dateValue: string;
  shifts: ShiftReportRow[];
};

type ReportView = 'names' | 'shifts' | 'day';

const VolunteerShifts: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { campIdentifier } = useParams<{ campIdentifier?: string }>();
  const [events, setEvents] = useState<Event[]>([]);
  
  // Security check: Verify camp identifier matches authenticated user's camp
  useEffect(() => {
    if (campIdentifier && user) {
      if (user.accountType === 'camp' || (user.accountType === 'admin' && user.campId)) {
        const userCampId = user.campId?.toString() || user._id?.toString();
        const identifierMatches = campIdentifier === userCampId || 
                                  campIdentifier === user.urlSlug ||
                                  (user.campName && campIdentifier === user.campName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
        
        if (!identifierMatches) {
          console.error('❌ [VolunteerShifts] Camp identifier mismatch. Redirecting...');
          navigate('/dashboard', { replace: true });
          return;
        }
      } else if (user.isCampLead && user.campLeadCampId) {
        const identifierMatches = campIdentifier === user.campLeadCampId ||
                                  campIdentifier === user.campLeadCampSlug;
        if (!identifierMatches) {
          console.error('❌ [VolunteerShifts] Camp Lead trying to access wrong camp. Redirecting...');
          navigate('/dashboard', { replace: true });
        }
      }
    }
  }, [campIdentifier, user, navigate]);
  const [activeTab, setActiveTab] = useState<'main' | 'reports'>('main');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [selectedShiftForAssignment, setSelectedShiftForAssignment] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentState, setAssignmentState] = useState<{
    assignedUsers: Array<{ userId: string; firstName: string; lastName: string; email: string; playaName?: string; isLead?: boolean }>;
    unassignedUsers: Array<{ userId: string; firstName: string; lastName: string; email: string; playaName?: string; isLead?: boolean }>;
  }>({ assignedUsers: [], unassignedUsers: [] });
  const [pendingAddUserIds, setPendingAddUserIds] = useState<string[]>([]);
  const [loadingExistingAssignments, setLoadingExistingAssignments] = useState(false);
  const [reportType, setReportType] = useState<ReportView>('names');
  const [selectedDate, setSelectedDate] = useState('');
  const [bulkInviteLoading, setBulkInviteLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [bulkShiftSelection, setBulkShiftSelection] = useState<number[]>([]);
  const [bulkMaxSignupsInput, setBulkMaxSignupsInput] = useState(1);
  const [globalInviteMode, setGlobalInviteMode] = useState<'ALL_ROSTER' | 'LEADS_ONLY' | 'SELECTED_USERS'>('ALL_ROSTER');
  const [skipRecentDays, setSkipRecentDays] = useState(7);
  const [scheduleAt, setScheduleAt] = useState('');
  const [invitePreview, setInvitePreview] = useState<{ existingUsers: number; rosterOnly: number; total: number } | null>(null);
  const { skills: skillOptions } = useSkills();
  const shiftTemplates = [
    { key: 'morning', label: 'Morning Setup', startTime: '08:00', durationHours: 3 },
    { key: 'afternoon', label: 'Afternoon Ops', startTime: '13:00', durationHours: 4 },
    { key: 'evening', label: 'Evening Strike', startTime: '18:00', durationHours: 3 }
  ];

  // Form state for creating events
  const [eventForm, setEventForm] = useState({
    eventName: '',
    description: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    shifts: [] as Array<{
      _id?: string;
      title: string;
      description: string;
      date: string;
      startTime: string;
      endTime: string;
      maxSignUps: number;
      currentSignups: number;
      assignmentMode: 'ALL_ROSTER' | 'LEADS_ONLY' | 'SELECTED_USERS';
      selectedUserIds: string[];
      requiredSkills: string[];
    }>
  });
  const [rosterMembers, setRosterMembers] = useState<RosterMemberLite[]>([]);
  const [currentCampId, setCurrentCampId] = useState<string | null>(null);
  const [rosterMeta, setRosterMeta] = useState({
    hasActiveRoster: false,
    memberCount: 0,
    hasShiftsOnlyRoster: false,
    hasFullMembershipRoster: false
  });

  // Check if user has admin/lead access (including Camp Leads)
  const isCampContext = user?.accountType === 'camp' 
    || (user?.accountType === 'admin' && user?.campId)
    || (user?.isCampLead === true && user?.campLeadCampId);
  
  const isAdminOrLead = user?.accountType === 'admin' 
    || user?.accountType === 'camp'
    || (user?.isCampLead === true);
  
  const canAccessShifts = isCampContext && isAdminOrLead;

  const getShiftStats = (shift: any) => {
    const current = shift.memberIds?.length || 0;
    const max = shift.maxSignUps || 0;
    const remaining = Math.max(max - current, 0);
    const filledPercent = max > 0 ? Math.round((current / max) * 100) : 0;
    return { current, max, remaining, filledPercent };
  };

  const rosterMemberById = useMemo(() => {
    const lookup = new Map<string, RosterMemberLite>();
    rosterMembers.forEach((member) => {
      [member._id, member.memberId, member.userId].forEach((id) => {
        if (id) lookup.set(id.toString(), member);
      });
    });
    return lookup;
  }, [rosterMembers]);

  const getMemberDisplayName = useCallback((member: Pick<RosterMemberLite, 'firstName' | 'lastName'> | undefined) => {
    if (!member) return 'Unknown Member';
    return `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown Member';
  }, []);

  const getMember360Link = useCallback((member: RosterMemberLite | undefined) => {
    if (!member || !currentCampId) return undefined;
    return member.userId
      ? `/camp/${currentCampId}/contacts/${member.userId}`
      : `/camp/${currentCampId}/contacts/member/${member.memberId}`;
  }, [currentCampId]);

  const resolveReportMember = useCallback((memberId: any): ReportMember => {
    const id = memberId?.toString?.() || String(memberId || '');
    const member = rosterMemberById.get(id);
    return {
      id,
      personName: getMemberDisplayName(member),
      email: member?.email || undefined,
      link: getMember360Link(member)
    };
  }, [getMember360Link, getMemberDisplayName, rosterMemberById]);

  const normalizeRosterMember = useCallback((member: any): RosterMemberLite | null => {
    if (!member) return null;

    const memberDoc = member.member && typeof member.member === 'object'
      ? member.member
      : member;
    const nestedUser = memberDoc?.user && typeof memberDoc.user === 'object'
      ? memberDoc.user
      : null;
    const memberId = memberDoc?._id?.toString?.()
      || member?._id?.toString?.()
      || String(memberDoc?._id || member?._id || '');
    const userId = nestedUser?._id?.toString?.()
      || (typeof memberDoc?.user === 'string' ? memberDoc.user : undefined)
      || (typeof member.user === 'string' ? member.user : undefined);
    const fallbackName = memberDoc?.name || '';
    const [fallbackFirstName, ...fallbackLastNameParts] = fallbackName.split(' ').filter(Boolean);

    if (!memberId && !userId) return null;

    return {
      _id: userId || memberId,
      memberId,
      userId,
      firstName: nestedUser?.firstName || memberDoc?.firstName || fallbackFirstName || '',
      lastName: nestedUser?.lastName || memberDoc?.lastName || fallbackLastNameParts.join(' ') || '',
      email: nestedUser?.email || memberDoc?.email || '',
      isLead: member?.isCampLead === true
        || memberDoc?.isCampLead === true
        || ['camp-lead', 'project-lead', 'lead', 'admin'].includes((memberDoc?.role || member?.role || '').toLowerCase()),
      skills: Array.isArray(nestedUser?.skills)
        ? nestedUser.skills
        : Array.isArray(memberDoc?.skills)
          ? memberDoc.skills
          : []
    };
  }, []);

  const renderReportMember = (member: ReportMember, compact = false) => {
    const content = (
      <>
        <span className="font-medium">{member.personName}</span>
        {!compact && member.email && (
          <span className="text-xs text-gray-500">{member.email}</span>
        )}
      </>
    );
    const className = compact
      ? 'inline-flex items-center rounded-full bg-orange-50 text-orange-700 border border-orange-100 text-xs px-2.5 py-1 font-semibold hover:bg-orange-100'
      : 'inline-flex min-w-[12rem] flex-col rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-orange-700 hover:bg-orange-100';

    return member.link ? (
      <Link to={member.link} className={className}>
        {content}
      </Link>
    ) : (
      <span className={compact ? 'inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-1 font-medium' : 'inline-flex flex-col text-gray-700'}>
        {content}
      </span>
    );
  };

  const shiftReportRows = useMemo<ShiftReportRow[]>(() => {
    return events.flatMap((event) => (
      event.shifts.map((shift) => ({
        eventName: event.eventName,
        shift,
        date: formatShiftDate(shift.date),
        dateValue: utcToPdtDateInput(shift.date),
        shiftTime: `${formatShiftTime(shift.startTime)} – ${formatShiftTime(shift.endTime)}`,
        description: shift.description || shift.title,
        signedUpMembers: (shift.memberIds || []).map(resolveReportMember)
      }))
    ));
  }, [events, resolveReportMember]);

  const personReportRows = useMemo<PersonReportRow[]>(() => {
    return shiftReportRows.flatMap((row) => (
      row.signedUpMembers.map((member) => ({
        personName: member.personName,
        member,
        date: row.date,
        dateValue: row.dateValue,
        eventName: row.eventName,
        shiftTitle: row.shift.title,
        shiftTime: row.shiftTime,
        description: row.description
      }))
    ));
  }, [shiftReportRows]);

  const sortedShiftReportRows = useMemo(() => {
    return [...shiftReportRows].sort((a, b) => (
      new Date(a.shift.startTime).getTime() - new Date(b.shift.startTime).getTime()
      || a.eventName.localeCompare(b.eventName)
      || a.shift.title.localeCompare(b.shift.title)
    ));
  }, [shiftReportRows]);

  const personReportGroups = useMemo<PersonReportGroup[]>(() => {
    const groups = new Map<string, PersonReportGroup>();
    personReportRows.forEach((row) => {
      const key = row.member.id || row.personName;
      const existing = groups.get(key);
      if (existing) {
        existing.shifts.push(row);
      } else {
        groups.set(key, { member: row.member, shifts: [row] });
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        shifts: [...group.shifts].sort((a, b) => (
          a.dateValue.localeCompare(b.dateValue)
          || a.shiftTime.localeCompare(b.shiftTime)
          || a.shiftTitle.localeCompare(b.shiftTitle)
        ))
      }))
      .sort((a, b) => a.member.personName.localeCompare(b.member.personName));
  }, [personReportRows]);

  const shiftDateOptions = useMemo(() => {
    const options = new Map<string, string>();
    sortedShiftReportRows.forEach((row) => {
      if (row.dateValue) options.set(row.dateValue, row.date);
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [sortedShiftReportRows]);

  const dayReportGroups = useMemo<DayReportGroup[]>(() => {
    const groups = new Map<string, DayReportGroup>();
    sortedShiftReportRows.forEach((row) => {
      if (selectedDate && row.dateValue !== selectedDate) return;
      const key = row.dateValue || row.date;
      const existing = groups.get(key);
      if (existing) {
        existing.shifts.push(row);
      } else {
        groups.set(key, { date: row.date, dateValue: row.dateValue, shifts: [row] });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.dateValue.localeCompare(b.dateValue));
  }, [selectedDate, sortedShiftReportRows]);

  const reportLabels: Record<ReportView, { title: string; print: string }> = {
    names: { title: 'Names List', print: 'Print Names List' },
    shifts: { title: 'Shift Rosters', print: 'Print Per Shift' },
    day: { title: 'Day Sheet', print: 'Print Per Day' }
  };

  const allRosterIds = useMemo(() => rosterMembers.map((member) => member._id), [rosterMembers]);
  const leadRosterIds = useMemo(
    () => rosterMembers.filter((member) => member.isLead).map((member) => member._id),
    [rosterMembers]
  );
  useEffect(() => {
    if (!showCreateModal) return;
    setEventForm((prev) => {
      return {
        ...prev,
        shifts: prev.shifts.map((shift) => {
          if (shift.assignmentMode === 'ALL_ROSTER') {
            return { ...shift, selectedUserIds: allRosterIds };
          }
          if (shift.assignmentMode === 'LEADS_ONLY') {
            return { ...shift, selectedUserIds: leadRosterIds };
          }
          return shift;
        })
      };
    });
  }, [showCreateModal, allRosterIds, leadRosterIds]);

  const handleAssignmentModeChange = (shiftIndex: number, mode: 'ALL_ROSTER' | 'LEADS_ONLY' | 'SELECTED_USERS') => {
    setEventForm((prev) => ({
      ...prev,
      shifts: prev.shifts.map((shift, index) => {
        if (index !== shiftIndex) return shift;
        if (mode === 'ALL_ROSTER') {
          return { ...shift, assignmentMode: mode, selectedUserIds: allRosterIds };
        }
        if (mode === 'LEADS_ONLY') {
          return { ...shift, assignmentMode: mode, selectedUserIds: leadRosterIds };
        }
        return { ...shift, assignmentMode: mode, selectedUserIds: [] };
      })
    }));
  };

  const toggleSelectedUser = (shiftIndex: number, userId: string) => {
    setEventForm((prev) => ({
      ...prev,
      shifts: prev.shifts.map((shift, index) => {
        if (index !== shiftIndex) return shift;
        const selected = shift.selectedUserIds.includes(userId)
          ? shift.selectedUserIds.filter((id) => id !== userId)
          : [...shift.selectedUserIds, userId];
        return { ...shift, selectedUserIds: selected };
      })
    }));
  };

  const loadRosterMembers = useCallback(async () => {
    try {
      let campId;
      if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
        const camp = await api.get('/camps/my-camp');
        campId = camp?._id;
      } else if (user?.isCampLead && user?.campLeadCampId) {
        campId = user.campLeadCampId;
      }

      if (!campId) {
        setCurrentCampId(null);
        setRosterMembers([]);
        setRosterMeta({
          hasActiveRoster: false,
          memberCount: 0,
          hasShiftsOnlyRoster: false,
          hasFullMembershipRoster: false
        });
        return;
      }
      setCurrentCampId(campId.toString());

      let rosterMembersFromActiveRoster: RosterMemberLite[] = [];
      try {
        const roster = await api.get(`/rosters/active?campId=${campId}`);
        setRosterMeta(deriveRosterMeta(roster));
        rosterMembersFromActiveRoster = (roster?.members || [])
          .map(normalizeRosterMember)
          .filter(Boolean) as RosterMemberLite[];
      } catch (_rosterError) {
        setRosterMeta({
          hasActiveRoster: false,
          memberCount: 0,
          hasShiftsOnlyRoster: false,
          hasFullMembershipRoster: false
        });
      }

      const response = await api.getCampMembers(campId.toString());
      const activeCampMembers = (response.members || [])
        .map(normalizeRosterMember)
        .filter(Boolean) as RosterMemberLite[];
      const mergedMembers = new Map<string, RosterMemberLite>();
      [...activeCampMembers, ...rosterMembersFromActiveRoster].forEach((member) => {
        [member.memberId, member.userId, member._id].forEach((id) => {
          if (id && !mergedMembers.has(id)) mergedMembers.set(id, member);
        });
      });
      setRosterMembers(Array.from(new Set(mergedMembers.values())));
    } catch (error) {
      console.error('Error loading roster members:', error);
      setCurrentCampId(null);
      setRosterMembers([]);
      setRosterMeta({
        hasActiveRoster: false,
        memberCount: 0,
        hasShiftsOnlyRoster: false,
        hasFullMembershipRoster: false
      });
    }
  }, [normalizeRosterMember, user?.accountType, user?.campId, user?.isCampLead, user?.campLeadCampId]);

  const loadEvents = useCallback(async () => {
    try {
      // For Camp Leads: pass campId as query parameter for backend permission check
      let url = '/shifts/events';
      if (user?.isCampLead && user?.campLeadCampId) {
        url += `?campId=${user.campLeadCampId}`;
      }
      
      const response = await api.get(url);
      if (response?.events) {
        setEvents(response.events);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      setEvents([]);
    }
  }, [user?.isCampLead, user?.campLeadCampId]);

  useEffect(() => {
    if (canAccessShifts) {
      loadEvents();
      loadRosterMembers();
    }
  }, [canAccessShifts, loadEvents, loadRosterMembers]);

  const hasRoster = rosterMeta.memberCount > 0;
  const getEffectiveEventFields = useCallback(() => {
    const fallbackShiftDate = eventForm.shifts.find((shift) => !!shift.date)?.date || '';
    const fallbackShiftStart = eventForm.shifts.find((shift) => !!shift.startTime)?.startTime || '';
    const fallbackShiftEnd = eventForm.shifts.find((shift) => !!shift.endTime)?.endTime || '';
    return {
      eventDate: eventForm.eventDate || fallbackShiftDate,
      startTime: eventForm.startTime || fallbackShiftStart,
      endTime: eventForm.endTime || fallbackShiftEnd
    };
  }, [eventForm]);

  const canSaveEvent = useMemo(() => {
    const effective = getEffectiveEventFields();
    return Boolean(
      eventForm.eventName &&
      effective.eventDate &&
      effective.startTime &&
      effective.endTime &&
      eventForm.shifts.length > 0
    );
  }, [eventForm.eventName, eventForm.shifts.length, getEffectiveEventFields]);

  const hasAvailableShifts = useMemo(() => {
    return events.some(event =>
      (event.shifts || []).some(shift => {
        const max = shift.maxSignUps || 0;
        if (max <= 0) return false;
        const current = (shift.memberIds || []).length;
        return current < max;
      })
    );
  }, [events]);

  const handleCreateEvent = async () => {
    try {
      console.log('🔍 [Event Creation] User object:', user);
      console.log('🔍 [Event Creation] User accountType:', user?.accountType);
      console.log('🔍 [Event Creation] User campId:', user?.campId);
      
      // Get camp ID from user context
      let campId;
      if (user?.accountType === 'camp') {
        console.log('🔍 [Event Creation] Detected camp account, fetching camp data...');
        // For camp accounts, we need to get the camp ID
        const camp = await api.get('/camps/my-camp');
        console.log('🔍 [Event Creation] Camp response:', camp);
        campId = camp?._id;
      } else if (user?.accountType === 'admin' && user?.campId) {
        console.log('🔍 [Event Creation] Detected admin account with camp context...');
        // For admin accounts with camp context
        const camp = await api.get('/camps/my-camp');
        console.log('🔍 [Event Creation] Camp response:', camp);
        campId = camp?._id;
      } else if (user?.isCampLead && user?.campLeadCampId) {
        console.log('🔍 [Event Creation] Detected Camp Lead account, using campLeadCampId...');
        campId = user.campLeadCampId;
      }

      console.log('🔍 [Event Creation] Final campId:', campId);
      if (!campId) {
        console.error('❌ [Event Creation] No campId found!');
        alert('Unable to determine camp context. Please ensure you are logged in as a camp admin.');
        return;
      }

      const effective = getEffectiveEventFields();
      if (!effective.eventDate || !effective.startTime || !effective.endTime) {
        alert('Event date and time are required. Please add them or ensure at least one shift has date/time.');
        return;
      }

      const eventData = {
        eventName: eventForm.eventName,
        description: eventForm.description,
        eventDate: effective.eventDate,
        startTime: effective.startTime,
        endTime: effective.endTime,
        ...(campId ? { campId } : {}),
        shifts: eventForm.shifts.map(shift => ({
          ...(shift._id ? { _id: shift._id } : {}),
          title: shift.title,
          description: shift.description,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          maxSignUps: shift.maxSignUps,
          requiredSkills: shift.requiredSkills || [],
          assignmentMode: shift.assignmentMode,
          selectedUserIds: shift.selectedUserIds,
          manualAddIds: shift.selectedUserIds.filter((id) => {
            const baseline = shift.assignmentMode === 'ALL_ROSTER'
              ? allRosterIds
              : shift.assignmentMode === 'LEADS_ONLY'
                ? leadRosterIds
                : [];
            return !baseline.includes(id);
          }),
          manualRemoveIds: (() => {
            const baseline = shift.assignmentMode === 'ALL_ROSTER'
              ? allRosterIds
              : shift.assignmentMode === 'LEADS_ONLY'
                ? leadRosterIds
                : [];
            const selectedSet = new Set(shift.selectedUserIds);
            return baseline.filter((id) => !selectedSet.has(id));
          })()
        }))
      };

      const response = isEditMode && eventToEdit
        ? await api.put(`/shifts/events/${eventToEdit._id}`, eventData)
        : await api.post('/shifts/events', eventData);

      if (response?.event) {
        alert(isEditMode ? 'Event updated successfully!' : 'Event created successfully!');
        setShowCreateModal(false);
        resetForm();
        
        // Stay on main tab and reload events
        setActiveTab('main');
        loadEvents();
      } else {
        alert(`Failed to ${isEditMode ? 'update' : 'create'} event. Please try again.`);
      }
    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} event:`, error);
      if (error.response?.status === 403) {
        alert('Access denied. Only camp admins can manage events.');
      } else if (error.response?.status === 400) {
        alert('Invalid data. Please check all required fields are filled.');
      } else if (error.response?.status === 404 && isEditMode) {
        alert('Event not found. It may have been deleted.');
      } else {
        alert(`Error ${isEditMode ? 'updating' : 'creating'} event. Please try again.`);
      }
    }
  };

  const handleAddShift = () => {
    setEventForm(prev => ({
      ...prev,
      shifts: [...prev.shifts, {
        title: '',
        description: '',
        date: '',
        startTime: '',
        endTime: '',
        maxSignUps: 1,
        currentSignups: 0,
        assignmentMode: 'ALL_ROSTER',
        selectedUserIds: allRosterIds,
        requiredSkills: []
      }]
    }));
  };

  const handleAddShiftFromTemplate = (template: { label: string; startTime: string; durationHours: number }) => {
    const date = eventForm.eventDate || '';
    const [startH, startM] = template.startTime.split(':').map((value) => parseInt(value, 10));
    const end = new Date();
    end.setHours(startH + template.durationHours, startM, 0, 0);
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    setEventForm((prev) => ({
      ...prev,
      shifts: [...prev.shifts, {
        title: template.label,
        description: '',
        date,
        startTime: template.startTime,
        endTime,
        maxSignUps: 1,
        currentSignups: 0,
        assignmentMode: 'ALL_ROSTER',
        selectedUserIds: allRosterIds,
        requiredSkills: []
      }]
    }));
  };

  const handleRemoveShift = (index: number) => {
    setEventForm(prev => ({
      ...prev,
      shifts: prev.shifts.filter((_, i) => i !== index)
    }));
  };

  const handleShiftChange = (index: number, field: string, value: string | number) => {
    setEventForm(prev => ({
      ...prev,
      shifts: prev.shifts.map((shift, i) => 
        i === index ? { ...shift, [field]: value } : shift
      )
    }));
  };

  const resetForm = () => {
    setEventForm({
      eventName: '',
      description: '',
      eventDate: '',
      startTime: '',
      endTime: '',
      shifts: []
    });
    setLoadingExistingAssignments(false);
    setIsEditMode(false);
    setEventToEdit(null);
    setWizardStep(1);
    setBulkShiftSelection([]);
    setGlobalInviteMode('ALL_ROSTER');
  };

  const handleEditEvent = async (event: Event) => {
    setEventToEdit(event);
    setIsEditMode(true);

    setLoadingExistingAssignments(true);
    let assignmentResponses: any[] = [];
    try {
      assignmentResponses = await Promise.all(
        (event.shifts || []).map(async (shift) => {
          try {
            return await api.getShiftAssignees(shift._id);
          } catch (error) {
            console.error('Error fetching shift assignees for edit preload:', error);
            return null;
          }
        })
      );

    } finally {
      setLoadingExistingAssignments(false);
    }

    // Populate form with event data + assignment baseline from existing assignees.
    // utcToPdtDateInput / utcToPdtTimeInput convert stored UTC timestamps back to PDT
    // so the form inputs show Black Rock City Time correctly regardless of the user's browser timezone.
    const fallbackShiftDate = utcToPdtDateInput(event.shifts.find((shift) => shift?.date)?.date);
    const fallbackShiftStart = utcToPdtTimeInput(event.shifts.find((shift) => shift?.startTime)?.startTime);
    const fallbackShiftEnd = utcToPdtTimeInput(event.shifts.find((shift) => shift?.endTime)?.endTime);

    setEventForm({
      eventName: event.eventName,
      description: event.description || '',
      eventDate: utcToPdtDateInput(event.eventDate) || fallbackShiftDate,
      startTime: utcToPdtTimeInput(event.startTime) || fallbackShiftStart,
      endTime: utcToPdtTimeInput(event.endTime) || fallbackShiftEnd,
      shifts: event.shifts.map((shift, index) => ({
        _id: shift._id?.toString(),
        title: shift.title,
        description: shift.description || '',
        date: utcToPdtDateInput(shift.date),
        startTime: utcToPdtTimeInput(shift.startTime),
        endTime: utcToPdtTimeInput(shift.endTime),
        maxSignUps: shift.maxSignUps,
        currentSignups: shift.memberIds?.length || 0,
        assignmentMode: 'SELECTED_USERS',
        selectedUserIds: (assignmentResponses[index]?.assignedUsers || [])
          .map((assignedUser: any) => assignedUser?.userId?.toString())
          .filter(Boolean),
        requiredSkills: Array.isArray((shift as any).requiredSkills) ? (shift as any).requiredSkills : []
      }))
    });
    
    setShowCreateModal(true);
  };

  const toggleRequiredSkill = (shiftIndex: number, skill: string) => {
    setEventForm((prev) => ({
      ...prev,
      shifts: prev.shifts.map((shift, index) => {
        if (index !== shiftIndex) return shift;
        const hasSkill = shift.requiredSkills.includes(skill);
        return {
          ...shift,
          requiredSkills: hasSkill
            ? shift.requiredSkills.filter((item) => item !== skill)
            : [...shift.requiredSkills, skill]
        };
      })
    }));
  };

  const toggleShiftSelection = (index: number) => {
    setBulkShiftSelection((prev) => (prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]));
  };

  const applyBulkMaxSignups = () => {
    setEventForm((prev) => ({
      ...prev,
      shifts: prev.shifts.map((shift, index) =>
        bulkShiftSelection.includes(index) ? { ...shift, maxSignUps: Math.max(1, bulkMaxSignupsInput) } : shift
      )
    }));
  };

  const duplicateSelectedShifts = () => {
    setEventForm((prev) => {
      const duplicates = bulkShiftSelection
        .map((index) => prev.shifts[index])
        .filter(Boolean)
        .map((shift) => ({ ...shift, _id: undefined, title: `${shift.title} (copy)` }));
      return { ...prev, shifts: [...prev.shifts, ...duplicates] };
    });
  };

  const archiveSelectedShifts = () => {
    setEventForm((prev) => ({
      ...prev,
      shifts: prev.shifts.filter((_, index) => !bulkShiftSelection.includes(index))
    }));
    setBulkShiftSelection([]);
  };

  const applyGlobalInviteMode = () => {
    setEventForm((prev) => ({
      ...prev,
      shifts: prev.shifts.map((_, index) => {
        const shift = prev.shifts[index];
        if (globalInviteMode === 'ALL_ROSTER') {
          return { ...shift, assignmentMode: 'ALL_ROSTER', selectedUserIds: allRosterIds };
        }
        if (globalInviteMode === 'LEADS_ONLY') {
          return { ...shift, assignmentMode: 'LEADS_ONLY', selectedUserIds: leadRosterIds };
        }
        return { ...shift, assignmentMode: 'SELECTED_USERS', selectedUserIds: [] };
      })
    }));
  };

  const handleDeleteEvent = (event: Event) => {
    console.log('🗑️ [Delete Button Clicked] Event:', event);
    setEventToDelete(event);
    setShowDeleteModal(true);
    console.log('🗑️ [Delete Modal State] showDeleteModal should now be true');
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;

    try {
      setDeleteLoading(true);
      console.log('🗑️ [Event Deletion] Deleting event:', eventToDelete._id);
      
      await api.delete(`/shifts/events/${eventToDelete._id}`);
      
      // Remove the event from the local state
      setEvents(prevEvents => prevEvents.filter(e => e._id !== eventToDelete._id));
      
      // Close modal and reset state
      setShowDeleteModal(false);
      setEventToDelete(null);
      
      alert(`Event "${eventToDelete.eventName}" and all related data deleted successfully!`);
    } catch (error: any) {
      console.error('❌ [Event Deletion] Error deleting event:', error);
      console.error('❌ [Event Deletion] Error response:', error.response?.data);
      console.error('❌ [Event Deletion] Error status:', error.response?.status);
      
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Failed to delete event: ${errorMessage}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setEventToDelete(null);
  };

  const openAssignmentModal = async (shift: any) => {
    try {
      setSelectedShiftForAssignment(shift);
      setShowAssignmentModal(true);
      setAssignmentLoading(true);
      setPendingAddUserIds([]);
      const response = await api.getShiftAssignees(shift._id);
      setAssignmentState({
        assignedUsers: response.assignedUsers || [],
        unassignedUsers: response.unassignedUsers || []
      });
    } catch (error) {
      console.error('Error loading shift assignees:', error);
      alert('Failed to load shift assignees');
      setShowAssignmentModal(false);
      setSelectedShiftForAssignment(null);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleAddAssignees = async () => {
    if (!selectedShiftForAssignment || pendingAddUserIds.length === 0) return;
    try {
      setAssignmentSaving(true);
      await api.addShiftAssignees(selectedShiftForAssignment._id, pendingAddUserIds);
      await openAssignmentModal(selectedShiftForAssignment);
      await loadEvents();
      alert('Assignees added successfully');
    } catch (error: any) {
      console.error('Error adding assignees:', error);
      alert(error?.response?.data?.message || 'Failed to add assignees');
    } finally {
      setAssignmentSaving(false);
    }
  };

  // Using shared date formatting utilities

  const handlePrintReportView = () => {
    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) return;

    const generatedAt = new Date().toLocaleString();
    const title = `Volunteer Shift Report - ${reportLabels[reportType].title}`;
    const escapeHtml = (value: any) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const renderPrintMember = (member: ReportMember) => {
      const label = member.email ? `${member.personName} (${member.email})` : member.personName;
      if (!member.link) return escapeHtml(label);
      const href = `${window.location.origin}${member.link}`;
      return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
    };
    const renderPrintMemberChip = (member: ReportMember) => (
      `<span class="name-chip">${renderPrintMember(member)}</span>`
    );

    const namesSections = personReportGroups.length === 0
      ? '<p class="empty">No one has signed up yet.</p>'
      : personReportGroups.map((group) => `
        <section class="person-block">
          <h2>${renderPrintMember(group.member)}</h2>
          <ul>
            ${group.shifts.map((row) => `<li><strong>${escapeHtml(row.shiftTitle)}</strong> · ${escapeHtml(row.date)} · ${escapeHtml(row.shiftTime)} · ${escapeHtml(row.eventName)}</li>`).join('')}
          </ul>
        </section>
      `).join('');

    const shiftSections = sortedShiftReportRows.map((row) => {
      const stats = getShiftStats(row.shift);
      return `
        <section class="shift-block">
          <div class="shift-head">
            <h2>${escapeHtml(row.shift.title)}</h2>
            <span>${stats.current}/${stats.max} signed · ${stats.remaining} open</span>
          </div>
          <p class="shift-meta">${escapeHtml(row.date)} · ${escapeHtml(row.shiftTime)} · ${escapeHtml(row.eventName)}</p>
          <div class="name-grid">
            ${row.signedUpMembers.length > 0 ? row.signedUpMembers.map(renderPrintMemberChip).join('') : '<span class="empty-chip">No sign-ups yet</span>'}
          </div>
        </section>
      `;
    }).join('');

    const daySections = dayReportGroups.length === 0
      ? '<p class="empty">No shifts scheduled for selected day.</p>'
      : dayReportGroups.map((group) => `
        <section class="day-block">
          <h2>${escapeHtml(group.date)}</h2>
          ${group.shifts.map((row) => {
            const stats = getShiftStats(row.shift);
            return `
              <div class="day-shift">
                <div class="shift-head">
                  <h3>${escapeHtml(row.shift.title)}</h3>
                  <span>${stats.current}/${stats.max} signed · ${stats.remaining} open</span>
                </div>
                <p class="shift-meta">${escapeHtml(row.shiftTime)} · ${escapeHtml(row.eventName)}</p>
                <div class="name-grid">
                  ${row.signedUpMembers.length > 0 ? row.signedUpMembers.map(renderPrintMemberChip).join('') : '<span class="empty-chip">No sign-ups yet</span>'}
                </div>
              </div>
            `;
          }).join('')}
        </section>
      `).join('');

    const reportBody = reportType === 'names'
      ? namesSections
      : reportType === 'shifts'
        ? shiftSections || '<p class="empty">No shifts scheduled yet.</p>'
        : daySections;

    const scopedMeta = reportType === 'day' && selectedDate
      ? ` · ${shiftDateOptions.find((option) => option.value === selectedDate)?.label || selectedDate}`
      : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
            h1 { margin: 0 0 8px 0; font-size: 26px; }
            h2 { margin: 0; font-size: 18px; }
            h3 { margin: 0; font-size: 15px; }
            ul { margin: 10px 0 0 18px; padding: 0; }
            li { margin: 4px 0; }
            a { color: #c2410c; text-decoration: none; font-weight: 700; }
            .meta { color: #6b7280; margin-bottom: 22px; font-size: 12px; }
            .person-block, .shift-block, .day-block { break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 14px; }
            .day-shift { border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px; break-inside: avoid; }
            .shift-head { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
            .shift-head span { color: #6b7280; font-size: 12px; white-space: nowrap; }
            .shift-meta { color: #4b5563; margin: 6px 0 10px; font-size: 13px; }
            .name-grid { display: flex; flex-wrap: wrap; gap: 7px; }
            .name-chip { display: inline-block; border: 1px solid #fed7aa; background: #fff7ed; color: #c2410c; border-radius: 999px; padding: 5px 9px; font-size: 13px; }
            .empty, .empty-chip { color: #6b7280; }
            .empty-chip { display: inline-block; border: 1px dashed #d1d5db; border-radius: 999px; padding: 5px 9px; font-size: 13px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <div class="meta">Generated: ${escapeHtml(generatedAt)}${escapeHtml(scopedMeta)}</div>
          ${reportBody}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleBulkInviteConfirm = async () => {
    try {
      setBulkInviteLoading(true);
      let campId: string | undefined;
      if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
        const camp = await api.get('/camps/my-camp');
        campId = camp?._id;
      } else if (user?.isCampLead && user?.campLeadCampId) {
        campId = user.campLeadCampId;
      }

      const response = await api.inviteEntireRosterToAllShifts(campId, {
        skipRecentDays,
        scheduleAt: scheduleAt || undefined
      });
      alert(response.message);
      setShowBulkInviteModal(false);
    } catch (error: any) {
      console.error('Bulk invite error:', error);
      alert(error?.response?.data?.message || 'Failed to send roster invites.');
    } finally {
      setBulkInviteLoading(false);
    }
  };

  const loadBulkInvitePreview = useCallback(async () => {
    try {
      let campId: string | undefined;
      if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
        const camp = await api.get('/camps/my-camp');
        campId = camp?._id;
      } else if (user?.isCampLead && user?.campLeadCampId) {
        campId = user.campLeadCampId;
      }
      const response = await api.inviteEntireRosterToAllShifts(campId, {
        previewOnly: true,
        skipRecentDays
      });
      setInvitePreview(response.recipientPreview || null);
    } catch (_error) {
      setInvitePreview(null);
    }
  }, [skipRecentDays, user?.accountType, user?.campId, user?.isCampLead, user?.campLeadCampId]);

  useEffect(() => {
    if (showBulkInviteModal) {
      loadBulkInvitePreview();
    }
  }, [showBulkInviteModal, loadBulkInvitePreview]);


  if (!canAccessShifts) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to access Volunteer Shifts management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
            Volunteer Shifts Management
          </h1>
          <p className="text-body text-custom-text-secondary">
            Create and manage volunteer shifts for your camp
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!rosterMeta.hasFullMembershipRoster && (
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  const rosterPath = campIdentifier ? `/camp/${campIdentifier}/roster` : '/roster';
                  navigate(`${rosterPath}?action=${rosterMeta.hasShiftsOnlyRoster ? 'add_sor' : 'start_sor'}`);
                }}
                className="flex items-center gap-2 min-h-[44px]"
              >
                {rosterMeta.hasShiftsOnlyRoster ? 'Add More People to SOR' : 'Start Shifts-Only Roster'}
              </Button>
              <p className="text-[11px] text-gray-600 mt-1">
                {rosterMeta.hasShiftsOnlyRoster
                  ? 'Open roster tools to add/import more shifts-only members.'
                  : 'Set up shifts-only roster before sending shift invites.'}
              </p>
            </div>
          )}
          {hasRoster && (
            <div>
              <Button
                variant="primary"
                onClick={() => setShowBulkInviteModal(true)}
                disabled={bulkInviteLoading || !hasAvailableShifts}
                className="flex items-center gap-2 min-h-[44px]"
              >
                Notify Entire Roster
              </Button>
              <p className="text-[11px] text-gray-600 mt-1">Sends one generic invite to browse all open shifts.</p>
            </div>
          )}
          <div>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </Button>
            <p className="text-[11px] text-gray-600 mt-1">Build event details, shifts, and invite strategy.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'main' ? 'border-b-2 border-custom-primary text-custom-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('main')}
        >
          Manage Events
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'reports' ? 'border-b-2 border-custom-primary text-custom-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'main' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-lato-bold text-custom-text mb-2">
                Volunteer Events & Shifts
              </h2>
              <p className="text-gray-600">
                Manage your camp's volunteer events and shifts. Create new events or edit existing ones.
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1 mt-2 inline-block">
                🕐 All dates and times are in <strong>{PDT_LABEL}</strong>
              </p>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="mb-4">
                    <Calendar className="w-16 h-16 mx-auto text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No events created yet</h3>
                  <p className="text-gray-600 mb-6">
                    Get started by creating your first volunteer event. Events can contain multiple shifts that members can sign up for.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Event
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Coverage Timeline</h4>
                  <p className="text-xs text-gray-600 mb-3">
                    Red blocks indicate coverage gaps. Green blocks indicate fully staffed shifts.
                  </p>
                  <div className="space-y-3">
                    {events.slice(0, 6).map((event) => (
                      <div key={`timeline-${event._id}`}>
                        <div className="text-xs font-medium text-gray-700 mb-1">{event.eventName}</div>
                        <div className="relative h-8 rounded bg-gray-100 overflow-hidden">
                          {(event.shifts || []).map((shift) => {
                            const toPdtMinutes = (ts: any) => {
                              const d = new Date(ts);
                              const [h, m] = d.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number);
                              return h * 60 + m;
                            };
                            const start = toPdtMinutes(shift.startTime);
                            const end = toPdtMinutes(shift.endTime);
                            const left = `${(start / (24 * 60)) * 100}%`;
                            const width = `${(Math.max(end - start, 30) / (24 * 60)) * 100}%`;
                            const current = (shift.memberIds || []).length;
                            const full = current >= (shift.maxSignUps || 0);
                            const coverageLabel = `${current}/${shift.maxSignUps || 0}`;
                            return (
                              <div
                                key={shift._id}
                                className={`absolute top-0 h-full border-r border-white text-[10px] px-1 truncate ${full ? 'bg-green-500 text-white' : 'bg-red-400 text-white'}`}
                                style={{ left, width }}
                                title={`${shift.title} (${coverageLabel})`}
                              >
                                {shift.title} {coverageLabel}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {events.map((event) => (
                  <div key={event._id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{event.eventName}</h3>
                        <p className="text-gray-600">{event.description}</p>
                        {(event.eventDate || event.startTime || event.endTime) && (
                          <p className="text-sm text-gray-600 mt-1">
                            {event.eventDate ? formatDate(event.eventDate) : 'Date TBD'}
                            {event.startTime && event.endTime
                              ? ` • ${formatShiftTime(event.startTime)} - ${formatShiftTime(event.endTime)}`
                              : ''}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          {event.shifts.length} shift{event.shifts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowManageModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteEvent(event)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {/* Show shift preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {event.shifts.slice(0, 3).map((shift) => (
                        <div key={shift._id} className="bg-gray-50 rounded p-2 text-sm">
                          <div className="font-medium">{shift.title}</div>
                          <div className="text-gray-600">
                            {formatShiftDate(shift.date)}
                          </div>
                          <div className="text-gray-600">
                            {formatShiftTime(shift.startTime)} - {formatShiftTime(shift.endTime)}
                          </div>
                          <div className="text-gray-500">
                            {shift.memberIds.length}/{shift.maxSignUps} signed up
                            {shift.memberIds.length >= shift.maxSignUps ? (
                              <span className="ml-2 text-red-600 font-medium">Full</span>
                            ) : (
                              <span className="ml-2 text-green-700">
                                {Math.max(shift.maxSignUps - shift.memberIds.length, 0)} spots remaining
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {event.shifts.length > 3 && (
                        <div className="bg-gray-50 rounded p-2 text-sm text-gray-500 flex items-center justify-center">
                          +{event.shifts.length - 3} more shifts
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-lato-bold text-custom-text mb-2">
                Volunteer Shift Reports
              </h2>
              <p className="text-gray-600">
                Human-first shift rosters for printing, day-of coordination, and quick staffing checks.
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1 mt-2 inline-block">
                🕐 All dates and times are in <strong>{PDT_LABEL}</strong>
              </p>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => setReportType('names')}
                className={`rounded-lg border px-4 py-3 text-left transition ${reportType === 'names' ? 'border-orange-300 bg-orange-50 text-orange-800 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200'}`}
              >
                <span className="block text-sm font-semibold">Names List</span>
                <span className="block text-xs text-gray-500">{personReportGroups.length} people signed up</span>
              </button>
              <button
                type="button"
                onClick={() => setReportType('shifts')}
                className={`rounded-lg border px-4 py-3 text-left transition ${reportType === 'shifts' ? 'border-orange-300 bg-orange-50 text-orange-800 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200'}`}
              >
                <span className="block text-sm font-semibold">Per Shift</span>
                <span className="block text-xs text-gray-500">{sortedShiftReportRows.length} shift rosters</span>
              </button>
              <button
                type="button"
                onClick={() => setReportType('day')}
                className={`rounded-lg border px-4 py-3 text-left transition ${reportType === 'day' ? 'border-orange-300 bg-orange-50 text-orange-800 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200'}`}
              >
                <span className="block text-sm font-semibold">Per Day</span>
                <span className="block text-xs text-gray-500">{shiftDateOptions.length} scheduled day{shiftDateOptions.length === 1 ? '' : 's'}</span>
              </button>
            </div>

            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between no-print">
              {reportType === 'day' ? (
                <label className="flex flex-col gap-1 text-sm text-gray-700 md:flex-row md:items-center">
                  <span className="font-medium">Day</span>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm md:w-56"
                  >
                    <option value="">All days</option>
                    {shiftDateOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="text-sm text-gray-500">
                  Names link to Contact 360 when a roster record is available.
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintReportView}
              >
                {reportLabels[reportType].print}
              </Button>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={64} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Events to Report</h3>
                <p className="text-gray-600">Create some volunteer events first to see reporting data.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {reportType === 'names' && (
                  personReportGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center text-gray-500">
                      <Users size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No one has signed up yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {personReportGroups.map((group) => (
                        <div key={group.member.id || group.member.personName} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              {renderReportMember(group.member)}
                              <div className="mt-2 text-xs font-medium text-gray-500">
                                {group.shifts.length} shift{group.shifts.length === 1 ? '' : 's'}
                              </div>
                            </div>
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                              {group.shifts.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {group.shifts.map((shift) => (
                              <div key={`${group.member.id}-${shift.dateValue}-${shift.shiftTitle}-${shift.shiftTime}`} className="rounded-md bg-gray-50 px-3 py-2">
                                <div className="font-medium text-gray-900">{shift.shiftTitle}</div>
                                <div className="text-xs text-gray-600">{shift.date} · {shift.shiftTime} · {shift.eventName}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {reportType === 'shifts' && (
                  <div className="space-y-4">
                    {sortedShiftReportRows.map((row) => {
                      const stats = getShiftStats(row.shift);
                      return (
                        <div key={row.shift._id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{row.shift.title}</h3>
                              <p className="text-sm text-gray-600">{row.date} · {row.shiftTime} · {row.eventName}</p>
                              {row.description && row.description !== row.shift.title && (
                                <p className="mt-1 text-sm text-gray-500">{row.description}</p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">{stats.current} signed</span>
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">{stats.max} capacity</span>
                              <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">{stats.remaining} open</span>
                            </div>
                          </div>
                          {row.signedUpMembers.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {row.signedUpMembers.map((member) => (
                                <React.Fragment key={`${row.shift._id}-${member.id}`}>
                                  {renderReportMember(member)}
                                </React.Fragment>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500">
                              No one has signed up for this shift yet.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {reportType === 'day' && (
                  dayReportGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center text-gray-500">
                      <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No shifts scheduled for the selected day.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {dayReportGroups.map((group) => (
                        <div key={group.dateValue || group.date} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                            <h3 className="text-lg font-semibold text-gray-900">{group.date}</h3>
                            <p className="text-sm text-gray-500">{group.shifts.length} shift{group.shifts.length === 1 ? '' : 's'}</p>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {group.shifts.map((row) => {
                              const stats = getShiftStats(row.shift);
                              return (
                                <div key={row.shift._id} className="p-4">
                                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <h4 className="font-semibold text-gray-900">{row.shift.title}</h4>
                                      <p className="text-sm text-gray-600">{row.shiftTime} · {row.eventName}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">{stats.current}/{stats.max} signed</span>
                                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">{stats.remaining} open</span>
                                    </div>
                                  </div>
                                  {row.signedUpMembers.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {row.signedUpMembers.map((member) => (
                                        <React.Fragment key={`${row.shift._id}-${member.id}`}>
                                          {renderReportMember(member)}
                                        </React.Fragment>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="rounded-md border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500">
                                      No sign-ups yet.
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Create Event Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title={isEditMode ? `Edit Event: ${eventToEdit?.eventName}` : "Create New Event"}
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-2">
            {[
              { step: 1, label: 'Basics' },
              { step: 2, label: 'Shifts' },
              { step: 3, label: 'Invite Strategy' },
              { step: 4, label: 'Review' }
            ].map((item) => (
              <button
                key={item.step}
                type="button"
                onClick={() => setWizardStep(item.step as 1 | 2 | 3 | 4)}
                className={`rounded border px-2 py-2 text-xs ${wizardStep === item.step ? 'border-custom-primary bg-orange-50 text-custom-primary font-semibold' : 'border-gray-200 text-gray-600'}`}
              >
                {item.step}. {item.label}
              </button>
            ))}
          </div>

          {wizardStep === 1 && (
            <>
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                🕐 All dates and times are in <strong>{PDT_LABEL}</strong>. If an event runs past midnight, set the end time on the following date&apos;s shift — the system will advance it automatically.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Name *</label>
                <Input
                  value={eventForm.eventName}
                  onChange={(e) => setEventForm(prev => ({ ...prev, eventName: e.target.value }))}
                  placeholder="Enter event name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                  placeholder="Enter event description"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Date * <span className="text-xs font-normal text-amber-700">(PDT)</span></label>
                  <Input type="date" value={eventForm.eventDate} onChange={(e) => setEventForm(prev => ({ ...prev, eventDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time * <span className="text-xs font-normal text-amber-700">(PDT)</span></label>
                  <TimePicker value={eventForm.startTime} onChange={(v) => setEventForm(prev => ({ ...prev, startTime: v }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time * <span className="text-xs font-normal text-amber-700">(PDT)</span></label>
                  <TimePicker value={eventForm.endTime} onChange={(v) => setEventForm(prev => ({ ...prev, endTime: v }))} />
                </div>
              </div>
            </>
          )}

          {wizardStep === 2 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Shifts</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {shiftTemplates.map((template) => (
                    <Button
                      key={template.key}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddShiftFromTemplate(template)}
                      className="min-h-[40px]"
                    >
                      {template.label}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddShift} className="flex items-center gap-1 min-h-[40px]">
                    <Plus className="w-4 h-4" />
                    Add Shift
                  </Button>
                </div>
              </div>

              {eventForm.shifts.length > 0 && (
                <div className="mb-4 rounded border border-gray-200 p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Bulk Actions</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Set max signups</label>
                      <Input type="number" min="1" value={bulkMaxSignupsInput} onChange={(e) => setBulkMaxSignupsInput(parseInt(e.target.value) || 1)} />
                    </div>
                    <Button variant="outline" size="sm" onClick={applyBulkMaxSignups} disabled={bulkShiftSelection.length === 0}>Apply</Button>
                    <Button variant="outline" size="sm" onClick={duplicateSelectedShifts} disabled={bulkShiftSelection.length === 0}>Duplicate</Button>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-600 hover:bg-red-50" onClick={archiveSelectedShifts} disabled={bulkShiftSelection.length === 0}>Archive</Button>
                  </div>
                </div>
              )}

              {eventForm.shifts.map((shift, index) => {
                const isFullyStaffed = isEditMode && shift.currentSignups >= shift.maxSignUps;
                const staffedFieldClass = isFullyStaffed ? 'bg-gray-100' : '';
                return (
                  <div key={index} className={`border rounded-lg p-4 mb-4 ${isFullyStaffed ? 'border-green-300 bg-green-50/40' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={bulkShiftSelection.includes(index)}
                          onChange={() => toggleShiftSelection(index)}
                          aria-label={`Select Shift ${index + 1} for bulk actions`}
                        />
                        <h4 className="font-medium">Shift {index + 1}</h4>
                        {isFullyStaffed && (
                          <span className="text-xs font-medium text-green-800 bg-green-100 border border-green-200 rounded px-2 py-0.5">
                            Fully staffed
                          </span>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRemoveShift(index)} className="text-red-600 border-red-600 hover:bg-red-50">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                        <Input value={shift.title} onChange={(e) => handleShiftChange(index, 'title', e.target.value)} placeholder="Shift title" className={staffedFieldClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Sign-ups *</label>
                        <Input type="number" value={shift.maxSignUps} onChange={(e) => handleShiftChange(index, 'maxSignUps', parseInt(e.target.value) || 1)} min="1" className={staffedFieldClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date * <span className="text-xs font-normal text-amber-700">(PDT)</span></label>
                        <Input type="date" value={shift.date} onChange={(e) => handleShiftChange(index, 'date', e.target.value)} className={staffedFieldClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time * <span className="text-xs font-normal text-amber-700">(PDT)</span></label>
                        <TimePicker value={shift.startTime} onChange={(v) => handleShiftChange(index, 'startTime', v)} disabled={isFullyStaffed} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time * <span className="text-xs font-normal text-amber-700">(PDT)</span></label>
                        <TimePicker value={shift.endTime} onChange={(v) => handleShiftChange(index, 'endTime', v)} disabled={isFullyStaffed} />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={shift.description}
                        onChange={(e) => handleShiftChange(index, 'description', e.target.value)}
                        rows={2}
                        className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent ${staffedFieldClass}`}
                        placeholder="Shift description"
                      />
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Required Skills (for best-fit matching)</p>
                      <div className="flex flex-wrap gap-2">
                        {skillOptions.map((skill) => {
                          const active = (shift.requiredSkills || []).includes(skill);
                          return (
                            <button
                              key={`${index}-${skill}`}
                              type="button"
                              onClick={() => toggleRequiredSkill(index, skill)}
                              className={`rounded-full border px-3 py-1 text-xs ${active ? 'bg-custom-primary border-custom-primary text-white' : 'bg-white border-gray-300 text-gray-700'}`}
                            >
                              {skill}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="font-medium">Choose a default invite strategy</p>
                <p className="text-xs mt-1">Invite to sign up = notify members. Assign directly = place specific members onto a shift now.</p>
                <p className="text-xs mt-1">
                  <strong>Heads up:</strong> shifts set to <em>Invite to sign up (all)</em> or <em>(leads)</em> stay open to anyone who joins the roster later — they'll automatically be eligible without you re-inviting. <em>Assign directly</em> stays locked to the people you pick now.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant={globalInviteMode === 'ALL_ROSTER' ? 'primary' : 'outline'} size="sm" onClick={() => setGlobalInviteMode('ALL_ROSTER')}>
                  Invite to Sign Up: Entire Roster
                </Button>
                <Button variant={globalInviteMode === 'LEADS_ONLY' ? 'primary' : 'outline'} size="sm" onClick={() => setGlobalInviteMode('LEADS_ONLY')}>
                  Invite to Sign Up: Leads Only
                </Button>
                <Button variant={globalInviteMode === 'SELECTED_USERS' ? 'primary' : 'outline'} size="sm" onClick={() => setGlobalInviteMode('SELECTED_USERS')}>
                  Assign Directly: Selected People
                </Button>
                <Button variant="outline" size="sm" onClick={applyGlobalInviteMode}>
                  Apply to All Shifts
                </Button>
              </div>
              <div className="space-y-3">
                {eventForm.shifts.map((shift, index) => (
                  <div key={`invite-${index}`} className="rounded border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{shift.title || `Shift ${index + 1}`}</p>
                      <span className="text-xs text-gray-600">
                        Selected: {shift.selectedUserIds.length}/{rosterMembers.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                      <label className={`border rounded-lg p-2 cursor-pointer text-sm ${shift.assignmentMode === 'ALL_ROSTER' ? 'border-custom-primary bg-orange-50' : 'border-gray-200'}`}>
                        <input type="radio" className="mr-2" checked={shift.assignmentMode === 'ALL_ROSTER'} onChange={() => handleAssignmentModeChange(index, 'ALL_ROSTER')} />
                        Invite to sign up (all)
                      </label>
                      <label className={`border rounded-lg p-2 cursor-pointer text-sm ${shift.assignmentMode === 'LEADS_ONLY' ? 'border-custom-primary bg-orange-50' : 'border-gray-200'}`}>
                        <input type="radio" className="mr-2" checked={shift.assignmentMode === 'LEADS_ONLY'} onChange={() => handleAssignmentModeChange(index, 'LEADS_ONLY')} />
                        Invite to sign up (leads)
                      </label>
                      <label className={`border rounded-lg p-2 cursor-pointer text-sm ${shift.assignmentMode === 'SELECTED_USERS' ? 'border-custom-primary bg-orange-50' : 'border-gray-200'}`}>
                        <input type="radio" className="mr-2" checked={shift.assignmentMode === 'SELECTED_USERS'} onChange={() => handleAssignmentModeChange(index, 'SELECTED_USERS')} />
                        Assign directly
                      </label>
                    </div>
                    <p className="text-[11px] text-gray-600 mb-2">
                      {shift.assignmentMode === 'ALL_ROSTER' && (
                        <>Future members who join your roster will automatically have access to sign up — no re-invitation required.</>
                      )}
                      {shift.assignmentMode === 'LEADS_ONLY' && (
                        <>Future members promoted to Camp Lead will automatically have access. Plain members do not.</>
                      )}
                      {shift.assignmentMode === 'SELECTED_USERS' && (
                        <>Only the people you pick below can sign up. Members who join the roster later will <strong>not</strong> be added.</>
                      )}
                    </p>
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                      {rosterMembers
                        .map((member) => {
                          const memberSkills = ((member as any).skills || []) as string[];
                          const matchedSkills = (shift.requiredSkills || []).filter((skill) => memberSkills.includes(skill));
                          const skillMatchPercent = (shift.requiredSkills || []).length > 0
                            ? Math.round((matchedSkills.length / (shift.requiredSkills || []).length) * 100)
                            : 0;
                          const priorShiftCount = events.reduce((acc, evt) => acc + (evt.shifts || []).filter((evtShift) => (evtShift.memberIds || []).includes(member._id)).length, 0);
                          const alreadyInvited = shift.selectedUserIds.includes(member._id);
                          return {
                            member,
                            skillMatchPercent,
                            priorShiftCount,
                            alreadyInvited
                          };
                        })
                        .sort((a, b) => (b.skillMatchPercent - a.skillMatchPercent) || (a.priorShiftCount - b.priorShiftCount))
                        .map(({ member, skillMatchPercent, priorShiftCount, alreadyInvited }) => {
                          const label = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
                          return (
                            <label key={`${index}-${member._id}`} className="flex items-center justify-between gap-2">
                              <span className="text-sm">
                                {label} {member.isLead ? <span className="text-xs text-orange-700">(Lead)</span> : null}
                                <span className="block text-[11px] text-gray-500">
                                  Skill match {skillMatchPercent}% • Prior shifts {priorShiftCount} • {alreadyInvited ? 'Already invited' : 'Not invited'}
                                </span>
                              </span>
                              <input type="checkbox" checked={shift.selectedUserIds.includes(member._id)} onChange={() => toggleSelectedUser(index, member._id)} />
                            </label>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                🕐 All times shown in <strong>{PDT_LABEL}</strong>
              </div>
              <div className="rounded border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Final Review Before Publish</h4>
                <p className="text-sm text-gray-600">
                  <strong>{eventForm.eventName || 'Untitled event'}</strong> on {eventForm.eventDate || 'TBD'} from{' '}
                  {eventForm.startTime
                    ? new Date(`1970-01-01T${eventForm.startTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    : '--'}
                  {' '}to{' '}
                  {eventForm.endTime
                    ? new Date(`1970-01-01T${eventForm.endTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    : '--'}{' '}PDT
                </p>
                <p className="text-sm text-gray-600 mt-1">{eventForm.shifts.length} shift(s) configured</p>
              </div>
              <div className="space-y-2">
                {eventForm.shifts.map((shift, index) => (
                  <div key={`review-${index}`} className="rounded border border-gray-200 p-3">
                    <p className="text-sm font-medium">{shift.title || `Shift ${index + 1}`}</p>
                    <p className="text-xs text-gray-600">
                      {shift.date || 'TBD'} •{' '}
                      {shift.startTime
                        ? new Date(`1970-01-01T${shift.startTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        : '--'}{' '}–{' '}
                      {shift.endTime
                        ? new Date(`1970-01-01T${shift.endTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        : '--'}{' '}PDT • Max {shift.maxSignUps}
                    </p>
                    <p className="text-xs text-gray-600">Invite strategy: {shift.assignmentMode}</p>
                    {(shift.requiredSkills || []).length > 0 && (
                      <p className="text-xs text-gray-600">Required skills: {(shift.requiredSkills || []).join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingExistingAssignments && isEditMode && (
            <div className="text-xs text-gray-500 mb-2">Loading existing assignments...</div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            {wizardStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setWizardStep((prev) => (Math.max(prev - 1, 1) as 1 | 2 | 3 | 4))}
                className="flex-1 min-h-[44px]"
              >
                Back
              </Button>
            )}
            {wizardStep < 4 && (
              <Button
                variant="primary"
                onClick={() => setWizardStep((prev) => (Math.min(prev + 1, 4) as 1 | 2 | 3 | 4))}
                className="flex-1 min-h-[44px]"
                disabled={wizardStep === 1 && (!eventForm.eventName || !eventForm.eventDate || !eventForm.startTime || !eventForm.endTime)}
              >
                Next
              </Button>
            )}
            {wizardStep === 4 && (
              <Button
                variant="primary"
                onClick={handleCreateEvent}
                disabled={!canSaveEvent}
                className="flex-1 min-h-[44px]"
              >
                <Save className="w-4 h-4 mr-2" />
                {isEditMode ? 'Save' : 'Publish Event'}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Bulk Invite Confirmation Modal */}
      <Modal
        isOpen={showBulkInviteModal}
        onClose={() => {
          if (bulkInviteLoading) return;
          setShowBulkInviteModal(false);
        }}
        title="Notify Entire Roster"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Notify the entire roster to sign up for available shifts.
          </p>
          <p className="text-xs text-gray-500">
            Each roster member will receive one generic email and one in-app notification with a link to the shifts page.
          </p>
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded border border-gray-200 p-3">
              <p className="text-xs text-gray-600 mb-1">Recipient preview</p>
              <p className="text-sm text-gray-800">
                Existing users: <strong>{invitePreview?.existingUsers ?? '-'}</strong> • Roster-only: <strong>{invitePreview?.rosterOnly ?? '-'}</strong> • Total: <strong>{invitePreview?.total ?? '-'}</strong>
              </p>
            </div>
            <label className="text-sm text-gray-700">
              Skip members invited in last N days
              <Input
                type="number"
                min="0"
                value={skipRecentDays}
                onChange={(e) => setSkipRecentDays(parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </label>
            <label className="text-sm text-gray-700">
              Schedule send time (optional)
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="mt-1"
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkInviteModal(false)}
              disabled={bulkInviteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkInviteConfirm}
              disabled={bulkInviteLoading}
            >
              {bulkInviteLoading ? 'Sending...' : scheduleAt ? 'Schedule Invites' : 'Send Invites'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manage Event Details Modal */}
      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title={selectedEvent ? `Event Details: ${selectedEvent.eventName}` : 'Event Details'}
        size="lg"
      >
        <div className="space-y-6">
          {selectedEvent && (
            <>
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold">{selectedEvent.eventName}</h3>
                <p className="text-gray-600 mt-1">{selectedEvent.description}</p>
                {(selectedEvent.eventDate || selectedEvent.startTime || selectedEvent.endTime) && (
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedEvent.eventDate ? formatDate(selectedEvent.eventDate) : 'Date TBD'}
                    {selectedEvent.startTime && selectedEvent.endTime
                      ? ` • ${formatShiftTime(selectedEvent.startTime)} – ${formatShiftTime(selectedEvent.endTime)} PDT`
                      : ''}
                  </p>
                )}
                <p className="text-xs text-amber-700 mt-1">🕐 Times shown in {PDT_LABEL}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Created: {new Date(selectedEvent.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-3">Shifts ({selectedEvent.shifts.length})</h4>
                <div className="space-y-3">
                  {selectedEvent.shifts.map((shift) => (
                    <div key={shift._id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium">{shift.title}</h5>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {shift.memberIds.length}/{shift.maxSignUps} signed up
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAssignmentModal(shift)}
                            className="min-h-[40px]"
                          >
                            Assign Directly
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{shift.description}</p>
                      <div className="text-sm text-gray-500">
                        <div>{formatDate(shift.date)}</div>
                        <div>{formatShiftTime(shift.startTime)} - {formatShiftTime(shift.endTime)}</div>
                        <div className="text-[11px] mt-1">Assign directly places specific people onto this shift now.</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setShowManageModal(false)}
            className="flex-1"
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showAssignmentModal}
        onClose={() => {
          setShowAssignmentModal(false);
          setSelectedShiftForAssignment(null);
          setPendingAddUserIds([]);
        }}
        title={selectedShiftForAssignment ? `Assign Directly: ${selectedShiftForAssignment.title}` : 'Assign Directly'}
        size="lg"
      >
        <div className="space-y-4">
          {assignmentLoading ? (
            <div className="text-sm text-gray-500">Loading assignees...</div>
          ) : (
            <>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Current Assignees ({assignmentState.assignedUsers.length})</div>
                <p className="text-xs text-gray-500 mb-2">Assign directly adds people immediately to this specific shift.</p>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                  {assignmentState.assignedUsers.length === 0 ? (
                    <div className="text-sm text-gray-500">No assignees yet.</div>
                  ) : (
                    assignmentState.assignedUsers.map((user) => (
                      <div key={user.userId} className="text-sm text-gray-700">
                        {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Add More People</div>
                <p className="text-xs text-gray-500 mb-2">Use "Invite to sign up" in event setup when you want members to choose their own shifts.</p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                  {assignmentState.unassignedUsers.length === 0 ? (
                    <div className="text-sm text-gray-500">No unassigned roster users available.</div>
                  ) : (
                    assignmentState.unassignedUsers.map((user) => (
                      <label key={user.userId} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
                          {user.isLead ? <span className="text-xs text-orange-700 ml-1">(Lead)</span> : null}
                        </span>
                        <input
                          type="checkbox"
                          checked={pendingAddUserIds.includes(user.userId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPendingAddUserIds((prev) => [...prev, user.userId]);
                            } else {
                              setPendingAddUserIds((prev) => prev.filter((id) => id !== user.userId));
                            }
                          }}
                        />
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssignmentModal(false);
                    setSelectedShiftForAssignment(null);
                    setPendingAddUserIds([]);
                  }}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  disabled={assignmentSaving || pendingAddUserIds.length === 0}
                  onClick={handleAddAssignees}
                >
                  {assignmentSaving ? 'Adding...' : `Add ${pendingAddUserIds.length || ''} People`}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        title="Delete Event"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Are you sure you want to delete this event?
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>This action will permanently delete:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Event: <strong>{eventToDelete?.eventName}</strong></li>
                    <li>All {eventToDelete?.shifts?.length || 0} shift(s) in this event</li>
                    <li>All volunteer shift tasks assigned to members</li>
                  </ul>
                  <p className="mt-2 font-medium">This action cannot be undone.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {deleteLoading ? (
                <>
                  <div className="spinner w-4 h-4" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Event
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VolunteerShifts;
