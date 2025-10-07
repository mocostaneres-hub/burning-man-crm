import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Card, Modal } from '../../components/ui';
import { User, Loader2, RefreshCw, Eye, Edit, Trash2, Save, X, Users, Plus, Mail, MapPin, Linkedin, Instagram, Facebook, Calendar, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Member } from '../../types';
import { formatDate } from '../../utils/dateFormatters';
import MetricsPanel from '../../components/roster/MetricsPanel';
import RosterFilters, { FilterType } from '../../components/roster/RosterFilters';
import { InviteMembersModal } from '../../components/invites';
import AddMemberModal from '../../components/roster/AddMemberModal';
import { useSkills } from '../../hooks/useSkills';

// Extended type for roster members that includes nested member data
interface RosterMember extends Member {
  member?: Member; // Nested member structure from API
}

const MemberRoster: React.FC = () => {
  const { user } = useAuth();
  const { skills: systemSkills } = useSkills();
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campId, setCampId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<RosterMember | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<any>>>({});
  const [hasActiveRoster, setHasActiveRoster] = useState(true); // TODO: Get from API
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [duesConfirmModal, setDuesConfirmModal] = useState<{
    isOpen: boolean;
    member: any;
    currentStatus: boolean;
  }>({ isOpen: false, member: null, currentStatus: false });
  const [duesLoading, setDuesLoading] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<RosterMember | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<RosterMember | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  // Roster rename state
  const [rosterName, setRosterName] = useState<string>('Member Roster');
  const [rosterId, setRosterId] = useState<string | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newRosterName, setNewRosterName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);

  // Check if current user can access roster features (STRICT: only admins and camp leads, NO standard members)
  const isCampContext = user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campName);
  const isAdminOrLead = user?.accountType === 'admin' || user?.accountType === 'camp';
  const canAccessRoster = isCampContext && isAdminOrLead; // STRICT: Only admins/leads can access
  const canEdit = canAccessRoster;
  const canViewMetrics = canAccessRoster;
  const canUseFilters = canAccessRoster;

  // Start editing a member
  const handleStartEdit = (memberId: string) => {
    setEditingMemberId(memberId);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMemberId(null);
    // Clear any unsaved local edits for this member
    setLocalEdits(prev => {
      const newEdits = { ...prev };
      if (editingMemberId) {
        delete newEdits[editingMemberId];
      }
      return newEdits;
    });
  };

  // Update a field in localEdits
  const handleFieldChange = (memberId: string, field: string, value: any) => {
    setLocalEdits(prev => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] || {}),
        [field]: value
      }
    }));
  };

  // Save local edits
  const handleSaveEdit = async (memberId: string, editData: Partial<any>) => {
    try {
      if (!rosterId) {
        alert('Roster ID not found');
        return;
      }

      // Find the member
      const member = members.find(m => m._id.toString() === memberId);
      if (!member) {
        alert('Member not found');
        return;
      }

      // Get the current edits for this member
      const currentEdits = localEdits[memberId] || {};
      const allEdits = { ...currentEdits, ...editData };

      // Extract all editable fields for roster overrides
      const overridesData: any = {};
      if (allEdits.playaName !== undefined) overridesData.playaName = allEdits.playaName;
      if (allEdits.yearsBurned !== undefined) overridesData.yearsBurned = allEdits.yearsBurned;
      if (allEdits.skills !== undefined) overridesData.skills = allEdits.skills;
      if (allEdits.hasTicket !== undefined) overridesData.hasTicket = allEdits.hasTicket;
      if (allEdits.hasVehiclePass !== undefined) overridesData.hasVehiclePass = allEdits.hasVehiclePass;
      if (allEdits.interestedInEAP !== undefined) overridesData.interestedInEAP = allEdits.interestedInEAP;
      if (allEdits.interestedInStrike !== undefined) overridesData.interestedInStrike = allEdits.interestedInStrike;
      if (allEdits.arrivalDate !== undefined) overridesData.arrivalDate = allEdits.arrivalDate;
      if (allEdits.departureDate !== undefined) overridesData.departureDate = allEdits.departureDate;
      if (allEdits.city !== undefined) overridesData.city = allEdits.city;
      if (allEdits.state !== undefined) overridesData.state = allEdits.state;

      console.log('💾 [MemberRoster] Saving overrides:', overridesData);

      // Call API to update roster overrides (NOT the member's profile)
      await api.put(`/rosters/${rosterId}/members/${memberId}/overrides`, overridesData);

      // Clear local edits and editing state
      setLocalEdits(prev => {
        const newEdits = { ...prev };
        delete newEdits[memberId];
        return newEdits;
      });
    setEditingMemberId(null);

      // Refresh the members data to show the updated values
      await fetchMembers();
      
    } catch (error) {
      console.error('Error saving member edits:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  // Update edit field
  const handleEditFieldChange = (field: string, value: any) => {
    if (!editingMemberId) return;
    
    setLocalEdits(prev => ({
      ...prev,
      [editingMemberId]: {
        ...prev[editingMemberId],
        [field]: value
      }
    }));
  };

  // Helper components for inline editing
  const EditableArrivalDeparture = ({ user, memberId }: { user: any; memberId: string }) => {
    const currentEdits = localEdits[memberId] || {};
    const member = members.find(m => m._id.toString() === memberId);
    const overrides = member?.overrides || {};
    const arrivalDate = currentEdits?.arrivalDate || overrides?.arrivalDate || user?.arrivalDate || '';
    const departureDate = currentEdits?.departureDate || overrides?.departureDate || user?.departureDate || '';

    return (
      <div className="text-sm space-y-1">
        <div className="flex items-center space-x-2">
          <span className="text-green-600 font-medium w-12">Arrive:</span>
          <input
            type="date"
            value={arrivalDate ? new Date(arrivalDate).toISOString().split('T')[0] : ''}
            onChange={(e) => handleFieldChange(memberId, 'arrivalDate', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs w-28"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-yellow-600 font-medium w-12">Depart:</span>
          <input
            type="date"
            value={departureDate ? new Date(departureDate).toISOString().split('T')[0] : ''}
            onChange={(e) => handleFieldChange(memberId, 'departureDate', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs w-28"
          />
        </div>
      </div>
    );
  };

  const EditableEALD = ({ user, memberId }: { user: any; memberId: string }) => {
    const currentEdits = localEdits[memberId] || {};
    const member = members.find(m => m._id.toString() === memberId);
    const overrides = member?.overrides || {};
    const interestedInEAP = currentEdits?.interestedInEAP !== undefined ? currentEdits.interestedInEAP : (overrides?.interestedInEAP !== undefined ? overrides.interestedInEAP : user?.interestedInEAP);
    const interestedInStrike = currentEdits?.interestedInStrike !== undefined ? currentEdits.interestedInStrike : (overrides?.interestedInStrike !== undefined ? overrides.interestedInStrike : user?.interestedInStrike);

    return (
      <div className="text-sm space-y-1">
        <div className="flex items-center space-x-2">
          <span className="w-6">EA:</span>
          <select
            value={interestedInEAP ? 'yes' : 'no'}
            onChange={(e) => handleFieldChange(memberId, 'interestedInEAP', e.target.value === 'yes')}
            className="border border-gray-300 rounded px-2 py-1 text-xs"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-6">LD:</span>
          <select
            value={interestedInStrike ? 'yes' : 'no'}
            onChange={(e) => handleFieldChange(memberId, 'interestedInStrike', e.target.value === 'yes')}
            className="border border-gray-300 rounded px-2 py-1 text-xs"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
    );
  };

  const EditableTicketVP = ({ user, memberId }: { user: any; memberId: string }) => {
    const currentEdits = localEdits[memberId] || {};
    const member = members.find(m => m._id.toString() === memberId);
    const overrides = member?.overrides || {};
    const hasTicket = currentEdits?.hasTicket !== undefined ? currentEdits.hasTicket : (overrides?.hasTicket !== undefined ? overrides.hasTicket : user?.hasTicket);
    const hasVehiclePass = currentEdits?.hasVehiclePass !== undefined ? currentEdits.hasVehiclePass : (overrides?.hasVehiclePass !== undefined ? overrides.hasVehiclePass : user?.hasVehiclePass);

    return (
      <div className="text-sm space-y-1">
        <div className="flex items-center space-x-2">
          <span className="w-12">Ticket:</span>
          <select
            value={hasTicket ? 'yes' : 'no'}
            onChange={(e) => handleFieldChange(memberId, 'hasTicket', e.target.value === 'yes')}
            className="border border-gray-300 rounded px-2 py-1 text-xs"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-12">VP:</span>
          <select
            value={hasVehiclePass ? 'yes' : 'no'}
            onChange={(e) => handleFieldChange(memberId, 'hasVehiclePass', e.target.value === 'yes')}
            className="border border-gray-300 rounded px-2 py-1 text-xs"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
    );
  };

  const EditableLocation = ({ user, memberId }: { user: any; memberId: string }) => {
    const currentEdits = localEdits[memberId] || {};
    const member = members.find(m => m._id.toString() === memberId);
    const overrides = member?.overrides || {};
    const city = currentEdits?.city || overrides?.city || user?.city || user?.location?.city || '';
    const state = currentEdits?.state || overrides?.state || user?.location?.state || '';

    return (
      <div className="flex flex-col space-y-1">
        <input
          type="text"
          placeholder="City"
          value={city}
          onChange={(e) => handleFieldChange(memberId, 'city', e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs"
        />
        <input
          type="text"
          placeholder="State"
          value={state}
          onChange={(e) => handleFieldChange(memberId, 'state', e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs"
        />
      </div>
    );
  };

  const fetchCampData = async () => {
    try {
      const campData = await api.getMyCamp();
      setCampId(campData._id.toString());
    } catch (err) {
      console.error('Error fetching camp data:', err);
      setError('Failed to load camp data');
    }
  };

  const fetchMembers = useCallback(async () => {
    if (!campId) return;
    
    try {
      setLoading(true);
      
      // Get roster data which now includes populated user information
      const rosterResponse = await api.get('/rosters/active').catch(() => ({ members: [] }));
      
      console.log('🔍 [MemberRoster] Roster response:', rosterResponse);
      
      const roster = rosterResponse;
      
      // Extract roster name and ID
      if (roster._id) {
        setRosterId(roster._id.toString());
      }
      if (roster.name) {
        setRosterName(roster.name);
      }
      
      // The roster now contains members with populated user data
      // Transform roster member entries into the format expected by the component
      const enhancedMembers = (roster.members || []).map((memberEntry: any) => {
        console.log('🔍 [MemberRoster] Processing member entry:', memberEntry);
        console.log('🔍 [MemberRoster] Member entry overrides:', memberEntry.overrides);
        console.log('🔍 [MemberRoster] Member entry keys:', Object.keys(memberEntry));
        
            // Map duesStatus string to duesPaid boolean for frontend compatibility
            const duesPaid = memberEntry.duesStatus === 'Paid' || memberEntry.duesPaid === true;
        
        return {
          _id: memberEntry.member?._id || memberEntry.member, // The member ID (handle both object and string)
          member: memberEntry.member, // The full member object with nested user data
          user: memberEntry.member?.user,  // The populated user data from the backend
              duesPaid: duesPaid,
          duesStatus: memberEntry.duesStatus,
              addedAt: memberEntry.addedAt,
              addedBy: memberEntry.addedBy,
          rosterStatus: memberEntry.status || 'active',
          overrides: memberEntry.overrides || {} // Roster-specific overrides
        };
      });
      
      console.log('✅ [MemberRoster] Enhanced members:', enhancedMembers);
      
      setMembers(enhancedMembers);
      
      // Clear any local edits when data is refreshed
      setLocalEdits({});
      setEditingMemberId(null);
    } catch (err) {
      console.error('Error fetching members and roster:', err);
      setError('Failed to load members and roster data');
    } finally {
      setLoading(false);
    }
  }, [campId]);

  useEffect(() => {
    if (user?.accountType === 'camp' || user?.campId) {
      fetchCampData();
    }
  }, [user?.accountType, user?.campId]);

  useEffect(() => {
    if (campId) {
      fetchMembers();
    }
  }, [campId, fetchMembers]);

  // Extract all unique skills from members
  const availableSkills = useMemo(() => {
    const allSkills = new Set<string>();
    members.forEach(member => {
      const user = typeof member.user === 'object' ? member.user : null;
      if (user?.skills) {
        user.skills.forEach(skill => allSkills.add(skill));
      }
    });
    return Array.from(allSkills).sort();
  }, [members]);


  const handleFilterChange = (filters: FilterType[]) => {
    setActiveFilters(filters);
  };


  const handleViewMember = (member: Member) => {
    setSelectedMember(member);
    setViewDialogOpen(true);
  };

  const handleCloseViewDialog = () => {
    setSelectedMember(null);
    setViewDialogOpen(false);
  };

  const handleOpenEditDialog = (member: Member) => {
    setMemberToEdit(member);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setMemberToEdit(null);
  };

  // Handle member deletion
  const handleDeleteMember = (member: Member) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete || !campId || !canEdit) return;
    
    try {
      setDeleteLoading(true);
      await api.delete(`/camps/${campId}/roster/member/${memberToDelete._id}`);
      
      // Update local state to remove the member
      setMembers(prev => prev.filter(m => m._id !== memberToDelete._id));
      
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
      
      // Show success message
      alert('Member removed from roster and application reset successfully!');
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Failed to remove member from roster');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setMemberToDelete(null);
  };

  // Handle roster archiving
  const handleArchiveRoster = async () => {
    if (!campId || !canEdit) return;
    
    try {
      setArchiveLoading(true);
      await api.post(`/camps/${campId}/roster/archive`);
      setHasActiveRoster(false);
      // Show success message or refresh data
      alert('Roster archived successfully!');
    } catch (error) {
      console.error('Error archiving roster:', error);
      alert('Failed to archive roster');
    } finally {
      setArchiveLoading(false);
    }
  };

  // Handle creating new roster
  const handleCreateRoster = async () => {
    if (!campId || !canEdit) return;
    
    try {
      setCreateLoading(true);
      await api.post(`/camps/${campId}/roster/create`);
      setHasActiveRoster(true);
      // Refresh members data
      await fetchMembers();
      alert('New roster created successfully!');
    } catch (error) {
      console.error('Error creating roster:', error);
      alert('Failed to create new roster');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDuesClick = (member: any) => {
    if (!canEdit) return; // Only allow admins/leads to toggle dues
    
    const currentStatus = member.duesPaid || false;
    setDuesConfirmModal({
      isOpen: true,
      member,
      currentStatus
    });
  };

  const handleDuesConfirm = async () => {
    const { member, currentStatus } = duesConfirmModal;
    const newStatus = !currentStatus;
    
    try {
      if (!rosterId) {
        alert('Roster ID not found');
        setDuesConfirmModal({ isOpen: false, member: null, currentStatus: false });
        return;
      }

      setDuesLoading(member._id.toString());
      
      // Call API to update dues status (using correct endpoint and format)
      const duesStatus = newStatus ? 'Paid' : 'Unpaid';
      await api.put(`/rosters/${rosterId}/members/${member._id}/dues`, { duesStatus });
      
      // Update local state immediately for better UX
      setMembers(prevMembers => 
        prevMembers.map(m => 
          m._id === member._id 
            ? { ...m, duesPaid: newStatus }
            : m
        )
      );
      
      // Optionally refresh the data to ensure consistency with backend
      // fetchMembers();
      
      // Close modal
      setDuesConfirmModal({ isOpen: false, member: null, currentStatus: false });
      
    } catch (error) {
      console.error('❌ Error updating dues status:', error);
      alert('Failed to update dues status. Please try again.');
    } finally {
      setDuesLoading(null);
    }
  };

  const handleDuesCancel = () => {
    setDuesConfirmModal({ isOpen: false, member: null, currentStatus: false });
  };

  // Roster rename handlers
  const handleOpenRenameModal = () => {
    setNewRosterName(rosterName);
    setRenameModalOpen(true);
  };

  const handleCloseRenameModal = () => {
    setRenameModalOpen(false);
    setNewRosterName('');
  };

  const handleSaveRosterName = async () => {
    if (!rosterId || !newRosterName.trim()) {
      alert('Please enter a valid roster name');
      return;
    }

    try {
      setRenameLoading(true);
      await api.put(`/rosters/${rosterId}`, { name: newRosterName.trim() });
      setRosterName(newRosterName.trim());
      setRenameModalOpen(false);
      setNewRosterName('');
    } catch (error) {
      console.error('❌ Error renaming roster:', error);
      alert('Failed to rename roster. Please try again.');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleExportRoster = async () => {
    if (!rosterId) {
      alert('No roster available to export');
      return;
    }

    try {
      // Make a request to the export endpoint
      const response = await api.get(`/rosters/${rosterId}/export`, {
        responseType: 'blob' // Important for file downloads
      });

      // Create a blob URL and trigger download
      const blob = new Blob([response], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename based on roster name
      const filename = `${rosterName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_roster.csv`;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('❌ Error exporting roster:', error);
      alert('Failed to export roster. Please try again.');
    }
  };

  // Using shared date formatting utility

  const formatArrivalDepartureDate = (dateString: string | Date) => {
    if (!dateString || dateString === '' || dateString === 'undefined' || dateString === 'null') {
      return 'Not specified';
    }
    
    try {
      let date;
      
      if (dateString instanceof Date) {
        date = dateString;
      } else if (typeof dateString === 'string') {
        // Handle different date formats
        if (dateString.includes('T')) {
          // Already has time component
          date = new Date(dateString);
        } else {
          // Add timezone offset to handle date parsing correctly
          date = new Date(dateString + 'T12:00:00');
        }
      } else {
        return 'Not specified';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Not specified';
      }
      
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: '2-digit',
        day: '2-digit'
      }).replace(/(\w+),\s*(\d+)\/(\d+)/, '$1, $2/$3');
    } catch (error) {
      return 'Not specified';
    }
  };

  // Filtering logic for members based on active filters
  const filteredMembers = useMemo(() => {
    if (activeFilters.length === 0) {
      return members;
    }

    return members.filter(member => {
      const user = typeof member.user === 'object' ? member.user : null;
      
      // Check each active filter
      for (const filter of activeFilters) {
        switch (filter) {
          case 'dues-paid':
            if (!member.duesPaid) return false;
            break;
          case 'dues-unpaid':
            if (member.duesPaid) return false;
            break;
          case 'without-tickets':
            if (user?.hasTicket) return false;
            break;
          case 'with-tickets':
            if (!user?.hasTicket) return false;
            break;
          case 'without-vp':
            if (user?.hasVehiclePass) return false;
            break;
          case 'with-vp':
            if (!user?.hasVehiclePass) return false;
            break;
          case 'early-arrival':
            if (!user?.interestedInEAP) return false;
            break;
          case 'late-departure':
            if (!user?.interestedInStrike) return false;
            break;
          case 'virgin':
            if (user?.yearsBurned !== 0) return false;
            break;
          case 'veteran':
            if (!user?.yearsBurned || user.yearsBurned === 0) return false;
            break;
          default:
            // Check if it's a skill filter
            if (user?.skills && Array.isArray(user.skills)) {
              if (!user.skills.includes(filter)) return false;
            } else {
              return false;
            }
            break;
        }
      }
      return true;
    });
  }, [members, activeFilters]);

  // Early return for unauthorized access - STRICT enforcement
  if (!canAccessRoster) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-h1 font-lato-bold text-custom-text mb-4">
            Access Restricted
          </h1>
          <p className="text-body text-custom-text-secondary mb-4">
            Roster management is restricted to Camp Admins and Camp Leads only.
          </p>
          <p className="text-body text-custom-text-secondary">
            Standard camp members do not have access to roster features.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-custom-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-h1 font-lato-bold text-custom-text mb-2 flex items-center gap-2">
            {rosterName}
            {canEdit && rosterId && (
              <button
                onClick={handleOpenRenameModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Rename Roster"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
          </h1>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={fetchMembers}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {/* Archive and Create buttons - Only for admins/leads */}
          {canEdit && hasActiveRoster && (
            <Button
              variant="outline"
              onClick={handleArchiveRoster}
              disabled={archiveLoading}
              className="flex items-center gap-2 text-orange-600 border-orange-600 hover:bg-orange-50"
            >
              <Users className={`w-4 h-4 ${archiveLoading ? 'animate-pulse' : ''}`} />
              Archive Current Roster
            </Button>
          )}
          
          {canEdit && !hasActiveRoster && (
            <Button
              variant="primary"
              onClick={handleCreateRoster}
              disabled={createLoading}
              className="flex items-center gap-2"
            >
              <Plus className={`w-4 h-4 ${createLoading ? 'animate-pulse' : ''}`} />
              Create New Roster
            </Button>
          )}
          
          {canEdit && rosterId && (
            <Button
              variant="primary"
              className="flex items-center gap-2"
              onClick={() => setAddMemberModalOpen(true)}
            >
              <User className="w-4 h-4" />
              Add Member
            </Button>
          )}
          
            {/* Export Roster button - Available for all users with roster access */}
            {rosterId && (
              <Button
                variant="outline"
                onClick={handleExportRoster}
                className="flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50"
              >
                <span className="text-lg">↓</span>
                Export Roster
            </Button>
          )}
          
          {/* Invite Members functionality - Only for camp leads */}
          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => setInviteModalOpen(true)}
                className="flex items-center gap-2 text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                <Mail className="w-4 h-4" />
                Invite Members
              </Button>
              
              <Link to={`/camp/invites`}>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50"
                >
                  <Eye className="w-4 h-4" />
                  View Invites
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Metrics Panel - Only for admins/leads */}
      {canViewMetrics && <MetricsPanel members={filteredMembers} />}

      {/* Filters - Only for admins/leads */}
      {canUseFilters && (
        <RosterFilters 
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          availableSkills={availableSkills}
        />
      )}

      {/* Members List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Playa Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dues
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticket/VP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EA/LD
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Travel Plans
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  📍 City
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  🔥 Burns
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  🛠️ Skills
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.map((member, index) => {
                // Handle the nested structure: member.member.user
                const memberData = member.member || member;
                const user = typeof memberData.user === 'object' ? memberData.user : null;
                const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown User';
                const userPhoto = user?.profilePhoto;
                const isEditing = editingMemberId === member._id.toString();
                
                // Get location data - try user.city first, then user.location.city
                const userCity = user?.city || user?.location?.city;
                const userState = user?.location?.state;
                const location = userCity && userState 
                  ? `${userCity}, ${userState}` 
                  : userCity || 'Not specified';
                
                return (
                  <tr key={member._id} className={`${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    {/* Row Number */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                      {index + 1}
                    </td>
                    {/* Member */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {userPhoto ? (
                            <img
                              className="h-10 w-10 rounded-full"
                              src={userPhoto}
                              alt={userName}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {userName}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Playa Name */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={localEdits[member._id.toString()]?.playaName !== undefined 
                            ? localEdits[member._id.toString()].playaName 
                            : ((member as any).overrides?.playaName !== undefined ? (member as any).overrides.playaName : (user?.playaName || ''))}
                          onChange={(e) => handleFieldChange(member._id.toString(), 'playaName', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Playa name"
                        />
                      ) : (
                        ((member as any).overrides?.playaName !== undefined ? (member as any).overrides.playaName : user?.playaName) || (
                          <span className="text-gray-400 italic">Not set</span>
                        )
                      )}
                    </td>
                    {/* Dues */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <button
                        onClick={() => handleDuesClick(member)}
                        disabled={!canEdit || duesLoading === member._id.toString()}
                        className={`text-xl ${canEdit ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} ${
                          member.duesPaid ? 'text-green-600 font-bold' : 'text-gray-400'
                        }`}
                        title={canEdit ? (member.duesPaid ? 'Mark dues as unpaid' : 'Mark dues as paid') : 'View only'}
                      >
                        {duesLoading === member._id.toString() ? (
                          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                        ) : (
                          '$'
                        )}
                      </button>
                    </td>
                    {/* Ticket/VP */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditing ? (
                        <EditableTicketVP user={user} memberId={member._id.toString()} />
                      ) : (
                        (() => {
                          const hasTicket = (member as any).overrides?.hasTicket !== undefined ? (member as any).overrides.hasTicket : user?.hasTicket;
                          const hasVehiclePass = (member as any).overrides?.hasVehiclePass !== undefined ? (member as any).overrides.hasVehiclePass : user?.hasVehiclePass;
                          return (
                            <div className="text-sm">
                              <div>Ticket: <span className={
                                hasTicket === true ? 'text-green-600 font-medium' : 
                                hasTicket === false ? 'text-red-300' : 
                                'text-gray-500'
                              }>{
                                hasTicket === true ? 'Yes' : 
                                hasTicket === false ? 'No' : 
                                'Not informed'
                              }</span></div>
                              <div>VP: <span className={
                                hasVehiclePass === true ? 'text-green-600 font-medium' : 
                                hasVehiclePass === false ? 'text-red-300' : 
                                'text-gray-500'
                              }>{
                                hasVehiclePass === true ? 'Yes' : 
                                hasVehiclePass === false ? 'No' : 
                                'Not informed'
                              }</span></div>
                            </div>
                          );
                        })()
                      )}
                    </td>
                    {/* EA/LD */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditing ? (
                        <EditableEALD user={user} memberId={member._id.toString()} />
                      ) : (
                        (() => {
                          const interestedInEAP = (member as any).overrides?.interestedInEAP !== undefined ? (member as any).overrides.interestedInEAP : user?.interestedInEAP;
                          const interestedInStrike = (member as any).overrides?.interestedInStrike !== undefined ? (member as any).overrides.interestedInStrike : user?.interestedInStrike;
                          return (
                            <div className="text-sm">
                              <div>EA: <span className={interestedInEAP ? 'text-green-600 font-medium' : 'text-red-300'}>{interestedInEAP ? 'Yes' : 'No'}</span></div>
                              <div>LD: <span className={interestedInStrike ? 'text-green-600 font-medium' : 'text-red-300'}>{interestedInStrike ? 'Yes' : 'No'}</span></div>
                            </div>
                          );
                        })()
                      )}
                    </td>
                    {/* Arrival/Departure */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditing ? (
                        <EditableArrivalDeparture user={user} memberId={member._id.toString()} />
                      ) : (
                        <div className="text-sm">
                          <div className="text-green-600 font-medium">Arrive: {formatArrivalDepartureDate((member as any).overrides?.arrivalDate || user?.arrivalDate || '')}</div>
                          <div className="text-yellow-600 font-medium">Depart: {formatArrivalDepartureDate((member as any).overrides?.departureDate || user?.departureDate || '')}</div>
                        </div>
                      )}
                    </td>
                    {/* City */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditing ? (
                        <EditableLocation user={user} memberId={member._id.toString()} />
                      ) : (
                        (() => {
                          const city = (member as any).overrides?.city || user?.city || user?.location?.city;
                          const state = (member as any).overrides?.state || user?.location?.state;
                          return city && state ? `${city}, ${state}` : city || 'Not specified';
                        })()
                      )}
                    </td>
                    {/* Burns */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          value={localEdits[member._id.toString()]?.yearsBurned !== undefined 
                            ? localEdits[member._id.toString()].yearsBurned 
                            : ((member as any).overrides?.yearsBurned !== undefined ? (member as any).overrides.yearsBurned : (user?.yearsBurned || 0))}
                          onChange={(e) => handleFieldChange(member._id.toString(), 'yearsBurned', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      ) : (
                        (() => {
                          const yearsBurned = (member as any).overrides?.yearsBurned !== undefined 
                            ? (member as any).overrides.yearsBurned 
                            : user?.yearsBurned;
                          return yearsBurned !== undefined ? (
                            yearsBurned === 0 ? (
                              <span className="text-pink-600 font-medium">Virgin</span>
                            ) : (
                              yearsBurned
                            )
                          ) : 'Not specified';
                        })()
                      )}
                    </td>
                    {/* Skills */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const currentSkills = localEdits[member._id.toString()]?.skills !== undefined 
                                ? localEdits[member._id.toString()].skills 
                                : ((member as any).overrides?.skills !== undefined ? (member as any).overrides.skills : (user?.skills || []));
                              return currentSkills.map((skill: string) => (
                                <span
                                  key={skill}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                                >
                                  {skill}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newSkills = currentSkills.filter((s: string) => s !== skill);
                                      handleFieldChange(member._id.toString(), 'skills', newSkills);
                                    }}
                                    className="hover:text-blue-900"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ));
                            })()}
                          </div>
                          <select
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value=""
                            onChange={(e) => {
                              const skill = e.target.value;
                              if (skill) {
                                const currentSkills = localEdits[member._id.toString()]?.skills !== undefined 
                                  ? localEdits[member._id.toString()].skills 
                                  : ((member as any).overrides?.skills !== undefined ? (member as any).overrides.skills : (user?.skills || []));
                                if (!currentSkills.includes(skill)) {
                                  handleFieldChange(member._id.toString(), 'skills', [...currentSkills, skill].sort());
                                }
                                e.target.value = '';
                              }
                            }}
                          >
                            <option value="">Add skill...</option>
                            {systemSkills.map((skill) => (
                              <option key={skill} value={skill}>{skill}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="text-sm">
                          {(() => {
                            const skills = (member as any).overrides?.skills !== undefined 
                              ? (member as any).overrides.skills 
                              : user?.skills;
                            return skills && skills.length > 0 ? (
                              <div className="relative group">
                                <div className="flex items-center gap-1">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {skills[0]}
                                  </span>
                                  {skills.length > 1 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                      +{skills.length - 1}
                                    </span>
                                  )}
                                </div>
                                {/* Hover tooltip */}
                                {skills.length > 1 && (
                                  <div className="absolute z-10 invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-2 px-3 bottom-full left-0 mb-2 min-w-max shadow-lg">
                                    <div className="font-medium mb-1">All Skills:</div>
                                    <div className="flex flex-wrap gap-1">
                                      {skills.map((skill: string, index: number) => (
                                        <span key={index} className="bg-gray-700 px-2 py-1 rounded text-xs">
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                    {/* Arrow */}
                                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No skills listed</span>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              className="flex items-center gap-1"
                              onClick={() => {
                                const currentEdits = localEdits[member._id.toString()] || {};
                                handleSaveEdit(member._id.toString(), currentEdits);
                              }}
                            >
                              <Save className="w-3 h-3" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1"
                              onClick={handleCancelEdit}
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1"
                              onClick={() => handleViewMember(member)}
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </Button>
                            {canEdit && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1"
                                  onClick={() => handleStartEdit(member._id.toString())}
                                >
                                  <Edit className="w-3 h-3" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                                  onClick={() => handleDeleteMember(member)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Count indicator */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            Showing <strong>{filteredMembers.length}</strong> of <strong>{members.length}</strong> members
            {activeFilters.length > 0 && (
              <span className="ml-2 text-blue-600">
                ({activeFilters.length} filter{activeFilters.length > 1 ? 's' : ''} applied)
              </span>
            )}
          </p>
        </div>

        {/* Empty states */}
        {members.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
              No members found
            </h3>
            <p className="text-body text-custom-text-secondary">
              Your camp members will appear here once they join.
            </p>
          </div>
        )}

        {members.length > 0 && filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
              No members match your filters
            </h3>
            <p className="text-body text-custom-text-secondary mb-4">
              Try adjusting your filter criteria or clear all filters to see all members.
            </p>
            <Button
              variant="outline"
              onClick={() => setActiveFilters([])}
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Member Details Modal */}
      {viewDialogOpen && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-h2 font-lato-bold text-custom-text">
                  Member Details
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseViewDialog}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

          <div className="space-y-6">
            {(() => {
              const user = typeof selectedMember.user === 'object' ? selectedMember.user : null;

              return (
                <>
                      {/* Member Info Header */}
                      <div className="flex items-center gap-4">
                        {user?.profilePhoto ? (
                        <img
                          className="h-16 w-16 rounded-full"
                            src={user.profilePhoto}
                            alt={`${user.firstName || ''} ${user.lastName || ''}`}
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-lg font-medium text-gray-700">
                              {user?.firstName?.[0] || '?'}{user?.lastName?.[0] || '?'}
                          </span>
                        </div>
                      )}
                    <div className="flex-1">
                      <h3 className="text-h3 font-lato-bold text-custom-text">
                            {user?.firstName || 'Unknown'} {user?.lastName || 'User'}
                      </h3>
                          {user?.playaName && (
                            <p className="text-body text-orange-600 font-medium">
                              "{user.playaName}"
                            </p>
                          )}
                      <p className="text-body text-custom-text-secondary">
                            {user?.email || 'No email'}
                          </p>
                          
                          {/* City and Social Media */}
                          <div className="flex items-center gap-4 mt-2">
                            {user?.city && (
                              <div className="flex items-center gap-1 text-sm text-custom-text-secondary">
                                <MapPin className="w-4 h-4" />
                                {user.city}
                      </div>
                            )}
                            
                            {/* Social Media Icons */}
                            <div className="flex items-center gap-2">
                              {user?.socialMedia?.linkedin && (
                                <a
                                  href={`https://linkedin.com/in/${user.socialMedia.linkedin}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                  title="LinkedIn Profile"
                                >
                                  <Linkedin className="w-4 h-4" />
                                </a>
                              )}
                              {user?.socialMedia?.instagram && (
                                <a
                                  href={`https://instagram.com/${user.socialMedia.instagram}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-pink-600 hover:text-pink-800 transition-colors"
                                  title="Instagram Profile"
                                >
                                  <Instagram className="w-4 h-4" />
                                </a>
                              )}
                              {user?.socialMedia?.facebook && (
                                <a
                                  href={`https://facebook.com/${user.socialMedia.facebook}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-700 hover:text-blue-900 transition-colors"
                                  title="Facebook Profile"
                                >
                                  <Facebook className="w-4 h-4" />
                                </a>
                              )}
                              
                              {/* Show disabled icons for missing social media */}
                              {!user?.socialMedia?.linkedin && (
                                <Linkedin className="w-4 h-4 text-gray-300" />
                              )}
                              {!user?.socialMedia?.instagram && (
                                <Instagram className="w-4 h-4 text-gray-300" />
                              )}
                              {!user?.socialMedia?.facebook && (
                                <Facebook className="w-4 h-4 text-gray-300" />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          Member
                        </div>
                  </div>

                      {/* Travel Plans */}
                  <div>
                    <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                      Travel Plans
                    </h3>
                    <div className="text-sm space-y-1">
                      <div className="text-green-600 font-medium">
                        Arrive: {formatArrivalDepartureDate(user?.arrivalDate || '')}
                      </div>
                      <div className="text-yellow-600 font-medium">
                        Depart: {formatArrivalDepartureDate(user?.departureDate || '')}
                      </div>
                    </div>
                  </div>

                      {/* Early Arrival & Late Departure */}
                  <div>
                    <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                      Early Arrival & Late Departure
                    </h3>
                    <div className="text-sm space-y-1">
                      <div>EA: <span className={user?.interestedInEAP ? 'text-green-600 font-medium' : 'text-red-300'}>{user?.interestedInEAP ? 'Yes' : 'No'}</span></div>
                      <div>LD: <span className={user?.interestedInStrike ? 'text-green-600 font-medium' : 'text-red-300'}>{user?.interestedInStrike ? 'Yes' : 'No'}</span></div>
                    </div>
                  </div>

                      {/* Ticket & Vehicle Pass */}
                  <div>
                    <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                      Ticket & Vehicle Pass
                    </h3>
                    <div className="text-sm space-y-1">
                          <div>Ticket: <span className={
                            user?.hasTicket === true ? 'text-green-600 font-medium' : 
                            user?.hasTicket === false ? 'text-red-300' : 
                            'text-gray-500'
                          }>{
                            user?.hasTicket === true ? 'Yes' : 
                            user?.hasTicket === false ? 'No' : 
                            'Not informed'
                          }</span></div>
                          <div>VP: <span className={
                            user?.hasVehiclePass === true ? 'text-green-600 font-medium' : 
                            user?.hasVehiclePass === false ? 'text-red-300' : 
                            'text-gray-500'
                          }>{
                            user?.hasVehiclePass === true ? 'Yes' : 
                            user?.hasVehiclePass === false ? 'No' : 
                            'Not informed'
                          }</span></div>
                    </div>
                  </div>

                      {/* Burns */}
                  <div>
                    <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                          🔥 Burns
                    </h3>
                    <p className="text-gray-600">
                          {user?.yearsBurned !== undefined ? (
                            user.yearsBurned === 0 ? (
                              <span className="text-pink-600 font-medium">Virgin</span>
                            ) : (
                              user.yearsBurned
                            )
                          ) : 'Not specified'}
                    </p>
                  </div>

                      {/* Skills */}
                  <div>
                    <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                      🛠️ Skills
                    </h3>
                    <div className="text-sm">
                      {user?.skills && user.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {user.skills.map((skill, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No skills listed</p>
                      )}
                    </div>
                  </div>

                      {/* Application Information */}
                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        {selectedMember.applicationData?.motivation && (
                  <div>
                            <h4 className="text-label font-medium text-custom-text mb-2">Motivation</h4>
                            <p className="text-body text-custom-text-secondary">
                              {selectedMember.applicationData.motivation}
                            </p>
                          </div>
                        )}

                        {selectedMember.applicationData?.experience && (
                        <div>
                            <h4 className="text-label font-medium text-custom-text mb-2">Experience</h4>
                            <p className="text-body text-custom-text-secondary">
                              {selectedMember.applicationData.experience}
                          </p>
                        </div>
                      )}

                        {/* Chosen Call Time */}
                        <div>
                          <h4 className="text-label font-medium text-custom-text mb-2">📞 Chosen Call Time</h4>
                          {selectedMember.applicationData?.callSlot ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-blue-600" />
                                <div>
                                  <div className="font-semibold text-blue-900">
                                    {new Date(selectedMember.applicationData.callSlot.date).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'long',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                    </div>
                                  <div className="text-blue-700 flex items-center gap-2 mt-1">
                                    <Clock className="w-4 h-4" />
                                    {selectedMember.applicationData.callSlot.startTime} - {selectedMember.applicationData.callSlot.endTime}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : selectedMember.applicationData?.selectedCallSlotId ? (
                            <p className="text-body text-gray-500 italic">Call slot not available</p>
                          ) : (
                            <p className="text-body text-gray-500 italic">No call time selected</p>
                          )}
                        </div>
                      </div>

                      {/* Status & Review Notes */}
                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Member Status
                          </label>
                          <div className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg">
                            <span className="text-sm text-gray-900">Active Member</span>
                          </div>
                        </div>

                        {selectedMember.reviewNotes && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Review Notes
                            </label>
                            <div className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg">
                              <p className="text-sm text-gray-700">{selectedMember.reviewNotes}</p>
                            </div>
                          </div>
                        )}

                        {selectedMember.appliedAt && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Membership Information
                            </label>
                            <div className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Joined:</span> {formatDate(selectedMember.appliedAt)}
                              </p>
                            </div>
                          </div>
                        )}
                  </div>
                </>
              );
            })()}
              </div>
            </div>
          </div>
          </div>
        )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteDialogOpen}
        onClose={handleCancelDelete}
        title="Confirm Member Deletion"
        size="sm"
      >
        {memberToDelete && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="mb-2">Are you sure you want to remove this member from the roster?</p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <p className="text-yellow-800 font-medium text-xs">
                  ⚠️ This action will:
                </p>
                <ul className="text-yellow-700 text-xs mt-1 ml-4 list-disc">
                  <li>Remove the member from the active roster</li>
                  <li>Reset their application status to allow re-application</li>
                  <li>Allow them to apply again to this camp immediately</li>
                </ul>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                {(() => {
                  const memberData = memberToDelete.member || memberToDelete;
                  const user = typeof memberData.user === 'object' ? memberData.user : null;
                  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown User';
                  const userPhoto = user?.profilePhoto;
                  
                  return (
                    <>
                      <div className="flex-shrink-0 h-8 w-8">
                        {userPhoto ? (
                          <img
                            className="h-8 w-8 rounded-full"
                            src={userPhoto}
                            alt={userName}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-700">
                              {userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{userName}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={deleteLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Member
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Member Edit Modal */}
      <Modal
        isOpen={editDialogOpen}
        onClose={handleCloseEditDialog}
        title="Edit Member Details"
        size="lg"
      >
        {memberToEdit && (
          <div className="space-y-6">
            {(() => {
              const memberData = memberToEdit.member || memberToEdit;
              const user = typeof memberData.user === 'object' ? memberData.user : null;
              const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown User';
              const userEmail = user?.email || 'No email';
              const userPhoto = user?.profilePhoto;

              return (
                <>
                  {/* Header with Photo Management */}
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      {userPhoto ? (
                        <img
                          className="h-16 w-16 rounded-full"
                          src={userPhoto}
                          alt={userName}
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-lg font-medium text-gray-700">
                            {userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0 rounded-full bg-white shadow-sm"
                          onClick={() => {
                            // TODO: Implement photo upload
                            alert('Photo upload coming soon...');
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-h3 font-lato-bold text-custom-text">
                        {userName}
                      </h3>
                      <p className="text-body text-custom-text-secondary">
                        {userEmail}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500 font-mono">
                          UID: {user?._id || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Previous Camp: {user?.campName || 'None'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Camp-Specific Fields */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-custom-text mb-4">Camp-Specific Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-custom-text mb-2">
                          Arrival Date
                        </label>
                        <input
                          type="date"
                          value={user?.arrivalDate ? new Date(user.arrivalDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            // TODO: Implement date update
                            console.log('Arrival date changed:', e.target.value);
                          }}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-custom-text mb-2">
                          Departure Date
                        </label>
                        <input
                          type="date"
                          value={user?.departureDate ? new Date(user.departureDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            // TODO: Implement date update
                            console.log('Departure date changed:', e.target.value);
                          }}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-custom-text mb-2">
                          Early Arrival
                        </label>
                        <select
                          value={user?.interestedInEAP ? 'yes' : 'no'}
                          onChange={(e) => {
                            // TODO: Implement EA update
                            console.log('EA preference changed:', e.target.value);
                          }}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-custom-text mb-2">
                          Late Departure
                        </label>
                        <select
                          value={user?.interestedInStrike ? 'yes' : 'no'}
                          onChange={(e) => {
                            // TODO: Implement LD update
                            console.log('LD preference changed:', e.target.value);
                          }}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-custom-text mb-2">
                          Has Ticket
                        </label>
                        <select
                          value={user?.hasTicket ? 'yes' : 'no'}
                          onChange={(e) => {
                            // TODO: Implement ticket update
                            console.log('Ticket status changed:', e.target.value);
                          }}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-custom-text mb-2">
                          Has Vehicle Pass
                        </label>
                        <select
                          value={user?.hasVehiclePass ? 'yes' : 'no'}
                          onChange={(e) => {
                            // TODO: Implement VP update
                            console.log('VP status changed:', e.target.value);
                          }}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-custom-text mb-2">
                        Internal Notes
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Add internal notes about this member..."
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={handleCloseEditDialog}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        // TODO: Implement save functionality
                        alert('Save functionality coming soon...');
                        handleCloseEditDialog();
                      }}
                      className="flex-1"
                    >
                      Save Changes
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Dues Confirmation Modal */}
      <Modal
        isOpen={duesConfirmModal.isOpen}
        onClose={handleDuesCancel}
        title="Confirm Dues Status Change"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-gray-700">
              {duesConfirmModal.member && (
                duesConfirmModal.currentStatus
                  ? `Mark ${duesConfirmModal.member.user?.firstName || 'Unknown'} ${duesConfirmModal.member.user?.lastName || 'Member'}'s dues as unpaid?`
                  : `Mark ${duesConfirmModal.member.user?.firstName || 'Unknown'} ${duesConfirmModal.member.user?.lastName || 'Member'}'s dues as paid?`
              )}
            </p>
          </div>
          
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleDuesCancel}
              disabled={duesLoading !== null}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDuesConfirm}
              disabled={duesLoading !== null}
              className="flex items-center gap-2"
            >
              {duesLoading !== null ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Updating...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Members Modal */}
      <InviteMembersModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        campId={campId || user?._id?.toString() || ''}
      />

      {/* Rename Roster Modal */}
      <Modal
        isOpen={renameModalOpen}
        onClose={handleCloseRenameModal}
        title="Rename Roster"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roster Name
            </label>
            <input
              type="text"
              value={newRosterName}
              onChange={(e) => setNewRosterName(e.target.value)}
              placeholder="Enter roster name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !renameLoading) {
                  handleSaveRosterName();
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCloseRenameModal}
              disabled={renameLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveRosterName}
              disabled={renameLoading || !newRosterName.trim()}
              className="flex items-center gap-2"
            >
              {renameLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Member Modal */}
      {rosterId && (
        <AddMemberModal
          isOpen={addMemberModalOpen}
          onClose={() => setAddMemberModalOpen(false)}
          rosterId={parseInt(rosterId)}
          onMemberAdded={fetchMembers}
        />
      )}

    </div>
  );
};

export default MemberRoster;
