import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Card, Modal, Input } from '../../components/ui';
import { Calendar, Users, Plus, Eye, Edit, Trash2, Save, X } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Event } from '../../types';
import { formatShiftDate, formatShiftTime, formatDate } from '../../utils/dateFormatters';

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
  const [reportType, setReportType] = useState<'per-person' | 'per-day'>('per-person');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [personSortKey, setPersonSortKey] = useState<'personName' | 'date' | 'eventName' | 'shiftTime' | 'description'>('date');
  const [personSortDir, setPersonSortDir] = useState<'asc' | 'desc'>('asc');
  const [eventShiftSortKey, setEventShiftSortKey] = useState<'title' | 'date' | 'filled' | 'capacity' | 'remaining'>('date');
  const [eventShiftSortDir, setEventShiftSortDir] = useState<'asc' | 'desc'>('asc');
  const [bulkInviteLoading, setBulkInviteLoading] = useState(false);

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
    }>
  });
  const [rosterMembers, setRosterMembers] = useState<Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    isLead: boolean;
  }>>([]);

  // Check if user has admin/lead access (including Camp Leads)
  const isCampContext = user?.accountType === 'camp' 
    || (user?.accountType === 'admin' && user?.campId)
    || (user?.isCampLead === true && user?.campLeadCampId);
  
  const isAdminOrLead = user?.accountType === 'admin' 
    || user?.accountType === 'camp'
    || (user?.isCampLead === true);
  
  const canAccessShifts = isCampContext && isAdminOrLead;

  const togglePersonSort = (key: typeof personSortKey) => {
    if (key === personSortKey) {
      setPersonSortDir(personSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setPersonSortKey(key);
      setPersonSortDir('asc');
    }
  };

  const toggleEventShiftSort = (key: typeof eventShiftSortKey) => {
    if (key === eventShiftSortKey) {
      setEventShiftSortDir(eventShiftSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setEventShiftSortKey(key);
      setEventShiftSortDir('asc');
    }
  };

  const getShiftStats = (shift: any) => {
    const current = shift.memberIds?.length || 0;
    const max = shift.maxSignUps || 0;
    const remaining = Math.max(max - current, 0);
    const filledPercent = max > 0 ? Math.round((current / max) * 100) : 0;
    return { current, max, remaining, filledPercent };
  };

  const getSortIndicator = (activeKey: string, key: string, direction: 'asc' | 'desc') => {
    if (activeKey !== key) return '';
    return direction === 'asc' ? '▲' : '▼';
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
        setRosterMembers([]);
        return;
      }

      const response = await api.getCampMembers(campId.toString());
      const normalized = (response.members || []).map((member: any) => {
        const resolvedUser = typeof member.user === 'object' ? member.user : member;
        return {
          _id: resolvedUser._id || member._id,
          firstName: resolvedUser.firstName || '',
          lastName: resolvedUser.lastName || '',
          email: resolvedUser.email || '',
          isLead: member?.isCampLead === true || ['camp-lead', 'project-lead', 'lead', 'admin'].includes((member?.role || '').toLowerCase())
        };
      });
      setRosterMembers(normalized);
    } catch (error) {
      console.error('Error loading roster members:', error);
      setRosterMembers([]);
    }
  }, [user?.accountType, user?.campId, user?.isCampLead, user?.campLeadCampId]);

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

  const hasRoster = rosterMembers.length > 0;
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

      const eventData = {
        eventName: eventForm.eventName,
        description: eventForm.description,
        eventDate: eventForm.eventDate,
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        ...(campId ? { campId } : {}),
        shifts: eventForm.shifts.map(shift => ({
          ...(shift._id ? { _id: shift._id } : {}),
          title: shift.title,
          description: shift.description,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          maxSignUps: shift.maxSignUps,
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
        selectedUserIds: allRosterIds
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

    // Populate form with event data + assignment baseline from existing assignees
    setEventForm({
      eventName: event.eventName,
      description: event.description || '',
      eventDate: event.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : '',
      startTime: event.startTime ? new Date(event.startTime).toTimeString().slice(0, 5) : '',
      endTime: event.endTime ? new Date(event.endTime).toTimeString().slice(0, 5) : '',
      shifts: event.shifts.map((shift, index) => ({
        _id: shift._id?.toString(),
        title: shift.title,
        description: shift.description || '',
        date: new Date(shift.date).toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        startTime: new Date(shift.startTime).toTimeString().slice(0, 5), // Convert to HH:MM format
        endTime: new Date(shift.endTime).toTimeString().slice(0, 5), // Convert to HH:MM format
        maxSignUps: shift.maxSignUps,
        currentSignups: shift.memberIds?.length || 0,
        assignmentMode: 'SELECTED_USERS',
        selectedUserIds: (assignmentResponses[index]?.assignedUsers || [])
          .map((assignedUser: any) => assignedUser?.userId?.toString())
          .filter(Boolean)
      }))
    });
    
    setShowCreateModal(true);
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
    const title = reportType === 'per-person' ? 'Volunteer Shift Report - Per Person' : 'Volunteer Shift Report - Per Day';

    const personRows: Array<{ personName: string; date: string; eventName: string; shiftTime: string; description: string }> = [];
    events.forEach(event => {
      event.shifts.forEach(shift => {
        if (shift.memberIds && shift.memberIds.length > 0) {
          shift.memberIds.forEach(memberId => {
            const member = rosterMembers.find(m => m._id === memberId);
            const memberName = member
              ? `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown Member'
              : 'Unknown Member';
            personRows.push({
              personName: memberName,
              date: formatShiftDate(shift.date),
              eventName: event.eventName,
              shiftTime: `${formatShiftTime(shift.startTime)} - ${formatShiftTime(shift.endTime)}`,
              description: shift.description || shift.title
            });
          });
        }
      });
    });

    const dayRowsByDate: Record<string, Array<{ eventName: string; shiftTime: string; description: string; signedUpMembers: string[] }>> = {};
    events.forEach(event => {
      event.shifts.forEach(shift => {
        const dateKey = formatShiftDate(shift.date);
        if (selectedDate) {
          const selectedKey = formatShiftDate(new Date(selectedDate));
          if (dateKey !== selectedKey) return;
        }
        if (!dayRowsByDate[dateKey]) dayRowsByDate[dateKey] = [];
        const signedUpMembers = (shift.memberIds || []).map((memberId: any) => {
          const member = rosterMembers.find(m => m._id === memberId);
          if (!member) return 'Unknown Member';
          const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown Member';
          return member.email ? `${name} (${member.email})` : name;
        });
        dayRowsByDate[dateKey].push({
          eventName: event.eventName,
          shiftTime: `${formatShiftTime(shift.startTime)} - ${formatShiftTime(shift.endTime)}`,
          description: shift.description || shift.title,
          signedUpMembers
        });
      });
    });

    const personTable = `
      <table>
        <thead><tr><th>Person Name</th><th>Date</th><th>Event Name</th><th>Shift Time</th><th>Description</th></tr></thead>
        <tbody>
          ${personRows.length === 0 ? '<tr><td colspan="5">No sign-ups yet</td></tr>' : personRows.map(r => `<tr><td>${r.personName}</td><td>${r.date}</td><td>${r.eventName}</td><td>${r.shiftTime}</td><td>${r.description}</td></tr>`).join('')}
        </tbody>
      </table>
    `;

    const daySections = Object.keys(dayRowsByDate).sort().map(date => `
      <h3>${date}</h3>
      <table>
        <thead><tr><th>Event Name</th><th>Shift Time</th><th>Description</th><th>Signed Up Members</th></tr></thead>
        <tbody>
          ${dayRowsByDate[date].map(row => `<tr><td>${row.eventName}</td><td>${row.shiftTime}</td><td>${row.description}</td><td>${row.signedUpMembers.join('<br/>') || 'No sign-ups'}</td></tr>`).join('')}
        </tbody>
      </table>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 8px 0; }
            .meta { color: #555; margin-bottom: 18px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
            h3 { margin: 18px 0 8px 0; }
            @media print { body { padding: 8px; } }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">Generated: ${generatedAt}</div>
          ${reportType === 'per-person' ? personTable : daySections || '<p>No shifts scheduled for selected day.</p>'}
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

      const response = await api.inviteEntireRosterToAllShifts(campId);
      alert(response.message);
      setShowBulkInviteModal(false);
    } catch (error: any) {
      console.error('Bulk invite error:', error);
      alert(error?.response?.data?.message || 'Failed to send roster invites.');
    } finally {
      setBulkInviteLoading(false);
    }
  };


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
            <Button
              variant="primary"
              onClick={() => setShowBulkInviteModal(true)}
              disabled={bulkInviteLoading || !hasAvailableShifts}
              className="flex items-center gap-2"
            >
              Invite Entire Roster to All Shifts
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </Button>
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
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-lato-bold text-custom-text mb-2">
                  Volunteer Events & Shifts
                </h2>
                <p className="text-gray-600">
                  Manage your camp's volunteer events and shifts. Create new events or edit existing ones.
                </p>
              </div>
              <div className="flex gap-3">
                {hasRoster && (
                  <Button
                    variant="primary"
                    onClick={() => setShowBulkInviteModal(true)}
                    disabled={bulkInviteLoading || !hasAvailableShifts}
                    className="flex items-center gap-2"
                  >
                    Invite Entire Roster to All Shifts
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Event
                </Button>
              </div>
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
                View participation and assignment data for all volunteer shifts.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6 no-print">
              <div className="flex items-center gap-2">
                <Button
                  variant={reportType === 'per-person' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setReportType('per-person')}
                >
                  Per-Person
                </Button>
                <Button
                  variant={reportType === 'per-day' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setReportType('per-day')}
                >
                  Per-Day
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {reportType === 'per-day' && (
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-40"
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintReportView}
                >
                  Printable View
                </Button>
              </div>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={64} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Events to Report</h3>
                <p className="text-gray-600">Create some volunteer events first to see reporting data.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Per-Event View */}
                <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Per-Event View
                  </h3>
                  <div className="text-sm text-gray-500 mb-3">
                    Click a column header to sort.
                  </div>
                  <div className="space-y-6">
                    {events.map(event => {
                      const sortedShifts = [...event.shifts].sort((a, b) => {
                        const statsA = getShiftStats(a);
                        const statsB = getShiftStats(b);
                        const direction = eventShiftSortDir === 'asc' ? 1 : -1;
                        if (eventShiftSortKey === 'title') {
                          return a.title.localeCompare(b.title) * direction;
                        }
                        if (eventShiftSortKey === 'capacity') {
                          return (statsA.max - statsB.max) * direction;
                        }
                        if (eventShiftSortKey === 'remaining') {
                          return (statsA.remaining - statsB.remaining) * direction;
                        }
                        if (eventShiftSortKey === 'filled') {
                          return (statsA.filledPercent - statsB.filledPercent) * direction;
                        }
                        const aTime = new Date(a.startTime).getTime();
                        const bTime = new Date(b.startTime).getTime();
                        return (aTime - bTime) * direction;
                      });

                      return (
                        <div key={event._id} className="print-page-break">
                          <div className="mb-3">
                            <h4 className="text-base font-medium text-gray-900">{event.eventName}</h4>
                            {event.description && (
                              <p className="text-sm text-gray-600">{event.description}</p>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300">
                              <thead>
                                <tr className="bg-gray-50">
                                  <th
                                    className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                                    onClick={() => toggleEventShiftSort('title')}
                                  >
                                    Shift {getSortIndicator(eventShiftSortKey, 'title', eventShiftSortDir)}
                                  </th>
                                  <th
                                    className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                                    onClick={() => toggleEventShiftSort('date')}
                                  >
                                    Date {getSortIndicator(eventShiftSortKey, 'date', eventShiftSortDir)}
                                  </th>
                                  <th className="border border-gray-300 px-4 py-2 text-left">Time</th>
                                  <th
                                    className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                                    onClick={() => toggleEventShiftSort('filled')}
                                  >
                                    % Filled {getSortIndicator(eventShiftSortKey, 'filled', eventShiftSortDir)}
                                  </th>
                                  <th
                                    className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                                    onClick={() => toggleEventShiftSort('capacity')}
                                  >
                                    Capacity {getSortIndicator(eventShiftSortKey, 'capacity', eventShiftSortDir)}
                                  </th>
                                  <th
                                    className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                                    onClick={() => toggleEventShiftSort('remaining')}
                                  >
                                    Remaining {getSortIndicator(eventShiftSortKey, 'remaining', eventShiftSortDir)}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedShifts.map(shift => {
                                  const stats = getShiftStats(shift);
                                  return (
                                    <tr key={shift._id} className="hover:bg-gray-50">
                                      <td className="border border-gray-300 px-4 py-2">{shift.title}</td>
                                      <td className="border border-gray-300 px-4 py-2">{formatShiftDate(shift.date)}</td>
                                      <td className="border border-gray-300 px-4 py-2">
                                        {formatShiftTime(shift.startTime)} – {formatShiftTime(shift.endTime)}
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2">{stats.filledPercent}%</td>
                                      <td className="border border-gray-300 px-4 py-2">{stats.current}/{stats.max}</td>
                                      <td className="border border-gray-300 px-4 py-2">{stats.remaining}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Per-Person View */}
                {reportType === 'per-person' && (
                  <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Per-Person View
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th
                            className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                            onClick={() => togglePersonSort('personName')}
                          >
                            Person Name {getSortIndicator(personSortKey, 'personName', personSortDir)}
                          </th>
                          <th
                            className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                            onClick={() => togglePersonSort('date')}
                          >
                            Date {getSortIndicator(personSortKey, 'date', personSortDir)}
                          </th>
                          <th
                            className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                            onClick={() => togglePersonSort('eventName')}
                          >
                            Event Name {getSortIndicator(personSortKey, 'eventName', personSortDir)}
                          </th>
                          <th
                            className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                            onClick={() => togglePersonSort('shiftTime')}
                          >
                            Shift Time {getSortIndicator(personSortKey, 'shiftTime', personSortDir)}
                          </th>
                          <th
                            className="border border-gray-300 px-4 py-2 text-left cursor-pointer"
                            onClick={() => togglePersonSort('description')}
                          >
                            Description {getSortIndicator(personSortKey, 'description', personSortDir)}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const signUps: Array<{
                            personName: string;
                            date: string;
                            eventName: string;
                            shiftTime: string;
                            description: string;
                          }> = [];

                          events.forEach(event => {
                            event.shifts.forEach(shift => {
                              if (shift.memberIds && shift.memberIds.length > 0) {
                                shift.memberIds.forEach(memberId => {
                                  // Find member name from roster
                                  const member = rosterMembers.find(m => m._id === memberId);
                                  const memberName = member ? 
                                    `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown Member' : 
                                    'Unknown Member';

                                  signUps.push({
                                    personName: memberName,
                                    date: formatShiftDate(shift.date),
                                    eventName: event.eventName,
                                    shiftTime: `${formatShiftTime(shift.startTime)} – ${formatShiftTime(shift.endTime)}`,
                                    description: shift.description || shift.title
                                  });
                                });
                              }
                            });
                          });

                          if (signUps.length === 0) {
                            return (
                              <tr>
                                <td colSpan={5} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                                  No sign-ups yet
                                </td>
                              </tr>
                            );
                          }

                          const sorted = [...signUps].sort((a, b) => {
                            const direction = personSortDir === 'asc' ? 1 : -1;
                            if (personSortKey === 'date') {
                              return a.date.localeCompare(b.date) * direction;
                            }
                            return (a[personSortKey] || '').toString().localeCompare((b[personSortKey] || '').toString()) * direction;
                          });

                          return sorted.map((signUp, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2">{signUp.personName}</td>
                              <td className="border border-gray-300 px-4 py-2">{signUp.date}</td>
                              <td className="border border-gray-300 px-4 py-2">{signUp.eventName}</td>
                              <td className="border border-gray-300 px-4 py-2">{signUp.shiftTime}</td>
                              <td className="border border-gray-300 px-4 py-2">{signUp.description}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}

                {/* Per-Day View */}
                {reportType === 'per-day' && (
                <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Per-Day View
                  </h3>
                  <div className="space-y-4">
                    {(() => {
                      // Group shifts by date
                      const shiftsByDate: { [key: string]: Array<{
                        event: any;
                        shift: any;
                        signedUpMembers: string[];
                      }> } = {};

                      events.forEach(event => {
                        event.shifts.forEach(shift => {
                          const dateKey = formatShiftDate(shift.date);
                          if (selectedDate) {
                            const selectedKey = formatShiftDate(new Date(selectedDate));
                            if (dateKey !== selectedKey) {
                              return;
                            }
                          }
                          if (!shiftsByDate[dateKey]) {
                            shiftsByDate[dateKey] = [];
                          }

                          const signedUpMembers = shift.memberIds?.map((memberId: any) => {
                            const member = rosterMembers.find(m => m._id === memberId);
                            if (!member) return 'Unknown Member';
                            const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown Member';
                            return member.email ? `${name} (${member.email})` : name;
                          }) || [];

                          shiftsByDate[dateKey].push({
                            event,
                            shift,
                            signedUpMembers
                          });
                        });
                      });

                      const sortedDates = Object.keys(shiftsByDate).sort((a, b) => {
                        const shiftA = shiftsByDate[a]?.[0]?.shift?.date;
                        const shiftB = shiftsByDate[b]?.[0]?.shift?.date;
                        return new Date(shiftA).getTime() - new Date(shiftB).getTime();
                      });

                      if (sortedDates.length === 0) {
                        return (
                          <div className="text-center py-12 text-gray-500">
                            <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No shifts scheduled yet</p>
                          </div>
                        );
                      }

                      return sortedDates.map(date => (
                        <div key={date} className="border border-gray-200 rounded-lg">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <h4 className="font-medium text-gray-900">{date}</h4>
                          </div>
                          <div className="p-4">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-2">Event Name</th>
                                    <th className="text-left py-2">Shift Time</th>
                                    <th className="text-left py-2">Description</th>
                                    <th className="text-left py-2">Signed Up Members</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {shiftsByDate[date].map((item, index) => (
                                    <tr key={index} className="border-b border-gray-100 last:border-b-0">
                                      <td className="py-2">{item.event.eventName}</td>
                                      <td className="py-2">
                                        {formatShiftTime(item.shift.startTime)} – {formatShiftTime(item.shift.endTime)}
                                      </td>
                                      <td className="py-2">{item.shift.description || item.shift.title}</td>
                                      <td className="py-2">
                                        {item.signedUpMembers.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {item.signedUpMembers.map((memberName, idx) => (
                                              <span key={idx} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                                {memberName}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-gray-500 text-sm">No sign-ups</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Name *
            </label>
            <Input
              value={eventForm.eventName}
              onChange={(e) => setEventForm(prev => ({ ...prev, eventName: e.target.value }))}
              placeholder="Enter event name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Date *
              </label>
              <Input
                type="date"
                value={eventForm.eventDate}
                onChange={(e) => setEventForm(prev => ({ ...prev, eventDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Start Time *
              </label>
              <Input
                type="time"
                value={eventForm.startTime}
                onChange={(e) => setEventForm(prev => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event End Time *
              </label>
              <Input
                type="time"
                value={eventForm.endTime}
                onChange={(e) => setEventForm(prev => ({ ...prev, endTime: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Shifts</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddShift}
                className="flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Shift
              </Button>
            </div>

            {isEditMode && eventForm.shifts.length > 0 && eventForm.shifts.every((shift) => shift.currentSignups >= shift.maxSignUps) && (
              <div className="mb-3 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                This event is fully staffed. You can still edit all fields and invites.
              </div>
            )}

            {eventForm.shifts.map((shift, index) => {
              const isFullyStaffed = isEditMode && shift.currentSignups >= shift.maxSignUps;
              const staffedFieldClass = isFullyStaffed ? 'bg-gray-100' : '';
              return (
              <div key={index} className={`border rounded-lg p-4 mb-4 ${isFullyStaffed ? 'border-green-300 bg-green-50/40' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Shift {index + 1}</h4>
                    {isFullyStaffed && (
                      <span className="text-xs font-medium text-green-800 bg-green-100 border border-green-200 rounded px-2 py-0.5">
                        Fully staffed
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveShift(index)}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <Input
                      value={shift.title}
                      onChange={(e) => handleShiftChange(index, 'title', e.target.value)}
                      placeholder="Shift title"
                      className={staffedFieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Sign-ups *
                    </label>
                    <Input
                      type="number"
                      value={shift.maxSignUps}
                      onChange={(e) => handleShiftChange(index, 'maxSignUps', parseInt(e.target.value) || 1)}
                      min="1"
                      className={staffedFieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <Input
                      type="date"
                      value={shift.date}
                      onChange={(e) => handleShiftChange(index, 'date', e.target.value)}
                      className={staffedFieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time *
                    </label>
                    <Input
                      type="time"
                      value={shift.startTime}
                      onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)}
                      className={staffedFieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time *
                    </label>
                    <Input
                      type="time"
                      value={shift.endTime}
                      onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)}
                      className={staffedFieldClass}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={shift.description}
                    onChange={(e) => handleShiftChange(index, 'description', e.target.value)}
                    rows={2}
                    className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent ${staffedFieldClass}`}
                    placeholder="Shift description"
                  />
                </div>

                <div className="border-t pt-4 mt-4">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Invite To</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <label className={`border rounded-lg p-2 cursor-pointer ${shift.assignmentMode === 'ALL_ROSTER' ? 'border-custom-primary bg-orange-50' : 'border-gray-200'}`}>
                      <input
                        type="radio"
                        className="mr-2"
                        checked={shift.assignmentMode === 'ALL_ROSTER'}
                        onChange={() => handleAssignmentModeChange(index, 'ALL_ROSTER')}
                      />
                      Entire Roster
                    </label>
                    <label className={`border rounded-lg p-2 cursor-pointer ${shift.assignmentMode === 'LEADS_ONLY' ? 'border-custom-primary bg-orange-50' : 'border-gray-200'}`}>
                      <input
                        type="radio"
                        className="mr-2"
                        checked={shift.assignmentMode === 'LEADS_ONLY'}
                        onChange={() => handleAssignmentModeChange(index, 'LEADS_ONLY')}
                      />
                      Leads Only
                    </label>
                    <label className={`border rounded-lg p-2 cursor-pointer ${shift.assignmentMode === 'SELECTED_USERS' ? 'border-custom-primary bg-orange-50' : 'border-gray-200'}`}>
                      <input
                        type="radio"
                        className="mr-2"
                        checked={shift.assignmentMode === 'SELECTED_USERS'}
                        onChange={() => handleAssignmentModeChange(index, 'SELECTED_USERS')}
                      />
                      Selected People
                    </label>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    Selected: {shift.selectedUserIds.length} / {rosterMembers.length}
                  </div>
                  <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {rosterMembers.map((member) => {
                      const label = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
                      return (
                        <label key={member._id} className="flex items-center justify-between">
                          <span className="text-sm">
                            {label} {member.isLead ? <span className="text-xs text-orange-700">(Lead)</span> : null}
                          </span>
                          <input
                            type="checkbox"
                            checked={shift.selectedUserIds.includes(member._id)}
                            onChange={() => toggleSelectedUser(index, member._id)}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
            })}

            {eventForm.shifts.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No shifts added yet. Click "Add Shift" to create your first shift.
              </p>
            )}
          </div>

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
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateEvent}
              disabled={
                !eventForm.eventName || 
                !eventForm.eventDate ||
                !eventForm.startTime ||
                !eventForm.endTime ||
                eventForm.shifts.length === 0
              }
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {isEditMode ? 'Update Event' : 'Create Event'}
            </Button>
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
        title="Invite Entire Roster to All Shifts"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to invite the entire roster to sign up for all available shifts?
          </p>
          <p className="text-xs text-gray-500">
            Each roster member will receive one generic email and one in-app notification with a link to the shifts page.
          </p>
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
              {bulkInviteLoading ? 'Sending...' : 'Send Invites'}
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
                      ? ` • ${formatShiftTime(selectedEvent.startTime)} - ${formatShiftTime(selectedEvent.endTime)}`
                      : ''}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  Created: {new Date(selectedEvent.createdAt).toLocaleDateString()}
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
                          >
                            Invite to Shift
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{shift.description}</p>
                      <div className="text-sm text-gray-500">
                        <div>{formatDate(shift.date)}</div>
                        <div>{formatShiftTime(shift.startTime)} - {formatShiftTime(shift.endTime)}</div>
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
        title={selectedShiftForAssignment ? `Invite to Shift: ${selectedShiftForAssignment.title}` : 'Invite to Shift'}
        size="lg"
      >
        <div className="space-y-4">
          {assignmentLoading ? (
            <div className="text-sm text-gray-500">Loading assignees...</div>
          ) : (
            <>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Current Assignees ({assignmentState.assignedUsers.length})</div>
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
