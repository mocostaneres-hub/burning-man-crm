import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Card, Modal, Input, TimePicker } from '../../components/ui';
import { AlertTriangle, Calendar, ChevronDown, Users, UserPlus, Plus, Eye, Edit, Trash2, Save, X, Search, CheckCircle, Lock, Unlock } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Event } from '../../types';
import { formatShiftDate, formatShiftTime, formatDate, utcToPdtDateInput, utcToPdtTimeInput, PDT_LABEL } from '../../utils/dateFormatters';
import { useSkills } from '../../hooks/useSkills';
import { deduplicateRosterMembers } from './rosterMemberUtils';
import { applyShiftAssignmentMode } from './shiftAssignmentUtils';

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
  shiftId: string;
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
  eventId: string;
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

type EventReportGroup = {
  event: Event;
  date: string;
  eventTime: string;
  shifts: ShiftReportRow[];
};

type ShiftAssigneeOption = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  playaName?: string;
  isLead?: boolean;
  isActiveRosterMember?: boolean;
};

const getAssigneeDisplayName = (assignee: ShiftAssigneeOption) => (
  `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim()
  || assignee.playaName
  || assignee.email
  || 'Unknown member'
);

const getAssigneeInitials = (assignee: ShiftAssigneeOption) => {
  const name = `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim()
    || assignee.playaName
    || assignee.email;
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';
};

const isCurrentRosterEntry = (entry: any) => {
  const status = String(entry?.status || entry?.member?.status || '').toLowerCase();
  return !['inactive', 'rejected', 'withdrawn', 'suspended', 'deleted', 'archived'].includes(status);
};

type ReportView = 'names' | 'events' | 'day';

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
      } else if (user.isEventsLead && user.eventsLeadCampId) {
        const identifierMatches = campIdentifier === user.eventsLeadCampId ||
                                  campIdentifier === user.eventsLeadCampSlug;
        if (!identifierMatches) {
          console.error('❌ [VolunteerShifts] Events Lead trying to access wrong camp. Redirecting...');
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
  const [eventSaving, setEventSaving] = useState(false);
  const [lockUpdatingEventId, setLockUpdatingEventId] = useState<string | null>(null);
  const [assignmentState, setAssignmentState] = useState<{
    isDirectAssignmentLocked: boolean;
    assignedUsers: ShiftAssigneeOption[];
    unassignedUsers: ShiftAssigneeOption[];
  }>({ isDirectAssignmentLocked: false, assignedUsers: [], unassignedUsers: [] });
  const [pendingAddUserIds, setPendingAddUserIds] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [loadingExistingAssignments, setLoadingExistingAssignments] = useState(false);
  const [reportType, setReportType] = useState<ReportView>('names');
  const [selectedDate, setSelectedDate] = useState('');
  const [showAllCoverageGaps, setShowAllCoverageGaps] = useState(false);
  const [showCoveredShifts, setShowCoveredShifts] = useState(false);
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
    shiftDropsLocked: false,
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
      directAssignmentUserIds: string[];
      requiredSkills: string[];
    }>
  });
  const [rosterMembers, setRosterMembers] = useState<RosterMemberLite[]>([]);
  const [currentCampId, setCurrentCampId] = useState<string | null>(null);
  const [currentCampName, setCurrentCampName] = useState<string | null>(null);
  const [rosterMeta, setRosterMeta] = useState({
    hasActiveRoster: false,
    memberCount: 0,
    hasShiftsOnlyRoster: false,
    hasFullMembershipRoster: false
  });

  // Check if user has admin/lead access (including Camp Leads)
  const isCampContext = user?.accountType === 'camp' 
    || (user?.accountType === 'admin' && user?.campId)
    || (user?.isCampLead === true && user?.campLeadCampId)
    || (user?.isEventsLead === true && user?.eventsLeadCampId);
  
  const isAdminOrLead = user?.accountType === 'admin' 
    || user?.accountType === 'camp'
    || (user?.isCampLead === true)
    || (user?.isEventsLead === true);
  
  const canAccessShifts = isCampContext && isAdminOrLead;

  const filteredUnassignedUsers = useMemo(() => {
    const query = assigneeSearch.trim().toLowerCase();
    if (!query) return assignmentState.unassignedUsers;

    return assignmentState.unassignedUsers.filter((assignee) => (
      [assignee.firstName, assignee.lastName, assignee.playaName, assignee.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    ));
  }, [assigneeSearch, assignmentState.unassignedUsers]);

  const selectedPendingUsers = useMemo(() => (
    assignmentState.unassignedUsers.filter((assignee) => pendingAddUserIds.includes(assignee.userId))
  ), [assignmentState.unassignedUsers, pendingAddUserIds]);

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

  const resolveReportMember = useCallback((memberId: any, fallback?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }): ReportMember => {
    const id = memberId?.toString?.() || String(memberId || '');
    const member = rosterMemberById.get(id);
    const fallbackName = `${fallback?.firstName || ''} ${fallback?.lastName || ''}`.trim()
      || fallback?.email
      || 'Unknown Member';
    return {
      id,
      personName: member ? getMemberDisplayName(member) : fallbackName,
      email: member?.email || fallback?.email || undefined,
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

  const shiftReportRows = useMemo<ShiftReportRow[]>(() => {
    return events.flatMap((event) => (
      event.shifts.map((shift) => {
        const detailById = new Map(
          (shift.memberDetails || []).map((detail) => [detail.id.toString(), detail])
        );
        return {
          eventId: event._id,
          eventName: event.eventName,
          shift,
          date: formatShiftDate(shift.date),
          dateValue: utcToPdtDateInput(shift.date),
          shiftTime: `${formatShiftTime(shift.startTime)} – ${formatShiftTime(shift.endTime)}`,
          description: shift.description || shift.title,
          signedUpMembers: (shift.memberIds || []).map((memberId) => {
            const id = memberId?.toString?.() || String(memberId || '');
            return resolveReportMember(memberId, detailById.get(id));
          })
        };
      })
    ));
  }, [events, resolveReportMember]);

  const personReportRows = useMemo<PersonReportRow[]>(() => {
    return shiftReportRows.flatMap((row) => (
      row.signedUpMembers.map((member) => ({
        shiftId: row.shift._id?.toString?.() || String(row.shift._id || ''),
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
    const shiftsByMemberId = new Map<string, PersonReportRow[]>();
    personReportRows.forEach((row) => {
      const memberId = row.member.id;
      if (!memberId) return;
      if (!shiftsByMemberId.has(memberId)) shiftsByMemberId.set(memberId, []);
      shiftsByMemberId.get(memberId)?.push(row);
    });

    return rosterMembers
      .map((rosterMember) => {
        const identityIds = [...new Set([
          rosterMember._id,
          rosterMember.memberId,
          rosterMember.userId
        ].filter(Boolean))];
        const shifts = identityIds.flatMap((identityId) => shiftsByMemberId.get(identityId) || []);
        const uniqueShifts = Array.from(
          new Map(shifts.map((shift) => [shift.shiftId, shift])).values()
        ).sort((a, b) => (
          a.dateValue.localeCompare(b.dateValue)
          || a.shiftTime.localeCompare(b.shiftTime)
          || a.shiftTitle.localeCompare(b.shiftTitle)
        ));
        return {
          member: resolveReportMember(rosterMember.userId || rosterMember.memberId || rosterMember._id),
          shifts: uniqueShifts
        };
      })
      .sort((a, b) => (
        Number(a.shifts.length > 0) - Number(b.shifts.length > 0)
        || a.member.personName.localeCompare(b.member.personName)
      ));
  }, [personReportRows, resolveReportMember, rosterMembers]);

  const membersWithoutShiftGroups = useMemo(
    () => personReportGroups.filter((group) => group.shifts.length === 0),
    [personReportGroups]
  );
  const membersWithShiftGroups = useMemo(
    () => personReportGroups.filter((group) => group.shifts.length > 0),
    [personReportGroups]
  );

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

  const eventReportGroups = useMemo<EventReportGroup[]>(() => {
    const rowsByEvent = new Map<string, ShiftReportRow[]>();
    sortedShiftReportRows.forEach((row) => {
      const rows = rowsByEvent.get(row.eventId) || [];
      rows.push(row);
      rowsByEvent.set(row.eventId, rows);
    });

    return events
      .map((event) => {
        const shifts = rowsByEvent.get(event._id) || [];
        return {
          event,
          date: event.eventDate ? formatDate(event.eventDate) : (shifts[0]?.date || 'Date TBD'),
          eventTime: event.startTime && event.endTime
            ? `${formatShiftTime(event.startTime)} – ${formatShiftTime(event.endTime)}`
            : '',
          shifts
        };
      })
      .sort((a, b) => {
        const aStart = a.shifts[0]?.shift?.startTime ? new Date(a.shifts[0].shift.startTime).getTime() : Number.MAX_SAFE_INTEGER;
        const bStart = b.shifts[0]?.shift?.startTime ? new Date(b.shifts[0].shift.startTime).getTime() : Number.MAX_SAFE_INTEGER;
        return aStart - bStart || a.event.eventName.localeCompare(b.event.eventName);
      });
  }, [events, sortedShiftReportRows]);

  const reportLabels: Record<ReportView, { print: string }> = {
    names: { print: 'Print Member Signups' },
    events: { print: 'Print Per Event' },
    day: { print: 'Print Per Day' }
  };

  const reportCampName = useMemo(() => {
    const populatedCamp = events
      .map((event) => (event as any).campId)
      .find((camp) => camp && typeof camp === 'object' && camp.name);

    return (populatedCamp && typeof populatedCamp === 'object' ? populatedCamp.name : undefined)
      || currentCampName
      || user?.campLeadCampName
      || user?.eventsLeadCampName
      || user?.campName
      || 'Camp';
  }, [currentCampName, events, user?.campLeadCampName, user?.eventsLeadCampName, user?.campName]);

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
        return applyShiftAssignmentMode(shift, mode, allRosterIds, leadRosterIds);
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
        return {
          ...shift,
          selectedUserIds: selected,
          directAssignmentUserIds: shift.assignmentMode === 'SELECTED_USERS'
            ? selected
            : shift.directAssignmentUserIds
        };
      })
    }));
  };

  const loadRosterMembers = useCallback(async () => {
    try {
      let campId;
      let campName;
      if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
        const camp = await api.get('/camps/my-camp');
        campId = camp?._id;
        campName = camp?.name || camp?.campName || user?.campName;
      } else if (user?.isCampLead && user?.campLeadCampId) {
        campId = user.campLeadCampId;
        campName = user.campLeadCampName;
      } else if (user?.isEventsLead && user?.eventsLeadCampId) {
        campId = user.eventsLeadCampId;
        campName = user.eventsLeadCampName;
      }

      if (!campId) {
        setCurrentCampId(null);
        setCurrentCampName(null);
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
      setCurrentCampName(campName || null);

      let rosterMembersFromActiveRoster: RosterMemberLite[] = [];
      try {
        const roster = await api.get(`/rosters/active?campId=${campId}`);
        setRosterMeta(deriveRosterMeta(roster));
        rosterMembersFromActiveRoster = (roster?.members || [])
          .filter(isCurrentRosterEntry)
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
      // The active roster is the reporting source of truth. Fall back to
      // active camp members only for legacy camps without roster rows.
      setRosterMembers(deduplicateRosterMembers(
        rosterMembersFromActiveRoster.length > 0
          ? rosterMembersFromActiveRoster
          : activeCampMembers
      ));
    } catch (error) {
      console.error('Error loading roster members:', error);
      setCurrentCampId(null);
      setCurrentCampName(null);
      setRosterMembers([]);
      setRosterMeta({
        hasActiveRoster: false,
        memberCount: 0,
        hasShiftsOnlyRoster: false,
        hasFullMembershipRoster: false
      });
    }
  }, [normalizeRosterMember, user?.accountType, user?.campId, user?.campName, user?.isCampLead, user?.campLeadCampId, user?.campLeadCampName, user?.isEventsLead, user?.eventsLeadCampId, user?.eventsLeadCampName]);

  const loadEvents = useCallback(async () => {
    try {
      // For Camp Leads: pass campId as query parameter for backend permission check
      let url = '/shifts/events';
      if (user?.isCampLead && user?.campLeadCampId) {
        url += `?campId=${user.campLeadCampId}`;
      } else if (user?.isEventsLead && user?.eventsLeadCampId) {
        url += `?campId=${user.eventsLeadCampId}`;
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
  }, [user?.isCampLead, user?.campLeadCampId, user?.isEventsLead, user?.eventsLeadCampId]);

  const handleShiftDropLockChange = async (event: Event, shiftDropsLocked: boolean) => {
    try {
      setLockUpdatingEventId(event._id);
      const response = await api.setEventShiftDropsLocked(event._id, shiftDropsLocked);
      const updatedEvent = response?.event || { ...event, shiftDropsLocked };
      setEvents((currentEvents) => currentEvents.map((item) => (
        item._id === event._id ? { ...item, ...updatedEvent, shiftDropsLocked } : item
      )));
      setSelectedEvent((currentEvent) => (
        currentEvent?._id === event._id
          ? { ...currentEvent, ...updatedEvent, shiftDropsLocked }
          : currentEvent
      ));
    } catch (error: any) {
      console.error('Error updating shift-drop lock:', error);
      alert(error?.response?.data?.message || 'Failed to update the shift-drop lock.');
    } finally {
      setLockUpdatingEventId(null);
    }
  };

  useEffect(() => {
    if (canAccessShifts) {
      loadEvents();
      loadRosterMembers();
    }
  }, [canAccessShifts, loadEvents, loadRosterMembers]);

  useEffect(() => {
    if (!canAccessShifts || activeTab !== 'reports') return;
    const refreshReport = () => {
      loadEvents();
      loadRosterMembers();
    };
    const refreshTimer = window.setInterval(refreshReport, 30000);
    window.addEventListener('focus', refreshReport);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refreshReport);
    };
  }, [activeTab, canAccessShifts, loadEvents, loadRosterMembers]);

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

  const hasEventWizardDraft = useMemo(() => {
    if (isEditMode) return true;

    return Boolean(
      wizardStep !== 1 ||
      eventForm.eventName.trim() ||
      eventForm.description.trim() ||
      eventForm.eventDate ||
      eventForm.startTime ||
      eventForm.endTime ||
      eventForm.shiftDropsLocked ||
      eventForm.shifts.length > 0
    );
  }, [eventForm, isEditMode, wizardStep]);

  const hasAvailableShifts = useMemo(() => {
    return events.some(event =>
      (event.shifts || []).some(shift => {
        const isExclusiveDirectAssignment = shift.assignmentMode === 'SELECTED_USERS'
          || (!shift.assignmentMode && (shift.directAssignmentUserIds || []).length > 0);
        if (isExclusiveDirectAssignment) {
          return false;
        }
        const max = shift.maxSignUps || 0;
        if (max <= 0) return false;
        const current = (shift.memberIds || []).length;
        return current < max;
      })
    );
  }, [events]);

  const coverageSnapshot = useMemo(() => {
    const rows = events.flatMap((event) => (
      (event.shifts || []).map((shift) => {
        const current = (shift.memberIds || []).length;
        const max = Math.max(Number(shift.maxSignUps) || 0, 0);
        const remaining = Math.max(max - current, 0);
        const sortTime = new Date(shift.startTime || shift.date || event.eventDate || 0).getTime();
        return {
          event,
          shift,
          current,
          max,
          remaining,
          isFull: max > 0 && remaining === 0,
          filledPercent: max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0,
          sortTime: Number.isNaN(sortTime) ? Number.MAX_SAFE_INTEGER : sortTime
        };
      })
    ));

    const understaffed = rows
      .filter((row) => row.max > 0 && !row.isFull)
      .sort((a, b) => a.sortTime - b.sortTime || b.remaining - a.remaining);
    const covered = rows
      .filter((row) => row.isFull)
      .sort((a, b) => a.sortTime - b.sortTime);
    const openSpots = understaffed.reduce((total, row) => total + row.remaining, 0);
    const totalCapacity = rows.reduce((total, row) => total + row.max, 0);
    const filledSpots = rows.reduce((total, row) => total + Math.min(row.current, row.max), 0);

    return {
      understaffed,
      covered,
      openSpots,
      coveragePercent: totalCapacity > 0 ? Math.round((filledSpots / totalCapacity) * 100) : 0
    };
  }, [events]);

  const handleCreateEvent = async () => {
    if (eventSaving) return;
    setEventSaving(true);

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
      } else if (user?.isEventsLead && user?.eventsLeadCampId) {
        console.log('🔍 [Event Creation] Detected Events Lead account, using eventsLeadCampId...');
        campId = user.eventsLeadCampId;
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
        shiftDropsLocked: eventForm.shiftDropsLocked,
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
          directAssignmentUserIds: shift.directAssignmentUserIds,
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
        ? await api.put(`/shifts/events/${eventToEdit._id}`, eventData, { timeout: 60000 })
        : await api.post('/shifts/events', eventData, { timeout: 60000 });

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
      const serverMessage = error.response?.data?.message;
      if (error.response?.status === 403) {
        alert('Access denied. Only camp admins can manage events.');
      } else if (error.response?.status === 400) {
        alert(serverMessage || 'Invalid data. Please check all required fields are filled.');
      } else if (error.response?.status === 409) {
        alert(serverMessage || 'One or more shifts do not have enough open spots for those assignments.');
      } else if (error.response?.status === 404 && isEditMode) {
        alert('Event not found. It may have been deleted.');
      } else if (error.code === 'ECONNABORTED') {
        alert('The event save timed out before confirmation. Refresh the page to verify the event before trying again.');
      } else {
        alert(`Error ${isEditMode ? 'updating' : 'creating'} event. Please try again.`);
      }
    } finally {
      setEventSaving(false);
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
        directAssignmentUserIds: [],
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
        directAssignmentUserIds: [],
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
      shiftDropsLocked: false,
      shifts: []
    });
    setLoadingExistingAssignments(false);
    setIsEditMode(false);
    setEventToEdit(null);
    setWizardStep(1);
    setBulkShiftSelection([]);
    setGlobalInviteMode('ALL_ROSTER');
  };

  const handleCloseEventWizard = () => {
    if (eventSaving) return;

    if (hasEventWizardDraft) {
      const confirmed = window.confirm(
        isEditMode
          ? 'Discard your event edits? Unsaved event details and shifts will be lost.'
          : 'Discard this new event? Unsaved event details and shifts will be lost.'
      );
      if (!confirmed) return;
    }

    setShowCreateModal(false);
    resetForm();
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
      shiftDropsLocked: event.shiftDropsLocked === true,
      shifts: event.shifts.map((shift, index) => {
        const assignmentMode = shift.assignmentMode || 'ALL_ROSTER';
        const directAssignmentUserIds = Array.from(new Set([
          ...((shift.directAssignmentUserIds || []).map((id) => id?.toString()).filter(Boolean)),
          ...(assignmentResponses[index]?.assignedUsers || [])
            .map((assignedUser: any) => assignedUser?.userId?.toString())
            .filter(Boolean)
        ])) as string[];
        const selectedUserIds = assignmentMode === 'ALL_ROSTER'
          ? allRosterIds
          : assignmentMode === 'LEADS_ONLY'
            ? leadRosterIds
            : directAssignmentUserIds;
        return {
          _id: shift._id?.toString(),
          title: shift.title,
          description: shift.description || '',
          date: utcToPdtDateInput(shift.date),
          startTime: utcToPdtTimeInput(shift.startTime),
          endTime: utcToPdtTimeInput(shift.endTime),
          maxSignUps: shift.maxSignUps,
          currentSignups: shift.memberIds?.length || 0,
          assignmentMode,
          selectedUserIds,
          directAssignmentUserIds,
          requiredSkills: Array.isArray((shift as any).requiredSkills) ? (shift as any).requiredSkills : []
        };
      })
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
      shifts: prev.shifts.map((shift) => (
        applyShiftAssignmentMode(shift, globalInviteMode, allRosterIds, leadRosterIds)
      ))
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

  const openAssignmentModal = async (shift: any, parentEvent?: Event) => {
    try {
      const shiftWithEventContext = parentEvent
        ? {
          ...shift,
          eventName: parentEvent.eventName,
          eventDate: parentEvent.eventDate,
          eventStartTime: parentEvent.startTime,
          eventEndTime: parentEvent.endTime
        }
        : shift;
      setSelectedShiftForAssignment(shiftWithEventContext);
      setShowAssignmentModal(true);
      setAssignmentLoading(true);
      setPendingAddUserIds([]);
      setAssigneeSearch('');
      const response = await api.getShiftAssignees(shift._id);
      setAssignmentState({
        isDirectAssignmentLocked: response.isDirectAssignmentLocked === true,
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

  const togglePendingAssignee = (userId: string) => {
    setPendingAddUserIds((currentIds) => (
      currentIds.includes(userId)
        ? currentIds.filter((id) => id !== userId)
        : [...currentIds, userId]
    ));
  };

  const handleAddAssignees = async () => {
    if (!selectedShiftForAssignment || pendingAddUserIds.length === 0) return;
    try {
      setAssignmentSaving(true);
      await api.addShiftAssignees(selectedShiftForAssignment._id, pendingAddUserIds);
      await openAssignmentModal(selectedShiftForAssignment);
      await loadEvents();
      alert('Shift officially assigned. Their spot is confirmed and no response is required.');
    } catch (error: any) {
      console.error('Error adding assignees:', error);
      alert(error?.response?.data?.message || 'Failed to add assignees');
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleRemoveAssignee = async (userId: string) => {
    if (!selectedShiftForAssignment) return;
    const assignee = assignmentState.assignedUsers.find((user) => user.userId === userId);
    const assigneeName = assignee
      ? (`${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.email || 'this former roster member')
      : 'this person';
    const availabilityAfterRemoval = assignmentState.isDirectAssignmentLocked
      ? 'The shift will open to others after the final direct assignee is removed.'
      : 'Any remaining capacity will stay open under the current invitation strategy.';
    const confirmed = window.confirm(
      `Unassign ${assigneeName}? Their confirmed signup will be removed and their spot will be released. ${availabilityAfterRemoval}`
    );
    if (!confirmed) return;

    try {
      setAssignmentSaving(true);
      await api.removeShiftAssignee(selectedShiftForAssignment._id, userId);
      await openAssignmentModal(selectedShiftForAssignment);
      await loadEvents();
    } catch (error: any) {
      console.error('Error removing direct assignee:', error);
      alert(error?.response?.data?.message || 'Failed to remove direct assignee');
    } finally {
      setAssignmentSaving(false);
    }
  };

  // Using shared date formatting utilities

  const handlePrintReportView = () => {
    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) return;

    const title = `Volunteer Shift Report - ${reportCampName}`;
    const viewFileLabel = reportType === 'names'
      ? 'member-shift-signups'
      : reportType === 'events'
        ? 'events'
        : selectedDate
          ? `day-${selectedDate}`
          : 'all-days';
    const printFileName = `${reportCampName}-volunteer-shifts-${viewFileLabel}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const escapeHtml = (value: any) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const renderPrintMember = (member: ReportMember) => escapeHtml(member.personName);

    const renderNamesTable = (groups: PersonReportGroup[], emptyMessage: string) => groups.length === 0
      ? `<p class="empty">${escapeHtml(emptyMessage)}</p>`
      : `
        <table class="names-table">
          <thead>
            <tr>
              <th>Name</th>
              <th class="count-col">Shifts</th>
              <th>Shift, Event, Date and Time</th>
            </tr>
          </thead>
          <tbody>
            ${groups.map((group) => `
              <tr>
                <td class="name-cell">
                  <strong>${renderPrintMember(group.member)}</strong>
                </td>
                <td class="count-col">${group.shifts.length}</td>
                <td>
                  <div class="shift-lines">
                    ${group.shifts.map((row) => `
                      <div class="shift-line">
                        <strong>${escapeHtml(row.shiftTitle)}</strong>
                        <span>${escapeHtml(row.eventName)}</span>
                        <span>${escapeHtml(row.date)} · ${escapeHtml(row.shiftTime)}</span>
                      </div>
                    `).join('')}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    const namesSections = personReportGroups.length === 0
      ? '<p class="empty">No active roster members found.</p>'
      : `
        <section class="names-section">
          <h2>Members With No Shifts (${membersWithoutShiftGroups.length})</h2>
          ${renderNamesTable(membersWithoutShiftGroups, 'Every active member has at least one shift.')}
        </section>
        <section class="names-section">
          <h2>Members With Shifts (${membersWithShiftGroups.length})</h2>
          ${renderNamesTable(membersWithShiftGroups, 'No active members have signed up for a shift yet.')}
        </section>
      `;

    const renderShiftRows = (rows: ShiftReportRow[], { showEvent = false, showDate = false } = {}) => rows.map((row) => {
      const people = row.signedUpMembers.length > 0
        ? row.signedUpMembers
          .map((member) => renderPrintMember(member))
          .join(', ')
        : '<span class="empty">No sign-ups</span>';
      return `
        <tr>
          ${showDate ? `<td class="date-cell">${escapeHtml(row.date)}</td>` : ''}
          <td class="time-cell">${escapeHtml(row.shiftTime)}</td>
          ${showEvent ? `<td>${escapeHtml(row.eventName)}</td>` : ''}
          <td class="shift-cell"><strong>${escapeHtml(row.shift.title)}</strong></td>
          <td class="people-cell">${people}</td>
        </tr>
      `;
    }).join('');

    const eventSections = eventReportGroups.map((group) => `
      <section class="event-section">
        <div class="event-heading">
          <h2>${escapeHtml(group.event.eventName)}</h2>
          <span>${escapeHtml(group.date)}${group.eventTime ? ` · ${escapeHtml(group.eventTime)}` : ''} · ${group.shifts.length} shift${group.shifts.length === 1 ? '' : 's'}</span>
        </div>
        <table class="report-table">
          <colgroup>
            <col class="date-col">
            <col class="time-col">
            <col class="shift-col">
            <col class="people-col">
          </colgroup>
          <thead>
            <tr><th>Date</th><th>Time</th><th>Shift</th><th>People</th></tr>
          </thead>
          <tbody>
            ${group.shifts.length > 0 ? renderShiftRows(group.shifts, { showDate: true }) : '<tr><td colspan="4" class="empty">No shifts scheduled.</td></tr>'}
          </tbody>
        </table>
      </section>
    `).join('');

    const daySections = dayReportGroups.length === 0
      ? '<p class="empty">No shifts scheduled for selected day.</p>'
      : dayReportGroups.map((group) => `
        <section class="event-section">
          <div class="event-heading"><h2>${escapeHtml(group.date)}</h2></div>
          <table class="report-table">
            <colgroup>
              <col class="time-col">
              <col class="event-col">
              <col class="shift-col">
              <col class="people-col">
            </colgroup>
            <thead>
              <tr><th>Time</th><th>Event</th><th>Shift</th><th>People</th></tr>
            </thead>
            <tbody>${renderShiftRows(group.shifts, { showEvent: true })}</tbody>
          </table>
        </section>
      `).join('');

    const reportBody = reportType === 'names'
      ? namesSections
      : reportType === 'events'
        ? eventSections || '<p class="empty">No events scheduled yet.</p>'
        : daySections;

    const scopedMeta = reportType === 'day' && selectedDate
      ? ` · ${shiftDateOptions.find((option) => option.value === selectedDate)?.label || selectedDate}`
      : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(printFileName)}</title>
          <style>
            @page { size: landscape; margin: 0.35in; }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; margin: 0; color: #111827; font-size: 9px; }
            h1 { margin: 0 0 3px; font-size: 18px; }
            h2 { margin: 0; font-size: 13px; }
            .meta { color: #4b5563; margin-bottom: 10px; font-size: 9px; }
            .event-section, .names-section { margin-bottom: 12px; }
            .event-heading { border: 1px solid #9ca3af; border-bottom: 0; background: #e5e7eb; padding: 5px 7px; break-after: avoid; }
            .event-heading h2 { display: inline; margin-right: 8px; }
            .event-heading span { color: #374151; font-weight: 600; }
            .report-table, .names-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .report-table thead, .names-table thead { display: table-header-group; }
            .report-table th, .names-table th { background: #f3f4f6; text-align: left; border: 1px solid #9ca3af; padding: 3px 4px; font-size: 8px; text-transform: uppercase; letter-spacing: .02em; }
            .report-table td, .names-table td { border: 1px solid #bfc3c9; padding: 3px 4px; vertical-align: top; line-height: 1.25; overflow-wrap: anywhere; }
            .report-table tr, .names-table tr { break-inside: avoid; }
            .date-col { width: 17%; }
            .time-col { width: 20%; }
            .event-col { width: 22%; }
            .shift-col { width: 25%; }
            .people-col { width: auto; }
            .date-cell, .time-cell { white-space: nowrap; }
            .shift-cell, .people-cell { min-width: 0; white-space: normal; overflow-wrap: anywhere; word-break: normal; }
            .names-section > h2 { margin-bottom: 4px; }
            .name-cell { width: 25%; }
            .count-col, .center { text-align: center; }
            .count-col { width: 48px; }
            .shift-lines { display: grid; gap: 3px; }
            .shift-line strong, .shift-line span { display: block; }
            .shift-line span { color: #4b5563; }
            .nowrap { white-space: nowrap; }
            .empty { color: #6b7280; font-style: italic; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <div class="meta">All dates and times: ${escapeHtml(PDT_LABEL)}${escapeHtml(scopedMeta)}</div>
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
      } else if (user?.isEventsLead && user?.eventsLeadCampId) {
        campId = user.eventsLeadCampId;
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
      } else if (user?.isEventsLead && user?.eventsLeadCampId) {
        campId = user.eventsLeadCampId;
      }
      const response = await api.inviteEntireRosterToAllShifts(campId, {
        previewOnly: true,
        skipRecentDays
      });
      setInvitePreview(response.recipientPreview || null);
    } catch (_error) {
      setInvitePreview(null);
    }
  }, [skipRecentDays, user?.accountType, user?.campId, user?.isCampLead, user?.campLeadCampId, user?.isEventsLead, user?.eventsLeadCampId]);

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
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-gray-900">Coverage snapshot</h4>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            coverageSnapshot.understaffed.length === 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {coverageSnapshot.understaffed.length === 0 ? 'All covered' : 'Action needed'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          Staffing across all events, with the shifts that need help shown first.
                        </p>
                      </div>
                      {hasRoster && hasAvailableShifts && coverageSnapshot.understaffed.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowBulkInviteModal(true)}
                          disabled={bulkInviteLoading}
                          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2"
                        >
                          <Users className="h-4 w-4" />
                          Notify roster
                        </Button>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <div className={`rounded-lg border p-3 ${
                        coverageSnapshot.openSpots > 0
                          ? 'border-red-200 bg-red-50'
                          : 'border-green-200 bg-green-50'
                      }`}>
                        <p className="text-xs font-medium text-gray-600">Open spots</p>
                        <p className={`mt-1 text-2xl font-bold ${coverageSnapshot.openSpots > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {coverageSnapshot.openSpots}
                        </p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-medium text-gray-600">Shifts needing help</p>
                        <p className="mt-1 text-2xl font-bold text-amber-800">{coverageSnapshot.understaffed.length}</p>
                      </div>
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <p className="text-xs font-medium text-gray-600">Fully staffed</p>
                        <p className="mt-1 text-2xl font-bold text-green-700">{coverageSnapshot.covered.length}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-600">Overall coverage</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{coverageSnapshot.coveragePercent}%</p>
                      </div>
                    </div>
                  </div>

                  {coverageSnapshot.understaffed.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-6">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <h5 className="text-sm font-semibold text-gray-900">Needs attention</h5>
                        </div>
                        <span className="text-xs text-gray-500">Soonest shifts first</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {(showAllCoverageGaps
                          ? coverageSnapshot.understaffed
                          : coverageSnapshot.understaffed.slice(0, 5)
                        ).map((row) => (
                          <div key={`coverage-${row.shift._id}`} className="px-4 py-4 sm:px-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-gray-900">{row.shift.title}</p>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    row.current === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {row.current === 0
                                      ? `Empty · needs ${row.remaining}`
                                      : `Needs ${row.remaining} more`}
                                  </span>
                                </div>
                                <p className="mt-1 truncate text-sm text-gray-600">{row.event.eventName}</p>
                                <p className="mt-1 text-xs text-gray-500">
                                  {formatShiftDate(row.shift.date || row.event.eventDate || row.shift.startTime)}
                                  {' · '}{formatShiftTime(row.shift.startTime)}–{formatShiftTime(row.shift.endTime)}
                                </p>
                              </div>

                              <div className="w-full lg:w-56">
                                <div className="mb-1.5 flex items-center justify-between text-xs">
                                  <span className="font-medium text-gray-700">{row.current} of {row.max} filled</span>
                                  <span className="text-gray-500">{row.filledPercent}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                                  <div
                                    className={`h-full rounded-full ${row.current === 0 ? 'bg-red-500' : 'bg-amber-500'}`}
                                    style={{ width: `${row.filledPercent}%` }}
                                  />
                                </div>
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAssignmentModal(row.shift, row.event)}
                                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 lg:min-w-[132px]"
                              >
                                <UserPlus className="h-4 w-4" />
                                Assign people
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {coverageSnapshot.understaffed.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllCoverageGaps((current) => !current)}
                          className="flex w-full items-center justify-center gap-1.5 border-t border-gray-100 px-4 py-3 text-sm font-medium text-custom-primary hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-custom-primary"
                          aria-expanded={showAllCoverageGaps}
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${showAllCoverageGaps ? 'rotate-180' : ''}`} />
                          {showAllCoverageGaps
                            ? 'Show fewer shifts'
                            : `Show all ${coverageSnapshot.understaffed.length} understaffed shifts`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 px-4 py-5 sm:px-6">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Every shift is fully staffed</p>
                        <p className="mt-1 text-sm text-gray-600">No staffing follow-up is needed right now.</p>
                      </div>
                    </div>
                  )}

                  {coverageSnapshot.covered.length > 0 && (
                    <div className="border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowCoveredShifts((current) => !current)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-custom-primary sm:px-6"
                        aria-expanded={showCoveredShifts}
                      >
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Fully staffed shifts ({coverageSnapshot.covered.length})
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showCoveredShifts ? 'rotate-180' : ''}`} />
                      </button>
                      {showCoveredShifts && (
                        <div className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50">
                          {coverageSnapshot.covered.map((row) => (
                            <div key={`covered-${row.shift._id}`} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
                              <div className="min-w-0">
                                <span className="font-medium text-gray-900">{row.shift.title}</span>
                                <span className="text-gray-500"> · {row.event.eventName}</span>
                              </div>
                              <div className="shrink-0 text-xs text-gray-500">
                                {formatShiftDate(row.shift.date || row.event.eventDate || row.shift.startTime)} · {row.current}/{row.max} filled
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                            event.shiftDropsLocked
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {event.shiftDropsLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                            {event.shiftDropsLocked ? 'Shift drops locked' : 'Shift drops allowed'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={lockUpdatingEventId === event._id}
                          onClick={() => handleShiftDropLockChange(event, !event.shiftDropsLocked)}
                          className={event.shiftDropsLocked ? 'text-green-700 border-green-600' : 'text-amber-700 border-amber-600'}
                        >
                          {event.shiftDropsLocked
                            ? <Unlock className="w-4 h-4 mr-1" />
                            : <Lock className="w-4 h-4 mr-1" />}
                          {lockUpdatingEventId === event._id
                            ? 'Saving...'
                            : event.shiftDropsLocked
                              ? 'Allow Drops'
                              : 'Lock Drops'}
                        </Button>
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
                            {shift.memberIds.length >= shift.maxSignUps ? (
                              <span className="text-green-600 font-medium">Full</span>
                            ) : (
                              <>
                                {shift.memberIds.length}/{shift.maxSignUps} signed up
                                <span className="ml-2 text-green-700">
                                  {Math.max(shift.maxSignUps - shift.memberIds.length, 0)} spots remaining
                                </span>
                              </>
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
                <span className="block text-sm font-semibold">Member Shift Signups</span>
                <span className="block text-xs text-gray-500">
                  {membersWithoutShiftGroups.length} without shifts · {membersWithShiftGroups.length} with shifts
                </span>
              </button>
              <button
                type="button"
                onClick={() => setReportType('events')}
                className={`rounded-lg border px-4 py-3 text-left transition ${reportType === 'events' ? 'border-orange-300 bg-orange-50 text-orange-800 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200'}`}
              >
                <span className="block text-sm font-semibold">Per Event</span>
                <span className="block text-xs text-gray-500">{eventReportGroups.length} events · {sortedShiftReportRows.length} shifts</span>
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

            {events.length === 0 && reportType !== 'names' ? (
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
                      <p>No active roster members found.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {[
                        {
                          title: 'Members With No Shifts',
                          description: 'Active roster members who still need a shift signup.',
                          groups: membersWithoutShiftGroups,
                          emptyMessage: 'Every active member has at least one shift.',
                          tone: 'rose'
                        },
                        {
                          title: 'Members With Shifts',
                          description: 'Active roster members with one or more confirmed shift signups.',
                          groups: membersWithShiftGroups,
                          emptyMessage: 'No active members have signed up for a shift yet.',
                          tone: 'green'
                        }
                      ].map((section) => (
                        <section
                          key={section.title}
                          className={`overflow-visible rounded-lg border bg-white shadow-sm ${section.tone === 'rose' ? 'border-rose-200' : 'border-green-200'}`}
                        >
                          <div className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${section.tone === 'rose' ? 'border-rose-100 bg-rose-50' : 'border-green-100 bg-green-50'}`}>
                            <div>
                              <h3 className="font-semibold text-gray-900">{section.title}</h3>
                              <p className="text-xs text-gray-600">{section.description}</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${section.tone === 'rose' ? 'bg-rose-100 text-rose-800' : 'bg-green-100 text-green-800'}`}>
                              {section.groups.length}
                            </span>
                          </div>
                          {section.groups.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-gray-500">{section.emptyMessage}</div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {section.groups.map((group) => (
                                <div
                                  key={group.member.id || group.member.personName}
                                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    {group.member.link ? (
                                      <Link
                                        to={group.member.link}
                                        className="font-semibold text-orange-700 hover:text-orange-800 hover:underline"
                                      >
                                        {group.member.personName}
                                      </Link>
                                    ) : (
                                      <span className="font-semibold text-gray-900">{group.member.personName}</span>
                                    )}
                                    {group.member.email && (
                                      <div className="truncate text-xs text-gray-500">{group.member.email}</div>
                                    )}
                                  </div>
                                  <div className="relative self-start sm:self-auto group">
                                    <span
                                      tabIndex={group.shifts.length > 0 ? 0 : undefined}
                                      className={`inline-flex min-w-[6.5rem] items-center justify-center rounded-full px-3 py-1.5 text-sm font-semibold ${group.shifts.length > 0 ? 'cursor-help bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'}`}
                                      aria-label={`${group.shifts.length} shift${group.shifts.length === 1 ? '' : 's'}`}
                                    >
                                      {group.shifts.length} shift{group.shifts.length === 1 ? '' : 's'}
                                    </span>
                                    {group.shifts.length > 0 && (
                                      <div className="pointer-events-none absolute right-0 top-full z-40 mt-2 hidden w-80 max-w-[calc(100vw-3rem)] rounded-lg border border-gray-200 bg-white p-3 text-left shadow-xl group-hover:block group-focus-within:block">
                                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Confirmed shifts</div>
                                        <div className="space-y-2">
                                          {group.shifts.map((shift) => (
                                            <div key={`${group.member.id}-${shift.shiftId}`} className="border-b border-gray-100 pb-2 text-xs last:border-0 last:pb-0">
                                              <div className="font-semibold text-gray-900">{shift.shiftTitle}</div>
                                              <div className="text-gray-600">{shift.eventName}</div>
                                              <div className="text-gray-500">{shift.date} · {shift.shiftTime}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      ))}
                    </div>
                  )
                )}

                {reportType === 'events' && (
                  <div className="space-y-5">
                    {eventReportGroups.map((group) => (
                      <section key={group.event._id} className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
                        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
                          <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
                            <h3 className="font-semibold text-gray-900">{group.event.eventName}</h3>
                            <span className="text-xs font-medium text-gray-600">
                              {group.date}{group.eventTime ? ` · ${group.eventTime}` : ''} · {group.shifts.length} shift{group.shifts.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          {group.event.description && (
                            <p className="mt-1 text-xs text-gray-600">{group.event.description}</p>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-[980px] w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-gray-50 text-left uppercase tracking-wide text-gray-600">
                                <th className="border-b border-r border-gray-300 px-2 py-2">Date</th>
                                <th className="border-b border-r border-gray-300 px-2 py-2">Time</th>
                                <th className="border-b border-r border-gray-300 px-2 py-2">Shift</th>
                                <th className="border-b border-r border-gray-300 px-2 py-2">Person</th>
                                <th className="border-b border-r border-gray-300 px-2 py-2">Email</th>
                                <th className="border-b border-r border-gray-300 px-2 py-2">Shift information</th>
                                <th className="border-b border-gray-300 px-2 py-2 text-center">Staffing</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.shifts.length === 0 ? (
                                <tr><td colSpan={7} className="px-3 py-4 text-gray-500">No shifts scheduled.</td></tr>
                              ) : group.shifts.map((row) => {
                                const stats = getShiftStats(row.shift);
                                const emails = row.signedUpMembers
                                  .map((member) => member.email)
                                  .filter(Boolean)
                                  .join(', ');
                                return (
                                  <tr key={row.shift._id} className="border-b border-gray-200 last:border-b-0 align-top">
                                    <td className="whitespace-nowrap border-r border-gray-200 px-2 py-2">{row.date}</td>
                                    <td className="whitespace-nowrap border-r border-gray-200 px-2 py-2">{row.shiftTime}</td>
                                    <td className="border-r border-gray-200 px-2 py-2 font-semibold text-gray-900">{row.shift.title}</td>
                                    <td className="border-r border-gray-200 px-2 py-2">
                                      {row.signedUpMembers.length > 0 ? (
                                        <div className="leading-5">
                                          {row.signedUpMembers.map((member, memberIndex) => (
                                            <span key={`${row.shift._id}-${member.id}-${memberIndex}`} className="mr-1.5 inline">
                                              {member.link ? (
                                                <Link to={member.link} className="font-medium text-orange-700 hover:underline">{member.personName}</Link>
                                              ) : member.personName}
                                              {memberIndex < row.signedUpMembers.length - 1 ? ',' : ''}
                                            </span>
                                          ))}
                                        </div>
                                      ) : <span className="italic text-gray-500">No sign-ups</span>}
                                    </td>
                                    <td className="border-r border-gray-200 px-2 py-2 text-gray-600">{emails}</td>
                                    <td className="border-r border-gray-200 px-2 py-2 text-gray-600">
                                      {row.description !== row.shift.title ? row.description : ''}
                                    </td>
                                    <td className="whitespace-nowrap px-2 py-2 text-center text-gray-600">
                                      <span className="font-semibold text-gray-900">{stats.current}/{stats.max}</span> signed<br />{stats.remaining} open
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
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
                        <section key={group.dateValue || group.date} className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
                          <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
                            <div className="flex items-baseline justify-between gap-4">
                              <h3 className="font-semibold text-gray-900">{group.date}</h3>
                              <span className="text-xs font-medium text-gray-600">
                                {new Set(group.shifts.map((row) => row.eventId)).size} event{new Set(group.shifts.map((row) => row.eventId)).size === 1 ? '' : 's'} · {group.shifts.length} shift{group.shifts.length === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-[980px] w-full border-collapse text-xs">
                              <thead>
                                <tr className="bg-gray-50 text-left uppercase tracking-wide text-gray-600">
                                  <th className="border-b border-r border-gray-300 px-2 py-2">Time</th>
                                  <th className="border-b border-r border-gray-300 px-2 py-2">Event</th>
                                  <th className="border-b border-r border-gray-300 px-2 py-2">Shift</th>
                                  <th className="border-b border-r border-gray-300 px-2 py-2">Person</th>
                                  <th className="border-b border-r border-gray-300 px-2 py-2">Email</th>
                                  <th className="border-b border-r border-gray-300 px-2 py-2">Shift information</th>
                                  <th className="border-b border-gray-300 px-2 py-2 text-center">Staffing</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.shifts.map((row) => {
                                  const stats = getShiftStats(row.shift);
                                  const emails = row.signedUpMembers
                                    .map((member) => member.email)
                                    .filter(Boolean)
                                    .join(', ');
                                  return (
                                    <tr key={row.shift._id} className="border-b border-gray-200 last:border-b-0 align-top">
                                      <td className="whitespace-nowrap border-r border-gray-200 px-2 py-2">{row.shiftTime}</td>
                                      <td className="border-r border-gray-200 px-2 py-2 font-medium text-gray-900">{row.eventName}</td>
                                      <td className="border-r border-gray-200 px-2 py-2 font-semibold text-gray-900">{row.shift.title}</td>
                                      <td className="border-r border-gray-200 px-2 py-2">
                                        {row.signedUpMembers.length > 0 ? (
                                          <div className="leading-5">
                                            {row.signedUpMembers.map((member, memberIndex) => (
                                              <span key={`${row.shift._id}-${member.id}-${memberIndex}`} className="mr-1.5 inline">
                                                {member.link ? (
                                                  <Link to={member.link} className="font-medium text-orange-700 hover:underline">{member.personName}</Link>
                                                ) : member.personName}
                                                {memberIndex < row.signedUpMembers.length - 1 ? ',' : ''}
                                              </span>
                                            ))}
                                          </div>
                                        ) : <span className="italic text-gray-500">No sign-ups</span>}
                                      </td>
                                      <td className="border-r border-gray-200 px-2 py-2 text-gray-600">{emails}</td>
                                      <td className="border-r border-gray-200 px-2 py-2 text-gray-600">
                                        {row.description !== row.shift.title ? row.description : ''}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-2 text-center text-gray-600">
                                        <span className="font-semibold text-gray-900">{stats.current}/{stats.max}</span> signed<br />{stats.remaining} open
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </section>
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
        onClose={handleCloseEventWizard}
        title={isEditMode ? `Edit Event: ${eventToEdit?.eventName}` : "Create New Event"}
        size="lg"
        closeOnOverlayClick={false}
        closeOnEscape={false}
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
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={eventForm.shiftDropsLocked}
                  onChange={(event) => setEventForm((previous) => ({
                    ...previous,
                    shiftDropsLocked: event.target.checked
                  }))}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Lock shift drops for this event</span>
                  <span className="block text-xs text-gray-600 mt-1">
                    Signed-up members cannot drop any shift in this event. Camp admins, Events Leads, and Camp Leads can still manage assignments.
                  </span>
                </span>
              </label>
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
                <p className="text-xs mt-1">Invite to sign up = notify members. Assign directly = confirm specific members onto a shift immediately, with no response required.</p>
                <p className="text-xs mt-1">
                  <strong>Heads up:</strong> confirmed direct assignees keep their spots when you switch invitation strategies. <em>Invite to sign up</em> opens only the remaining capacity; <em>Assign directly</em> keeps the shift exclusive to the people you pick.
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
                        {shift.directAssignmentUserIds.length > 0
                          ? ` • ${shift.directAssignmentUserIds.length} confirmed`
                          : ''}
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
                        <>Confirmed direct assignees keep their spots. Everyone on the roster can claim only the remaining spots, including future members.</>
                      )}
                      {shift.assignmentMode === 'LEADS_ONLY' && (
                        <>Confirmed direct assignees keep their spots. Camp Leads can claim only the remaining spots; plain members cannot.</>
                      )}
                      {shift.assignmentMode === 'SELECTED_USERS' && (
                        <>The people you pick below are officially assigned immediately and consume the selected spots. Everyone else remains blocked until you unassign the final person.</>
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
                          const directlyAssigned = shift.directAssignmentUserIds.includes(member._id);
                          return {
                            member,
                            skillMatchPercent,
                            priorShiftCount,
                            alreadyInvited,
                            directlyAssigned
                          };
                        })
                        .sort((a, b) => (b.skillMatchPercent - a.skillMatchPercent) || (a.priorShiftCount - b.priorShiftCount))
                        .map(({ member, skillMatchPercent, priorShiftCount, alreadyInvited, directlyAssigned }) => {
                          const label = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
                          return (
                            <label key={`${index}-${member._id}`} className="flex items-center justify-between gap-2">
                              <span className="text-sm">
                                {label} {member.isLead ? <span className="text-xs text-orange-700">(Lead)</span> : null}
                                {directlyAssigned ? <span className="ml-1 text-xs font-medium text-green-700">(Confirmed)</span> : null}
                                <span className="block text-[11px] text-gray-500">
                                  Skill match {skillMatchPercent}% • Prior shifts {priorShiftCount} • {directlyAssigned ? 'Spot confirmed' : alreadyInvited ? 'Already invited' : 'Not invited'}
                                </span>
                              </span>
                              <input
                                type="checkbox"
                                checked={shift.selectedUserIds.includes(member._id)}
                                disabled={directlyAssigned && shift.assignmentMode !== 'SELECTED_USERS'}
                                title={directlyAssigned && shift.assignmentMode !== 'SELECTED_USERS'
                                  ? 'Unassign this confirmed spot from the shift assignment panel.'
                                  : undefined}
                                onChange={() => toggleSelectedUser(index, member._id)}
                              />
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
                <p className={`text-sm mt-1 ${eventForm.shiftDropsLocked ? 'text-amber-700' : 'text-green-700'}`}>
                  {eventForm.shiftDropsLocked
                    ? 'Shift drops will be locked for this event.'
                    : 'Members will be allowed to drop shifts for this event.'}
                </p>
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
              onClick={handleCloseEventWizard}
              disabled={eventSaving}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            {wizardStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setWizardStep((prev) => (Math.max(prev - 1, 1) as 1 | 2 | 3 | 4))}
                disabled={eventSaving}
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
                disabled={eventSaving || (wizardStep === 1 && (!eventForm.eventName || !eventForm.eventDate || !eventForm.startTime || !eventForm.endTime))}
              >
                Next
              </Button>
            )}
            {wizardStep === 4 && (
              <Button
                variant="primary"
                onClick={handleCreateEvent}
                disabled={!canSaveEvent || eventSaving}
                className="flex-1 min-h-[44px]"
              >
                <Save className="w-4 h-4 mr-2" />
                {eventSaving ? 'Saving...' : isEditMode ? 'Save' : 'Publish Event'}
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
                <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                  selectedEvent.shiftDropsLocked
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {selectedEvent.shiftDropsLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {selectedEvent.shiftDropsLocked
                    ? 'Members cannot drop shifts for this event'
                    : 'Members can drop shifts for this event'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={lockUpdatingEventId === selectedEvent._id}
                  onClick={() => handleShiftDropLockChange(selectedEvent, !selectedEvent.shiftDropsLocked)}
                  className={`ml-2 ${selectedEvent.shiftDropsLocked ? 'text-green-700 border-green-600' : 'text-amber-700 border-amber-600'}`}
                >
                  {lockUpdatingEventId === selectedEvent._id
                    ? 'Saving...'
                    : selectedEvent.shiftDropsLocked
                      ? 'Allow Shift Drops'
                      : 'Lock Shift Drops'}
                </Button>
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
                          {((shift.directAssignmentUserIds || []).length > 0 || shift.assignmentMode === 'SELECTED_USERS') && (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                              Directly assigned
                            </span>
                          )}
                          <span className={`text-sm ${
                            shift.memberIds.length >= shift.maxSignUps
                              ? 'font-medium text-green-600'
                              : 'text-gray-500'
                          }`}>
                            {shift.memberIds.length >= shift.maxSignUps
                              ? 'Full'
                              : `${shift.memberIds.length}/${shift.maxSignUps} signed up`}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAssignmentModal(shift, selectedEvent)}
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
                        <div className="text-[11px] mt-1">Direct assignments reserve confirmed spots. The invitation strategy controls who can claim any capacity that remains.</div>
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
          setAssigneeSearch('');
        }}
        title={selectedShiftForAssignment ? `Assign Directly: ${selectedShiftForAssignment.title}` : 'Assign Directly'}
        size="lg"
      >
        <div className="space-y-4">
          {selectedShiftForAssignment && (
            <section
              aria-label="Shift details"
              className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Shift</p>
                  <h3 className="mt-0.5 text-lg font-semibold text-gray-900">
                    {selectedShiftForAssignment.title}
                  </h3>
                </div>
                <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-800">
                  {selectedShiftForAssignment.maxSignUps} {selectedShiftForAssignment.maxSignUps === 1 ? 'spot' : 'spots'}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-orange-100 bg-white/80 px-3 py-2 sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Event / Party</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">
                    {selectedShiftForAssignment.eventName || selectedEvent?.eventName || 'Event name unavailable'}
                  </dd>
                </div>
                <div className="rounded-lg border border-orange-100 bg-white/80 px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Starts</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">
                    {formatDate(
                      selectedShiftForAssignment.startTime
                      || selectedShiftForAssignment.date
                      || selectedShiftForAssignment.eventStartTime
                      || selectedShiftForAssignment.eventDate
                    )}
                    {' at '}
                    {formatShiftTime(selectedShiftForAssignment.startTime || selectedShiftForAssignment.eventStartTime)}
                  </dd>
                </div>
                <div className="rounded-lg border border-orange-100 bg-white/80 px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ends</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">
                    {formatDate(
                      selectedShiftForAssignment.endTime
                      || selectedShiftForAssignment.date
                      || selectedShiftForAssignment.eventEndTime
                      || selectedShiftForAssignment.eventDate
                    )}
                    {' at '}
                    {formatShiftTime(selectedShiftForAssignment.endTime || selectedShiftForAssignment.eventEndTime)}
                  </dd>
                </div>
              </dl>

              {selectedShiftForAssignment.description && (
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {selectedShiftForAssignment.description}
                </p>
              )}
              <p className="mt-2 text-[11px] font-medium text-orange-700">
                Times shown in {PDT_LABEL}
              </p>
            </section>
          )}

          {assignmentLoading ? (
            <div className="text-sm text-gray-500">Loading assignees...</div>
          ) : (
            <>
              <div className={`rounded border p-3 text-sm ${assignmentState.isDirectAssignmentLocked ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                {assignmentState.isDirectAssignmentLocked
                  ? 'Assigned: the people listed below are confirmed on this shift. Their spots are taken, and everyone else is blocked until you unassign the final person.'
                  : assignmentState.assignedUsers.length > 0
                    ? 'Open with confirmed assignees: their spots are secured, and eligible members can claim the remaining capacity.'
                    : selectedShiftForAssignment?.assignmentMode === 'SELECTED_USERS'
                      ? 'Exclusive: adding direct assignees confirms their spots and keeps the shift limited to those people.'
                      : 'Open: adding a direct assignee confirms their spot; the remaining capacity stays available under the current invitation strategy.'}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Direct Assignees ({assignmentState.assignedUsers.length})</div>
                <p className="text-xs text-gray-500 mb-2">Direct assignees do not need to confirm. They can drop the shift later from My Shifts; admins and leads can also unassign them here.</p>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                  {assignmentState.assignedUsers.length === 0 ? (
                    <div className="text-sm text-gray-500">No assignees yet.</div>
                  ) : (
                    assignmentState.assignedUsers.map((user) => (
                      <div key={user.userId} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                        <span>
                          {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Former roster member'}
                          {user.isActiveRosterMember === false && (
                            <span className="ml-1 text-xs text-gray-500">(not on active roster)</span>
                          )}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={assignmentSaving}
                          onClick={() => handleRemoveAssignee(user.userId)}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          Unassign
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-700">Select Members</div>
                  {assignmentState.unassignedUsers.length > 0 && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                      {pendingAddUserIds.length} selected
                    </span>
                  )}
                </div>
                <p className="mb-3 text-xs text-gray-500">Click anywhere on a member card to select them. Use "Invite to sign up" when members should choose their own shifts.</p>

                {assignmentState.unassignedUsers.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    No unassigned roster users available.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search
                        size={16}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <Input
                        value={assigneeSearch}
                        onChange={(event) => setAssigneeSearch(event.target.value)}
                        placeholder="Search by name, playa name, or email"
                        aria-label="Search roster members"
                        className="pl-9"
                      />
                    </div>

                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {filteredUnassignedUsers.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                          No members match “{assigneeSearch.trim()}”.
                        </div>
                      ) : (
                        filteredUnassignedUsers.map((assignee) => {
                          const isSelected = pendingAddUserIds.includes(assignee.userId);
                          return (
                            <button
                              key={assignee.userId}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => togglePendingAssignee(assignee.userId)}
                              className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${
                                isSelected
                                  ? 'border-orange-400 bg-orange-50 shadow-sm'
                                  : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                  isSelected
                                    ? 'border-orange-600 bg-orange-600 text-white'
                                    : 'border-gray-300 bg-white group-hover:border-orange-400'
                                }`}
                              >
                                {isSelected && <CheckCircle size={14} strokeWidth={3} />}
                              </span>
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                isSelected ? 'bg-orange-200 text-orange-800' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {getAssigneeInitials(assignee)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-gray-900">
                                    {getAssigneeDisplayName(assignee)}
                                  </span>
                                  {assignee.isLead && (
                                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-800">
                                      Lead
                                    </span>
                                  )}
                                </span>
                                {(assignee.playaName || assignee.email) && (
                                  <span className="block truncate text-xs text-gray-500">
                                    {assignee.playaName ? `Playa: ${assignee.playaName}` : assignee.email}
                                    {assignee.playaName && assignee.email ? ` · ${assignee.email}` : ''}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedPendingUsers.length > 0 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-orange-900">Ready to assign</div>
                      <div className="text-xs text-orange-800">Review the names before locking this shift.</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-orange-800 shadow-sm">
                      {selectedPendingUsers.length} {selectedPendingUsers.length === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedPendingUsers.map((assignee) => (
                      <button
                        key={assignee.userId}
                        type="button"
                        onClick={() => togglePendingAssignee(assignee.userId)}
                        aria-label={`Remove ${getAssigneeDisplayName(assignee)} from selection`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-2.5 py-1 text-xs font-medium text-orange-900 shadow-sm hover:border-orange-300 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        {getAssigneeDisplayName(assignee)}
                        <X size={13} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssignmentModal(false);
                    setSelectedShiftForAssignment(null);
                    setPendingAddUserIds([]);
                    setAssigneeSearch('');
                  }}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  disabled={assignmentSaving || pendingAddUserIds.length === 0}
                  onClick={handleAddAssignees}
                >
                  {assignmentSaving
                    ? 'Saving...'
                    : pendingAddUserIds.length === 0
                      ? 'Select members to assign'
                      : `Assign ${pendingAddUserIds.length} ${pendingAddUserIds.length === 1 ? 'person' : 'people'}`}
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
