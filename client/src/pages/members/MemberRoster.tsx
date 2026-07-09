import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button, Card, Modal, Input } from '../../components/ui';
import ShiftsOnlyRosterTable from '../../components/roster/ShiftsOnlyRosterTable';
import { User, Loader2, Eye, Edit, Trash2, Save, X, Users, Plus, Mail, MapPin, Linkedin, Instagram, Facebook, Calendar, Clock, Upload, ClipboardList, CheckCircle } from 'lucide-react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Member, StructuredLocation } from '../../types';
import { formatDate } from '../../utils/dateFormatters';
import MetricsPanel from '../../components/roster/MetricsPanel';
import ShiftsOnlyMetricsPanel from '../../components/roster/ShiftsOnlyMetricsPanel';
import RosterFilters, { FilterType } from '../../components/roster/RosterFilters';
import { ImportRosterModal, InviteMembersModal } from '../../components/invites';
import AddMemberModal from '../../components/roster/AddMemberModal';
import CityAutocomplete from '../../components/location/CityAutocomplete';
import { useSkills } from '../../hooks/useSkills';
import CampLeadBadge from '../../components/badges/CampLeadBadge';
import CampLeadConfirmModal from '../../components/modals/CampLeadConfirmModal';
import { canAssignCampLeadRole } from '../../utils/permissions';
import { FoodPreferenceMultiSelect, FoodPreferenceTags } from '../../components/food/FoodPreferenceControls';
import { normalizeFoodPreferences } from '../../constants/foodPreferences';
import { renderRichTextToHtml } from '../../utils/richText';

// Extended type for roster members that includes nested member data
interface RosterMember extends Member {
  member?: Member; // Nested member structure from API
  isCampLead?: boolean; // Camp Lead role
  isEventsLead?: boolean; // Events Lead role
  rosterStatus?: string; // Roster-specific status (active, pending, approved, etc.)
  responseGroupExtraCount?: number;
  responseGroupOtherNames?: string[];
}

// Rosters are strictly one of these modes. The server-side Mongoose schema
// (server/models/Roster.js) enforces `rosterType: enum ['shifts_only',
// 'full_membership']`, so 'mixed' is not a persistable state. We keep 'none'
// for the UI-only case where a camp has no active roster yet.
type RosterMode = 'none' | 'shifts_only' | 'full_membership';
type DelegatedCampRole = 'campLead' | 'eventsLead';
const SOR_IMPLEMENTATION_CUTOFF_ISO = '2026-04-01T00:00:00.000Z';
const SOR_IMPLEMENTATION_CUTOFF_MS = Date.parse(SOR_IMPLEMENTATION_CUTOFF_ISO);
const DUES_FILTER_TYPES = new Set<FilterType>(['dues-paid', 'dues-unpaid', 'dues-instructed']);
const getObjectIdTimestampMs = (value?: string | null): number | null => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[a-fA-F0-9]{24}$/.test(trimmed)) return null;
  const epochSeconds = Number.parseInt(trimmed.slice(0, 8), 16);
  if (Number.isNaN(epochSeconds)) return null;
  return epochSeconds * 1000;
};

const getCampPublicIdentifier = (camp: any): string => {
  const candidates = [camp?.slug, camp?.urlSlug, camp?._id];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
};

const toIdString = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof (value as { toString?: () => string }).toString === 'function') {
    const stringValue = (value as { toString: () => string }).toString();
    return stringValue === '[object Object]' ? '' : stringValue;
  }
  return '';
};

const copyTextToClipboard = async (value: string) => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

/**
 * Determine the mode of a roster.
 *
 * The server-side Roster schema enforces `rosterType: enum ['shifts_only',
 * 'full_membership']`, so that field is the single source of truth whenever
 * it's present. We only fall back to member-level heuristics (signupSource /
 * isShiftsOnly / status) for edge cases where `rosterType` is missing from
 * the response — e.g. legacy documents predating the field. Heuristic
 * disagreement with `rosterType` is treated as a data-integrity issue: we
 * trust the schema value and log a warning.
 */
const deriveRosterMode = (roster: any): {
  mode: RosterMode;
  hasShiftsOnlyRoster: boolean;
  hasFullMembershipRoster: boolean;
  memberCount: number;
} => {
  const explicitRosterType: RosterMode | null =
    roster?.rosterType === 'shifts_only' || roster?.rosterType === 'full_membership'
      ? roster.rosterType
      : null;
  const members = Array.isArray(roster?.members) ? roster.members : [];

  // Member-level heuristic — used only when rosterType is missing, or to
  // detect schema/data inconsistencies when it IS present.
  const analyzed = members.map((entry: any) => {
    const member = entry?.member || {};
    const signupSource = String(member?.signupSource || '').toLowerCase();
    const normalizedStatus = String(member?.status || '').toLowerCase();
    const hasUserAccount = Boolean(member?.user);
    const hasFullMembershipSignal =
      signupSource === 'application' || signupSource === 'standard_invite';
    // 'manual' means "added via the SOR manual-add button" — still shifts-only.
    const isShiftsOnly =
      signupSource === 'shifts_only_invite'
      || signupSource === 'manual'
      || (member?.isShiftsOnly === true
        && normalizedStatus === 'roster_only'
        && !hasUserAccount
        && !hasFullMembershipSignal);
    const isFullMembership =
      member?.isShiftsOnly === false
      || hasFullMembershipSignal
      || (!isShiftsOnly && hasUserAccount)
      || (!isShiftsOnly && normalizedStatus !== 'roster_only');
    return { isShiftsOnly, isFullMembership };
  });
  const heuristicHasShiftsOnly = analyzed.some((e) => e.isShiftsOnly);
  const heuristicHasFullMembership = analyzed.some((e) => e.isFullMembership);

  let mode: RosterMode = 'none';
  if (explicitRosterType) {
    // Trust the schema. If heuristics disagree, log once — this indicates
    // stale signupSource values that a data migration should fix.
    mode = explicitRosterType;
    const heuristicSuggestsSor = heuristicHasShiftsOnly && !heuristicHasFullMembership;
    const heuristicSuggestsFmr = heuristicHasFullMembership && !heuristicHasShiftsOnly;
    if (
      (explicitRosterType === 'shifts_only' && heuristicSuggestsFmr)
      || (explicitRosterType === 'full_membership' && heuristicSuggestsSor)
    ) {
      console.warn(
        `⚠️ [deriveRosterMode] Member heuristic disagrees with roster.rosterType='${explicitRosterType}'. ` +
          `Trusting schema. Data may need migration (check signupSource / isShiftsOnly on members).`
      );
    }
  } else if (heuristicHasShiftsOnly) {
    // No rosterType — legacy fallback. Favor shifts_only if ANY member looks SOR,
    // since FMR cannot coexist with SOR under current product rules.
    mode = 'shifts_only';
  } else if (heuristicHasFullMembership) {
    mode = 'full_membership';
  }

  return {
    mode,
    hasShiftsOnlyRoster: mode === 'shifts_only',
    hasFullMembershipRoster: mode === 'full_membership',
    memberCount: members.length
  };
};

type DuesStatus = 'UNPAID' | 'INSTRUCTED' | 'PAID';
type PaymentKind = 'dues' | 'mealPlan';

const PAYMENT_LABELS: Record<PaymentKind, { singular: string; actionTitle: string; errorNoun: string }> = {
  dues: {
    singular: 'Dues',
    actionTitle: 'Dues Actions',
    errorNoun: 'dues'
  },
  mealPlan: {
    singular: 'Meal Plan',
    actionTitle: 'Meal Plan Actions',
    errorNoun: 'meal plan'
  }
};

const normalizeDuesStatus = (status?: string | null): DuesStatus => {
  if (!status) return 'UNPAID';

  const normalized = status.toString().trim().toUpperCase();
  if (normalized === 'UNPAID' || normalized === 'INSTRUCTED' || normalized === 'PAID') {
    return normalized;
  }

  console.warn('[MemberRoster] Unknown dues status received:', status, '-> defaulting to UNPAID');
  return 'UNPAID';
};

const toStructuredLocationOrNull = (location?: Partial<StructuredLocation> | null): StructuredLocation | null => {
  if (!location) return null;
  if (!location.city || !location.country || !location.countryCode) return null;
  if (location.lat === undefined || location.lng === undefined) return null;
  return {
    city: location.city,
    state: location.state,
    country: location.country,
    countryCode: location.countryCode,
    lat: Number(location.lat),
    lng: Number(location.lng),
    placeId: location.placeId
  };
};

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC'
};

const formatRosterLocation = ({
  city,
  state,
  country,
  countryCode
}: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;
}): string => {
  const normalizedCity = String(city || '').trim();
  if (!normalizedCity) return 'Not specified';

  const normalizedState = String(state || '').trim();
  const normalizedCountry = String(country || '').trim();
  const normalizedCountryCode = String(countryCode || '').trim().toUpperCase();
  const inferredUsFromLegacyState = !normalizedCountry && !!normalizedState;
  const isUS =
    inferredUsFromLegacyState ||
    normalizedCountryCode === 'US' ||
    normalizedCountryCode === 'USA' ||
    ['united states', 'united states of america', 'usa', 'us'].includes(normalizedCountry.toLowerCase());

  if (isUS) {
    const stateKey = normalizedState.toLowerCase();
    const twoLetterState =
      US_STATE_ABBREVIATIONS[stateKey] ||
      (normalizedState.length === 2 ? normalizedState.toUpperCase() : '');

    return twoLetterState ? `${normalizedCity}, ${twoLetterState}` : normalizedCity;
  }

  return normalizedCountry ? `${normalizedCity}, ${normalizedCountry}` : normalizedCity;
};

const MemberRoster: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { campIdentifier } = useParams<{ campIdentifier?: string }>();
  const authUser = user;
  const { skills: systemSkills } = useSkills();
  
  // Security check: Verify camp identifier matches authenticated user's camp
  useEffect(() => {
    if (campIdentifier && user) {
      // Camp accounts and admins - check campId/urlSlug match
      if (user.accountType === 'camp' || (user.accountType === 'admin' && user.campId)) {
        const userCampId = user.campId?.toString() || user._id?.toString();
        const identifierMatches = campIdentifier === userCampId || 
                                  campIdentifier === user.urlSlug ||
                                  (user.campName && campIdentifier === user.campName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
        
        if (!identifierMatches) {
          console.error('❌ [MemberRoster] Camp identifier mismatch. Redirecting...');
          navigate('/dashboard', { replace: true });
          return;
        }
      }
      // Camp Leads - check campLeadCampId match
      else if (user.isCampLead === true && user.campLeadCampId) {
        const identifierMatches = campIdentifier === user.campLeadCampId ||
                                  campIdentifier === user.campLeadCampSlug;
        
        if (!identifierMatches) {
          console.error('❌ [MemberRoster] Camp Lead trying to access wrong camp. Redirecting...');
          navigate('/dashboard', { replace: true });
          return;
        }
      }
      // Events Leads - check eventsLeadCampId match
      else if (user.isEventsLead === true && user.eventsLeadCampId) {
        const identifierMatches = campIdentifier === user.eventsLeadCampId ||
                                  campIdentifier === user.eventsLeadCampSlug;

        if (!identifierMatches) {
          console.error('❌ [MemberRoster] Events Lead trying to access wrong camp. Redirecting...');
          navigate('/dashboard', { replace: true });
          return;
        }
      }
    }
  }, [campIdentifier, user, navigate]);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campId, setCampId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<RosterMember | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingFoodPreferencesMemberId, setEditingFoodPreferencesMemberId] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<any>>>({});
  const [hasActiveRoster, setHasActiveRoster] = useState(false); // Will be set to true if active roster is found
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showRosterSetupModal, setShowRosterSetupModal] = useState(false);
  const [rosterSetupStep, setRosterSetupStep] = useState<1 | 2>(1);
  const [rosterSetupType, setRosterSetupType] = useState<'shifts_only' | 'full_membership' | null>(null);
  const [selectedRosterType, setSelectedRosterType] = useState<'shifts_only' | 'full_membership' | null>(null);
  const [pendingRosterBootstrapType, setPendingRosterBootstrapType] = useState<'shifts_only' | null>(null);
  const [duesActionModal, setDuesActionModal] = useState<{
    isOpen: boolean;
    member: any;
    paymentKind: PaymentKind;
  }>({ isOpen: false, member: null, paymentKind: 'dues' });
  const [emailPreviewModal, setEmailPreviewModal] = useState<{
    isOpen: boolean;
    paymentKind: PaymentKind;
    member: any;
    actionType: 'instructions' | 'receipt' | null;
    nextStatus?: 'UNPAID' | 'INSTRUCTED' | 'PAID';
    subject: string;
    body: string;
    saveAsCampDefault: boolean;
    sending: boolean;
  }>({
    isOpen: false,
    paymentKind: 'dues',
    member: null,
    actionType: null,
    subject: '',
    body: '',
    saveAsCampDefault: false,
    sending: false
  });
  const [duesLoading, setDuesLoading] = useState<string | null>(null);
  const [mealPlanLoading, setMealPlanLoading] = useState<string | null>(null);
  const [foodPreferenceSavingId, setFoodPreferenceSavingId] = useState<string | null>(null);
  const [mealPlanTemplatesLoading, setMealPlanTemplatesLoading] = useState(false);
  const [mealPlanTemplatesModalOpen, setMealPlanTemplatesModalOpen] = useState(false);
  const [mealPlanTemplatesForm, setMealPlanTemplatesForm] = useState({
    instructionsSubject: '',
    instructionsBody: '',
    receiptSubject: '',
    receiptBody: ''
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<RosterMember | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<RosterMember | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [importRosterModalOpen, setImportRosterModalOpen] = useState(false);
  // Roster rename state
  const [rosterName, setRosterName] = useState<string>('Member Roster');
  const [rosterId, setRosterId] = useState<string | null>(null);
  /** SOR manual invite reminders — mirrors GET /rosters/active `sorInviteRemindersEnabled`. */
  const [sorInviteRemindersEnabled, setSorInviteRemindersEnabled] = useState(false);
  const [responseGroupsByPrimary, setResponseGroupsByPrimary] = useState<
    Record<string, { extraCount: number; otherNames: string[] }>
  >({});
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newRosterName, setNewRosterName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const showAddMemberTile = true;
  // Camp Lead role management
  const [campLeadConfirmModal, setCampLeadConfirmModal] = useState<{
    isOpen: boolean;
    member: RosterMember | null;
    action: 'grant' | 'revoke';
    role: DelegatedCampRole;
    replaceExistingRole: boolean;
  }>({
    isOpen: false,
    member: null,
    action: 'grant',
    role: 'campLead',
    replaceExistingRole: false
  });
  const [campLeadLoading, setCampLeadLoading] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<Array<{ key: string; label: string; type: 'text' | 'number' | 'dropdown' | 'checkbox'; options?: string[] }>>([]);
  const [customFieldsModalOpen, setCustomFieldsModalOpen] = useState(false);
  const [customFieldsSaving, setCustomFieldsSaving] = useState(false);
  const [campAcceptingApplications, setCampAcceptingApplications] = useState(false);
  const [campPubliclyVisible, setCampPubliclyVisible] = useState(false);
  const [campPublicIdentifier, setCampPublicIdentifier] = useState('');
  const [campInvitationLinkCopied, setCampInvitationLinkCopied] = useState(false);
  const [campCreatedAtMs, setCampCreatedAtMs] = useState<number | null>(null);
  const [rosterModeState, setRosterModeState] = useState<{
    mode: RosterMode;
    hasShiftsOnlyRoster: boolean;
    hasFullMembershipRoster: boolean;
    memberCount: number;
  }>({ mode: 'none', hasShiftsOnlyRoster: false, hasFullMembershipRoster: false, memberCount: 0 });
  const rosterTableScrollRef = useRef<HTMLDivElement | null>(null);
  const [rosterMaxScrollLeft, setRosterMaxScrollLeft] = useState(0);
  const [rosterScrollLeft, setRosterScrollLeft] = useState(0);
  const [showRosterTopScrollbar, setShowRosterTopScrollbar] = useState(false);

  // Check if current user can access roster features
  // Allow access for:
  // 1. Camp accounts (accountType === 'camp')
  // 2. Admin accounts with campId
  // 3. Camp Leads (personal accounts with isCampLead === true)
  // 4. Events Leads (roster view plus meal-plan and food-preference operations)
  const isCampContext = user?.accountType === 'camp' 
    || (user?.accountType === 'admin' && user?.campId)
    || (user?.isCampLead === true && user?.campLeadCampId)
    || (user?.isEventsLead === true && user?.eventsLeadCampId);
  
  const isFullRosterManager = user?.accountType === 'admin'
    || user?.accountType === 'camp'
    || (user?.isCampLead === true);
  const isEventsLeadForRoster = Boolean(
    user?.isEventsLead === true &&
      user?.eventsLeadCampId &&
      (!campId || user.eventsLeadCampId === campId)
  );
  
  const canAccessRoster = Boolean(isCampContext && (isFullRosterManager || isEventsLeadForRoster));
  const canEdit = Boolean(canAccessRoster && isFullRosterManager);
  const canManageMealPlan = Boolean(canAccessRoster && (canEdit || isEventsLeadForRoster));
  const canEditFoodPreferences = canManageMealPlan;
  const canViewDuesData = canEdit;
  const canViewApplicationData = canEdit;
  const canUseContactDetails = canEdit;
  const canAssignDelegatedRoles = canEdit && canAssignCampLeadRole(authUser, campId || undefined);
  const canViewRosterActions = canEdit;
  const authUserId = toIdString(authUser?._id);
  const limitDelegatedRoleVisibilityToSelf = isEventsLeadForRoster && !canEdit;
  const inferredCampCreatedAtMs = campCreatedAtMs ?? getObjectIdTimestampMs(campId);
  const isLegacyPreSorCamp = inferredCampCreatedAtMs !== null && inferredCampCreatedAtMs < SOR_IMPLEMENTATION_CUTOFF_MS;
  const activeRosterType: RosterMode = !hasActiveRoster
    ? 'none'
    : isLegacyPreSorCamp
      ? 'full_membership'
    : (rosterModeState.mode === 'shifts_only' || rosterModeState.mode === 'full_membership')
      ? rosterModeState.mode
      : selectedRosterType || rosterModeState.mode;
  // Rosters are strictly SOR or FMR — these booleans follow directly from the
  // resolved `activeRosterType` (which in turn prefers the schema-enforced
  // `roster.rosterType`). We also consult `rosterModeState.mode` to handle
  // the transient window where `activeRosterType` has not yet been refreshed.
  const hasShiftsOnlyRoster = hasActiveRoster && (
    activeRosterType === 'shifts_only'
    || rosterModeState.mode === 'shifts_only'
  );
  const isLikelyFullMembershipByCampSetting = hasActiveRoster
    && campAcceptingApplications
    && !hasShiftsOnlyRoster;
  const isFullMembershipRoster = (hasActiveRoster && (
    activeRosterType === 'full_membership'
    || rosterModeState.mode === 'full_membership'
  )) || isLikelyFullMembershipByCampSetting;
  const canManageFullMembershipInvites = canEdit && (campAcceptingApplications || authUser?.isCampLead === true);
  const canViewFullMembershipMetrics = canAccessRoster && isFullMembershipRoster && isLegacyPreSorCamp;
  const canViewShiftsOnlyMetrics = canAccessRoster && hasShiftsOnlyRoster;
  const canUseFilters = canAccessRoster && isFullMembershipRoster;
  const campInvitationUrl = useMemo(() => {
    if (!campPublicIdentifier) return '';
    const params = new URLSearchParams({ camp: campPublicIdentifier });
    return `${window.location.origin}/apply?${params.toString()}`;
  }, [campPublicIdentifier]);

  useEffect(() => {
    if (!campId) return;
    try {
      const stored = localStorage.getItem(`rosterType:${campId}`);
      if (stored === 'shifts_only' || stored === 'full_membership') {
        setSelectedRosterType(stored);
      } else {
        setSelectedRosterType(null);
      }
    } catch (_error) {
      setSelectedRosterType(null);
    }
  }, [campId]);

  useEffect(() => {
    if (duesActionModal.isOpen) {
      console.log('[DuesActionsModal] opened with payload:', {
        paymentKind: duesActionModal.paymentKind,
        memberId: duesActionModal.member?._id,
        duesStatus: duesActionModal.member?.duesStatus,
        mealPlanStatus: duesActionModal.member?.mealPlanStatus,
        normalizedDuesStatus: normalizeDuesStatus(duesActionModal.member?.duesStatus),
        normalizedMealPlanStatus: normalizeDuesStatus(duesActionModal.member?.mealPlanStatus),
        hasMember: Boolean(duesActionModal.member)
      });
    }
  }, [duesActionModal]);

  useEffect(() => {
    const container = rosterTableScrollRef.current;
    if (!container) return;

    const updateTopScrollbar = () => {
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      setRosterMaxScrollLeft(maxScroll);
      setShowRosterTopScrollbar(maxScroll > 0);
      setRosterScrollLeft(container.scrollLeft);
    };

    const handleContainerScroll = () => {
      setRosterScrollLeft(container.scrollLeft);
    };

    updateTopScrollbar();
    container.addEventListener('scroll', handleContainerScroll);

    const observer = new ResizeObserver(updateTopScrollbar);
    observer.observe(container);
    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }
    window.addEventListener('resize', updateTopScrollbar);

    return () => {
      container.removeEventListener('scroll', handleContainerScroll);
      observer.disconnect();
      window.removeEventListener('resize', updateTopScrollbar);
    };
  }, [members.length, activeFilters.length, canEdit]);

  // Start editing a member
  const handleStartEdit = (memberId: string) => {
    if (!canEdit) return;
    setEditingFoodPreferencesMemberId(null);
    setEditingMemberId(memberId);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMemberId(null);
    setEditingFoodPreferencesMemberId(null);
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

  const handleStartFoodPreferencesEdit = (memberId: string) => {
    if (!canEditFoodPreferences) return;
    setEditingFoodPreferencesMemberId(memberId);
  };

  const handleCloseFoodPreferencesEdit = async (memberId: string) => {
    if (editingFoodPreferencesMemberId !== memberId) return;

    const currentEdits = localEdits[memberId] || {};
    if (currentEdits.foodPreferences === undefined) {
      setEditingFoodPreferencesMemberId(null);
      return;
    }

    if (!rosterId) {
      setEditingFoodPreferencesMemberId(null);
      alert('Roster ID not found');
      return;
    }

    try {
      setFoodPreferenceSavingId(memberId);
      await api.put(`/rosters/${rosterId}/members/${memberId}/overrides`, {
        foodPreferences: normalizeFoodPreferences(currentEdits.foodPreferences)
      });

      setLocalEdits(prev => {
        const newEdits = { ...prev };
        delete newEdits[memberId];
        return newEdits;
      });
      setEditingFoodPreferencesMemberId(null);
      await fetchMembers();
    } catch (error: any) {
      console.error('Error saving food preferences:', error);
      alert(error?.response?.data?.message || 'Failed to save food preferences. Please try again.');
      setEditingFoodPreferencesMemberId(null);
    } finally {
      setFoodPreferenceSavingId(null);
    }
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
      if (canEdit && allEdits.playaName !== undefined) overridesData.playaName = allEdits.playaName;
      if (canEdit && allEdits.yearsBurned !== undefined) overridesData.yearsBurned = allEdits.yearsBurned;
      if (canEdit && allEdits.skills !== undefined) overridesData.skills = allEdits.skills;
      if (canEditFoodPreferences && allEdits.foodPreferences !== undefined) overridesData.foodPreferences = normalizeFoodPreferences(allEdits.foodPreferences);
      if (canEdit && allEdits.hasTicket !== undefined) overridesData.hasTicket = allEdits.hasTicket;
      if (canEdit && allEdits.hasVehiclePass !== undefined) overridesData.hasVehiclePass = allEdits.hasVehiclePass;
      if (canEdit && allEdits.interestedInEAP !== undefined) overridesData.interestedInEAP = allEdits.interestedInEAP;
      if (canEdit && allEdits.interestedInStrike !== undefined) overridesData.interestedInStrike = allEdits.interestedInStrike;
      if (canEdit && allEdits.arrivalDate !== undefined) overridesData.arrivalDate = allEdits.arrivalDate;
      if (canEdit && allEdits.departureDate !== undefined) overridesData.departureDate = allEdits.departureDate;
      if (canEdit && allEdits.city !== undefined) overridesData.city = allEdits.city;
      if (canEdit && allEdits.state !== undefined) overridesData.state = allEdits.state;
      if (canEdit && allEdits.location !== undefined) {
        overridesData.location = allEdits.location;
        if (allEdits.location) {
          overridesData.city = allEdits.location.city;
          overridesData.state = allEdits.location.state || '';
        } else {
          overridesData.city = '';
          overridesData.state = '';
        }
      }

      if (Object.keys(overridesData).length === 0) {
        setEditingMemberId(null);
        return;
      }

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
      setEditingFoodPreferencesMemberId(null);

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
    const selectedLocation =
      toStructuredLocationOrNull(currentEdits?.location) ||
      toStructuredLocationOrNull(overrides?.location) ||
      toStructuredLocationOrNull(user?.location);
    const legacyCity = currentEdits?.city || overrides?.city || user?.city || '';

    return (
      <div className="flex flex-col space-y-1">
        <CityAutocomplete
          label=""
          placeholder="Search city..."
          value={selectedLocation}
          onChange={(location) => {
            handleFieldChange(memberId, 'location', location);
            handleFieldChange(memberId, 'city', location?.city || '');
            handleFieldChange(memberId, 'state', location?.state || '');
          }}
          legacyValue={!selectedLocation ? legacyCity : undefined}
        />
      </div>
    );
  };

  const fetchCampData = async () => {
    try {
      // For Camp Leads, use their delegated camp ID
      if (user?.isCampLead && user?.campLeadCampId) {
        console.log('🔍 [MemberRoster] Setting campId for Camp Lead:', user.campLeadCampId);
        setCampId(user.campLeadCampId);
        try {
          const campResponse = await api.get(`/camps/${user.campLeadCampId}`);
          const camp = campResponse?.camp || campResponse;
          setCampAcceptingApplications(camp?.acceptingApplications !== undefined ? Boolean(camp.acceptingApplications) : true);
          setCampPubliclyVisible(Boolean(camp?.isPubliclyVisible ?? camp?.isPublic));
          setCampPublicIdentifier(getCampPublicIdentifier(camp) || user.campLeadCampSlug || user.campLeadCampId);
          const createdAtMs = Date.parse(String(camp?.createdAt || ''));
          setCampCreatedAtMs(Number.isNaN(createdAtMs) ? null : createdAtMs);
        } catch (_campError) {
          setCampAcceptingApplications(false);
          setCampPubliclyVisible(false);
          setCampPublicIdentifier(user.campLeadCampSlug || user.campLeadCampId);
          setCampCreatedAtMs(null);
        }
        return;
      }

      if (user?.isEventsLead && user?.eventsLeadCampId) {
        console.log('🔍 [MemberRoster] Setting campId for Events Lead:', user.eventsLeadCampId);
        setCampId(user.eventsLeadCampId);
        try {
          const campResponse = await api.get(`/camps/${user.eventsLeadCampId}`);
          const camp = campResponse?.camp || campResponse;
          setCampAcceptingApplications(false);
          setCampPubliclyVisible(Boolean(camp?.isPubliclyVisible ?? camp?.isPublic));
          setCampPublicIdentifier(getCampPublicIdentifier(camp) || user.eventsLeadCampSlug || user.eventsLeadCampId);
          const createdAtMs = Date.parse(String(camp?.createdAt || ''));
          setCampCreatedAtMs(Number.isNaN(createdAtMs) ? null : createdAtMs);
        } catch (_campError) {
          setCampAcceptingApplications(false);
          setCampPubliclyVisible(false);
          setCampPublicIdentifier(user.eventsLeadCampSlug || user.eventsLeadCampId);
          setCampCreatedAtMs(null);
        }
        return;
      }
      
      // For camp accounts and admins
      const campData = await api.getMyCamp();
      setCampId(campData._id.toString());
      setCampAcceptingApplications((campData as any)?.acceptingApplications !== undefined ? Boolean((campData as any).acceptingApplications) : true);
      setCampPubliclyVisible(Boolean((campData as any)?.isPubliclyVisible ?? (campData as any)?.isPublic));
      setCampPublicIdentifier(getCampPublicIdentifier(campData));
      const createdAtMs = Date.parse(String((campData as any)?.createdAt || ''));
      setCampCreatedAtMs(Number.isNaN(createdAtMs) ? null : createdAtMs);
    } catch (err) {
      console.error('Error fetching camp data:', err);
      setError('Failed to load camp data');
      setCampAcceptingApplications(false);
      setCampPubliclyVisible(false);
      setCampPublicIdentifier('');
    }
  };

  const fetchMembers = useCallback(async () => {
    if (!campId) return;
    
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      
      // Get roster data which now includes populated user information
      // For Camp Leads, pass campId as query parameter
      const rosterResponse = await api.get(`/rosters/active?campId=${campId}`).catch((err) => {
        console.log('ℹ️ [MemberRoster] No active roster found (expected for new camps):', err.response?.status);
        return null; // Return null if no roster exists
      });
      
      console.log('🔍 [MemberRoster] Roster response:', rosterResponse);
      
      // Check if roster exists
      if (!rosterResponse || !rosterResponse._id) {
        console.log('ℹ️ [MemberRoster] No active roster - camp needs to create one');
        setHasActiveRoster(false);
        setRosterModeState({ mode: 'none', hasShiftsOnlyRoster: false, hasFullMembershipRoster: false, memberCount: 0 });
        setSelectedRosterType(null);
        try {
          localStorage.removeItem(`rosterType:${campId}`);
        } catch (_error) {
          // no-op for storage failures
        }
        setMembers([]);
        setResponseGroupsByPrimary({});
        setRosterId(null);
        setRosterName('Member Roster');
        setSorInviteRemindersEnabled(false);
        setLoading(false);
        return;
      }
      
      // Roster exists
      setHasActiveRoster(true);
      const roster = rosterResponse;
      setSorInviteRemindersEnabled(
        roster?.rosterType === 'shifts_only' && Boolean((roster as any).sorInviteRemindersEnabled)
      );
      const derivedMode = deriveRosterMode(roster);
      setRosterModeState(derivedMode);
      if (derivedMode.mode === 'shifts_only' || derivedMode.mode === 'full_membership') {
        setSelectedRosterType(derivedMode.mode);
        try {
          localStorage.setItem(`rosterType:${campId}`, derivedMode.mode);
        } catch (_error) {
          // no-op for storage failures
        }
      }
      
      // Extract roster name and ID
      if (roster._id) {
        setRosterId(roster._id.toString());
      }
      if (roster.name) {
        setRosterName(roster.name);
      }
      
      // The roster now contains members with populated user data
      // Transform roster member entries into the format expected by the component
      const enhancedMembers = (roster.members || [])
        .filter((memberEntry: any) => memberEntry.member) // Filter out any entries without a member reference
        .map((memberEntry: any) => {
          console.log('🔍 [MemberRoster] Processing member entry:', memberEntry);
          console.log('🔍 [MemberRoster] Member entry duesStatus:', memberEntry.duesStatus);
          console.log('🔍 [MemberRoster] Member entry overrides:', memberEntry.overrides);
          console.log('🔍 [MemberRoster] Member entry keys:', Object.keys(memberEntry));
          
          const normalizedDuesStatus = normalizeDuesStatus(
            memberEntry.duesStatus || (memberEntry.paid ? 'PAID' : 'UNPAID')
          );
          const normalizedMealPlanStatus = normalizeDuesStatus(memberEntry.mealPlanStatus);
          const duesPaid = normalizedDuesStatus === 'PAID';
          
          // Extract member ID safely
          let memberId;
          if (typeof memberEntry.member === 'object' && memberEntry.member._id) {
            memberId = memberEntry.member._id.toString();
          } else if (typeof memberEntry.member === 'string') {
            memberId = memberEntry.member;
          } else {
            memberId = memberEntry.member?.toString() || null;
          }
          
          const memberData = memberEntry.member || {};
          const fallbackName = memberData.name || '';
          const [fallbackFirstName, ...fallbackRest] = fallbackName.split(' ').filter(Boolean);
          const fallbackLastName = fallbackRest.join(' ');
          const fallbackUser = {
            _id: memberData.user || memberData._id || memberId,
            firstName: fallbackFirstName || memberData.firstName || '',
            lastName: fallbackLastName || memberData.lastName || '',
            email: memberData.email || '',
            playaName: memberData.playaName || '',
            city: memberData.city || '',
            yearsBurned: memberData.yearsBurned || 0,
            skills: memberData.skills || [],
            foodPreferences: normalizeFoodPreferences(memberData.foodPreferences),
            hasTicket: memberData.hasTicket,
            hasVehiclePass: memberData.hasVehiclePass,
            interestedInEAP: memberData.interestedInEAP,
            interestedInStrike: memberData.interestedInStrike,
            profilePhoto: memberData.profilePhoto || ''
          };

          return {
            _id: memberId, // The member ID (handle both object and string)
            member: memberEntry.member, // The full member object with nested user data
            user: memberEntry.member?.user || fallbackUser,  // The populated user data from the backend
            duesPaid: duesPaid,
            duesStatus: normalizedDuesStatus,
            duesInstructedAt: memberEntry.duesInstructedAt || null,
            duesPaidAt: memberEntry.duesPaidAt || null,
            duesReceiptSentAt: memberEntry.duesReceiptSentAt || null,
            mealPlanStatus: normalizedMealPlanStatus,
            mealPlanInstructedAt: memberEntry.mealPlanInstructedAt || null,
            mealPlanPaidAt: memberEntry.mealPlanPaidAt || null,
            mealPlanReceiptSentAt: memberEntry.mealPlanReceiptSentAt || null,
            isCampLead: memberEntry.isCampLead || false, // Camp Lead role
            isEventsLead: memberEntry.isEventsLead || false, // Events Lead role
            addedAt: memberEntry.addedAt,
            addedBy: memberEntry.addedBy,
            rosterStatus: memberEntry.status || 'active',
            overrides: memberEntry.overrides || {}, // Roster-specific overrides
            status: memberData.status || memberEntry.status || 'active',
            tags: memberData.tags || [],
            customFieldValues: memberData.customFieldValues || {}
          };
        })
        .filter((member: any) => member._id) // Filter out any members without a valid ID
        .filter((member: any) => {
          const normalizedStatus = String(member?.status || '').toLowerCase();
          // Defensive UI guard: removed/rejected members should never remain visible in roster grid.
          return !['deleted', 'rejected', 'withdrawn'].includes(normalizedStatus);
        });
      
      console.log('✅ [MemberRoster] Enhanced members:', enhancedMembers);
      
      setMembers(enhancedMembers);

      try {
        const rosterGroups = await api.getSurveyRosterGroups(campId);
        const groupMap = rosterGroups?.groupsByPrimary || {};
        const normalizedGroupMap = Object.entries(groupMap).reduce((acc, [memberId, group]) => {
          acc[memberId] = {
            extraCount: Number((group as any)?.extraCount || 0),
            otherNames: Array.isArray((group as any)?.otherNames) ? (group as any).otherNames : []
          };
          return acc;
        }, {} as Record<string, { extraCount: number; otherNames: string[] }>);
        setResponseGroupsByPrimary(normalizedGroupMap);
      } catch (_error) {
        setResponseGroupsByPrimary({});
      }
      
      // Clear any local edits when data is refreshed
      setLocalEdits({});
      setEditingMemberId(null);
      setEditingFoodPreferencesMemberId(null);
    } catch (err) {
      console.error('❌ [MemberRoster] Unexpected error fetching roster:', err);
      setError('An unexpected error occurred. Please try again.');
      setHasActiveRoster(false);
      setSorInviteRemindersEnabled(false);
      setRosterModeState({ mode: 'none', hasShiftsOnlyRoster: false, hasFullMembershipRoster: false, memberCount: 0 });
      setResponseGroupsByPrimary({});
    } finally {
      setLoading(false);
    }
  }, [campId]);

  const fetchCustomFields = useCallback(async () => {
    if (!campId) return;
    try {
      const response = await api.getRosterCustomFields(campId);
      setCustomFields((response?.customFields || []) as any);
    } catch (err) {
      console.error('Failed to load custom fields:', err);
      setCustomFields([]);
    }
  }, [campId]);

  useEffect(() => {
    // Fetch camp data for:
    // 1. Camp accounts (accountType === 'camp')
    // 2. Admins with campId
    // 3. Camp Leads (isCampLead === true)
    // 4. Events Leads (isEventsLead === true)
    if (user?.accountType === 'camp' || user?.campId || user?.isCampLead || user?.isEventsLead) {
      fetchCampData();
    }
  }, [user?.accountType, user?.campId, user?.isCampLead, user?.campLeadCampId, user?.isEventsLead, user?.eventsLeadCampId]);

  useEffect(() => {
    if (campId) {
      fetchMembers();
    }
  }, [campId, fetchMembers]);

  useEffect(() => {
    if (campId) {
      fetchCustomFields();
    }
  }, [campId, fetchCustomFields]);

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

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    members.forEach((member) => (member.tags || []).forEach((tag) => tagSet.add(String(tag))));
    return [...tagSet];
  }, [members]);

  const customFieldFilterOptions = useMemo(
    () => customFields.map((field) => {
      const values = new Set<string>();
      members.forEach((member) => {
        const raw = (member.customFieldValues || {})[field.key];
        if (raw === undefined || raw === null || raw === '') return;
        values.add(String(raw));
      });
      return { key: field.key, label: field.label, values: [...values] };
    }),
    [customFields, members]
  );


  const handleFilterChange = (filters: FilterType[]) => {
    setActiveFilters(
      canViewDuesData
        ? filters
        : filters.filter((filter) => !DUES_FILTER_TYPES.has(filter))
    );
  };

  useEffect(() => {
    if (canViewDuesData) return;
    setActiveFilters((filters) => filters.filter((filter) => !DUES_FILTER_TYPES.has(filter)));
  }, [canViewDuesData]);


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
      const { data } = await api.delete(`/camps/${campId}/roster/member/${memberToDelete._id}`);
      
      // Update local state to remove the member
      setMembers(prev => prev.filter(m => m._id !== memberToDelete._id));
      
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
      
      alert(data?.message || 'Member removed from roster successfully.');
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
      setRosterId(null);
      await fetchMembers();
      alert('Roster archived successfully!');
    } catch (error) {
      console.error('Error archiving roster:', error);
      alert('Failed to archive roster');
    } finally {
      setArchiveLoading(false);
    }
  };

  // Create roster record
  const createRosterRecord = useCallback(async (rosterType: 'shifts_only' | 'full_membership'): Promise<boolean> => {
    if (!campId || !canEdit) return false;
    
    try {
      setCreateLoading(true);
      await api.post(`/camps/${campId}/roster/create`, { rosterType });
      setHasActiveRoster(true);
      setSelectedRosterType(rosterType);
      await fetchMembers();
      return true;
    } catch (error) {
      console.error('Error creating roster:', error);
      alert((error as any)?.response?.data?.message || 'Failed to create new roster');
      return false;
    } finally {
      setCreateLoading(false);
    }
  }, [campId, canEdit, fetchMembers]);

  const handleOpenRosterSetupModal = () => {
    setRosterSetupType('shifts_only');
    setRosterSetupStep(1);
    setShowRosterSetupModal(true);
  };

  const handleCloseRosterSetupModal = () => {
    if (createLoading) return;
    setShowRosterSetupModal(false);
    setRosterSetupStep(1);
    setRosterSetupType(null);
    setSelectedRosterType(rosterSetupType);
    if (campId) {
      try {
        localStorage.setItem(`rosterType:${campId}`, rosterSetupType);
      } catch (_error) {
        // no-op for storage failures
      }
    }
  };

  const handleRosterSetupContinue = async () => {
    if (!rosterSetupType) return;
    if (rosterSetupStep === 1) {
      setRosterSetupStep(2);
      return;
    }
    if (rosterSetupType === 'shifts_only') {
      setShowRosterSetupModal(false);
      setRosterSetupStep(1);
      setRosterSetupType(null);
      setPendingRosterBootstrapType('shifts_only');
      setImportRosterModalOpen(true);
      return;
    }

    const created = await createRosterRecord('full_membership');
    if (!created) return;

    setShowRosterSetupModal(false);
    setRosterSetupStep(1);
    setRosterSetupType(null);

    if (canManageFullMembershipInvites) {
      setInviteModalOpen(true);
    } else {
      alert('Roster created. To send full-member invitations, enable applications in Camp Settings first.');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    if (!action || !canEdit) return;

    const runAction = async () => {
      if (action === 'start_sor') {
        setSelectedRosterType('shifts_only');
        if (campId) {
          try {
            localStorage.setItem(`rosterType:${campId}`, 'shifts_only');
          } catch (_error) {
            // no-op for storage failures
          }
        }
        if (!hasActiveRoster) {
          setPendingRosterBootstrapType('shifts_only');
        }
        setImportRosterModalOpen(true);
      } else if (action === 'add_sor') {
        setSelectedRosterType('shifts_only');
        setAddMemberModalOpen(true);
      } else if (action === 'invite_full') {
        if (hasShiftsOnlyRoster) {
          alert('Full-membership invites are unavailable while a shifts-only roster is active. Archive the current roster first.');
          navigate(location.pathname, { replace: true });
          return;
        }
        setSelectedRosterType('full_membership');
        if (campId) {
          try {
            localStorage.setItem(`rosterType:${campId}`, 'full_membership');
          } catch (_error) {
            // no-op for storage failures
          }
        }
        setInviteModalOpen(true);
      }
      navigate(location.pathname, { replace: true });
    };

    runAction();
  }, [location.search, location.pathname, canEdit, hasActiveRoster, hasShiftsOnlyRoster, navigate, campId]);

  const handleShiftsOnlyImportCompleted = useCallback(async (summary: { createdCount?: number }) => {
    await fetchMembers();
    if (pendingRosterBootstrapType !== 'shifts_only') return;

    const createdCount = Number(summary?.createdCount || 0);
    if (createdCount <= 0) {
      setPendingRosterBootstrapType(null);
      alert('No roster members were created from this import. Camp remains roster-less.');
      return;
    }

    alert('Shifts-only roster created successfully.');
    setPendingRosterBootstrapType(null);
  }, [fetchMembers, pendingRosterBootstrapType]);

  const handleDuesClick = (member: any) => {
    if (!canEdit || !canViewDuesData) return; // Only full roster managers can see or change dues

    console.log('[DuesActionsModal] dues icon click:', {
      memberId: member?._id,
      duesStatus: member?.duesStatus,
      normalizedDuesStatus: normalizeDuesStatus(member?.duesStatus),
      member
    });

    setDuesActionModal({
      isOpen: true,
      member,
      paymentKind: 'dues'
    });
  };

  const handleMealPlanClick = (member: any) => {
    if (!canManageMealPlan) return;

    console.log('[DuesActionsModal] meal plan icon click:', {
      memberId: member?._id,
      mealPlanStatus: member?.mealPlanStatus,
      normalizedMealPlanStatus: normalizeDuesStatus(member?.mealPlanStatus),
      member
    });

    setDuesActionModal({
      isOpen: true,
      member,
      paymentKind: 'mealPlan'
    });
  };

  const closeDuesActionModal = () => {
    setDuesActionModal({ isOpen: false, member: null, paymentKind: 'dues' });
  };

  const openEmailPreview = async (
    member: any,
    actionType: 'instructions' | 'receipt',
    nextStatus?: 'UNPAID' | 'INSTRUCTED' | 'PAID',
    paymentKind: PaymentKind = duesActionModal.paymentKind
  ) => {
    if (!rosterId) return;
    if (paymentKind === 'dues' && !canEdit) return;
    if (paymentKind === 'mealPlan' && !canManageMealPlan) return;

    try {
      const response = paymentKind === 'dues'
        ? await api.previewDuesEmail(rosterId, member._id.toString(), {
            actionType,
            targetStatus: nextStatus
          })
        : await api.previewMealPlanEmail(rosterId, member._id.toString(), {
            actionType,
            targetStatus: nextStatus
          });

      setEmailPreviewModal({
        isOpen: true,
        paymentKind,
        member,
        actionType,
        nextStatus,
        subject: response.preview?.subject || '',
        body: response.preview?.body || '',
        saveAsCampDefault: false,
        sending: false
      });
    } catch (error) {
      console.error('Failed to build email preview:', error);
      alert('Failed to load email preview.');
    }
  };

  const handleDuesStatusChange = async (
    member: any,
    nextStatus: 'UNPAID' | 'INSTRUCTED' | 'PAID',
    paymentKind: PaymentKind = duesActionModal.paymentKind
  ) => {
    if (!rosterId) return;
    if (paymentKind === 'dues' && !canEdit) return;
    if (paymentKind === 'mealPlan' && !canManageMealPlan) return;

    const setLoading = paymentKind === 'dues' ? setDuesLoading : setMealPlanLoading;
    setLoading(member._id.toString());
    try {
      if (paymentKind === 'dues') {
        await api.updateMemberDuesStatus(rosterId, member._id.toString(), { duesStatus: nextStatus });
      } else {
        await api.updateMemberMealPlanStatus(rosterId, member._id.toString(), { mealPlanStatus: nextStatus });
      }
      await fetchMembers();
      closeDuesActionModal();
    } catch (error: any) {
      console.error(`Failed to update ${PAYMENT_LABELS[paymentKind].errorNoun} status:`, error);
      alert(error?.response?.data?.message || `Failed to update ${PAYMENT_LABELS[paymentKind].errorNoun} status.`);
    } finally {
      setLoading(null);
    }
  };

  const handleSendPreviewEmail = async () => {
    if (!rosterId || !emailPreviewModal.member || !emailPreviewModal.actionType) return;
    if (emailPreviewModal.paymentKind === 'dues' && !canEdit) return;
    if (emailPreviewModal.paymentKind === 'mealPlan' && !canManageMealPlan) return;

    setEmailPreviewModal(prev => ({ ...prev, sending: true }));
    try {
      if (emailPreviewModal.nextStatus) {
        if (emailPreviewModal.paymentKind === 'dues') {
          await api.updateMemberDuesStatus(rosterId, emailPreviewModal.member._id.toString(), {
            duesStatus: emailPreviewModal.nextStatus,
            emailPreview: {
              subject: emailPreviewModal.subject,
              body: emailPreviewModal.body
            },
            saveAsCampDefault: emailPreviewModal.saveAsCampDefault
          });
        } else {
          await api.updateMemberMealPlanStatus(rosterId, emailPreviewModal.member._id.toString(), {
            mealPlanStatus: emailPreviewModal.nextStatus,
            emailPreview: {
              subject: emailPreviewModal.subject,
              body: emailPreviewModal.body
            },
            saveAsCampDefault: emailPreviewModal.saveAsCampDefault
          });
        }
      } else {
        if (emailPreviewModal.paymentKind === 'dues') {
          await api.sendDuesEmail(rosterId, emailPreviewModal.member._id.toString(), {
            actionType: emailPreviewModal.actionType,
            subject: emailPreviewModal.subject,
            body: emailPreviewModal.body,
            saveAsCampDefault: emailPreviewModal.saveAsCampDefault
          });
        } else {
          await api.sendMealPlanEmail(rosterId, emailPreviewModal.member._id.toString(), {
            actionType: emailPreviewModal.actionType,
            subject: emailPreviewModal.subject,
            body: emailPreviewModal.body,
            saveAsCampDefault: emailPreviewModal.saveAsCampDefault
          });
        }
      }

      await fetchMembers();
      setEmailPreviewModal(prev => ({ ...prev, isOpen: false, sending: false }));
      closeDuesActionModal();
    } catch (error: any) {
      console.error(`Failed to send ${PAYMENT_LABELS[emailPreviewModal.paymentKind].errorNoun} email:`, error);
      setEmailPreviewModal(prev => ({ ...prev, sending: false }));
      alert(error?.response?.data?.message || `Failed to send ${PAYMENT_LABELS[emailPreviewModal.paymentKind].errorNoun} email.`);
    }
  };

  const handleOpenMealPlanTemplates = async () => {
    if (!rosterId || !canManageMealPlan) return;

    try {
      setMealPlanTemplatesLoading(true);
      const response = await api.getMealPlanTemplates(rosterId);
      setMealPlanTemplatesForm({
        instructionsSubject: response?.templates?.instructions?.subject || '',
        instructionsBody: response?.templates?.instructions?.body || '',
        receiptSubject: response?.templates?.receipt?.subject || '',
        receiptBody: response?.templates?.receipt?.body || ''
      });
      setMealPlanTemplatesModalOpen(true);
    } catch (error: any) {
      console.error('Failed to load meal-plan templates:', error);
      alert(error?.response?.data?.message || 'Failed to load meal-plan email templates.');
    } finally {
      setMealPlanTemplatesLoading(false);
    }
  };

  const handleSaveMealPlanTemplates = async () => {
    if (!rosterId || !canManageMealPlan) return;

    try {
      setMealPlanTemplatesLoading(true);
      await api.updateMealPlanTemplates(rosterId, {
        instructions: {
          subject: mealPlanTemplatesForm.instructionsSubject,
          body: mealPlanTemplatesForm.instructionsBody
        },
        receipt: {
          subject: mealPlanTemplatesForm.receiptSubject,
          body: mealPlanTemplatesForm.receiptBody
        }
      });
      setMealPlanTemplatesModalOpen(false);
    } catch (error: any) {
      console.error('Failed to save meal-plan templates:', error);
      alert(error?.response?.data?.message || 'Failed to save meal-plan email templates.');
    } finally {
      setMealPlanTemplatesLoading(false);
    }
  };

  // Delegated camp role management handlers
  const handleCampLeadToggle = (
    member: RosterMember,
    currentStatus: boolean,
    role: DelegatedCampRole = 'campLead'
  ) => {
    const isGrant = !currentStatus;
    const replaceExistingRole = isGrant && (
      (role === 'campLead' && member.isEventsLead === true) ||
      (role === 'eventsLead' && member.isCampLead === true)
    );

    setCampLeadConfirmModal({
      isOpen: true,
      member,
      action: isGrant ? 'grant' : 'revoke',
      role,
      replaceExistingRole
    });
  };

  const handleEventsLeadToggle = (member: RosterMember, currentStatus: boolean) => {
    handleCampLeadToggle(member, currentStatus, 'eventsLead');
  };

  const handleConfirmCampLeadChange = async () => {
    const { member, action, role, replaceExistingRole } = campLeadConfirmModal;
    if (!member || !canAssignDelegatedRoles) return;

    try {
      setCampLeadLoading(member._id.toString());

      if (role === 'eventsLead') {
        if (action === 'grant') {
          await api.grantEventsLeadRole(member._id.toString(), campId || undefined, { replaceExistingRole });
        } else {
          await api.revokeEventsLeadRole(member._id.toString(), campId || undefined);
        }
      } else {
        if (action === 'grant') {
          await api.grantCampLeadRole(member._id.toString(), { replaceExistingRole });
        } else {
          await api.revokeCampLeadRole(member._id.toString());
        }
      }

      // Update local state immediately
      setMembers(prevMembers =>
        prevMembers.map(m =>
          m._id === member._id
            ? {
                ...m,
                ...(role === 'eventsLead'
                  ? {
                      isEventsLead: action === 'grant',
                      ...(action === 'grant' && replaceExistingRole ? { isCampLead: false } : {})
                    }
                  : {
                      isCampLead: action === 'grant',
                      ...(action === 'grant' && replaceExistingRole ? { isEventsLead: false } : {})
                    })
              }
            : m
        )
      );

      // Get member name for success message
      const memberData = member.member || member;
      const user = typeof memberData.user === 'object' ? memberData.user : null;
      const memberName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Member';

      const roleName = role === 'eventsLead' ? 'Events Lead' : 'Camp Lead';
      alert(`${action === 'grant' ? 'Granted' : 'Revoked'} ${roleName} role ${action === 'grant' ? 'to' : 'from'} ${memberName}`);

      // Close modal
      setCampLeadConfirmModal({
        isOpen: false,
        member: null,
        action: 'grant',
        role: 'campLead',
        replaceExistingRole: false
      });
    } catch (error: any) {
      const roleName = role === 'eventsLead' ? 'Events Lead' : 'Camp Lead';
      console.error(`❌ Error updating ${roleName} role:`, error);
      alert(error.response?.data?.message || `Failed to ${action} ${roleName} role`);
    } finally {
      setCampLeadLoading(null);
    }
  };

  const handleCloseCampLeadModal = () => {
    if (!campLeadLoading) {
      setCampLeadConfirmModal({
        isOpen: false,
        member: null,
        action: 'grant',
        role: 'campLead',
        replaceExistingRole: false
      });
    }
  };

  // Roster rename handlers
  const handleOpenRenameModal = () => {
    if (!canEdit) return;
    setNewRosterName(rosterName);
    setRenameModalOpen(true);
  };

  const handleCloseRenameModal = () => {
    setRenameModalOpen(false);
    setNewRosterName('');
  };

  const handleSaveRosterName = async () => {
    if (!canEdit) return;
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
    if (!canEdit) return;
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

  const handleCopyCampInvitationUrl = async () => {
    if (!canEdit) return;
    if (!campInvitationUrl) {
      alert('Camp application URL is not available yet. Please try again after the camp profile finishes loading.');
      return;
    }

    if (!campPubliclyVisible || !campAcceptingApplications) {
      alert('Make the camp profile public and turn on applications before sharing this application URL.');
      return;
    }

    try {
      await copyTextToClipboard(campInvitationUrl);
      setCampInvitationLinkCopied(true);
      window.setTimeout(() => setCampInvitationLinkCopied(false), 2500);
    } catch (error) {
      console.error('❌ Error copying camp application URL:', error);
      alert('Failed to copy the application URL. Please try again.');
    }
  };

  // Collect emails for every roster member whose dues are marked as PAID,
  // dedupe (case-insensitive), and copy them to the clipboard. FMR-only:
  // shifts-only rosters do not track dues. The button that calls this
  // handler is gated on `isFullMembershipRoster`, but we re-check here as
  // a defense-in-depth guard.
  const handleCopyPaidMembersEmails = async () => {
    if (!canViewDuesData) return;
    if (!isFullMembershipRoster) {
      alert('Copying paid members\u2019 emails is only available for full-membership rosters.');
      return;
    }

    const seen = new Set<string>();
    const emails: string[] = [];
    members.forEach((member) => {
      if (!member?.duesPaid) return;
      const userObj = typeof member.user === 'object' && member.user !== null
        ? (member.user as { email?: string })
        : null;
      const rawEmail = (userObj?.email || '').trim();
      if (!rawEmail) return;
      const dedupeKey = rawEmail.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      emails.push(rawEmail);
    });

    if (emails.length === 0) {
      alert('No dues-paid members with email addresses found on this roster.');
      return;
    }

    const joined = emails.join(', ');
    try {
      await copyTextToClipboard(joined);
      alert(`Copied ${emails.length} dues-paid member email${emails.length === 1 ? '' : 's'} to clipboard.`);
    } catch (error) {
      console.error('❌ Error copying paid member emails:', error);
      alert('Failed to copy emails to clipboard. Please try again.');
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
    const effectiveActiveFilters = canViewDuesData
      ? activeFilters
      : activeFilters.filter((filter) => !DUES_FILTER_TYPES.has(filter));

    if (effectiveActiveFilters.length === 0) {
      return members;
    }

    const selectedFoodPreferences = effectiveActiveFilters
      .filter((filter) => String(filter).startsWith('food:'))
      .map((filter) => String(filter).replace('food:', ''));

    return members.filter(member => {
      const user = typeof member.user === 'object' ? member.user : null;
      const duesStatus = normalizeDuesStatus(member.duesStatus);
      const mealPlanStatus = normalizeDuesStatus(member.mealPlanStatus);
      const foodPreferences = normalizeFoodPreferences(
        (member as any).overrides?.foodPreferences !== undefined
          ? (member as any).overrides.foodPreferences
          : user?.foodPreferences
      );
      if (
        selectedFoodPreferences.length > 0 &&
        !selectedFoodPreferences.some((preference) => foodPreferences.includes(preference as any))
      ) {
        return false;
      }
      
      // Check each active filter
      for (const filter of effectiveActiveFilters) {
        switch (filter) {
          case 'dues-paid':
            if (duesStatus !== 'PAID') return false;
            break;
          case 'dues-unpaid':
            if (duesStatus !== 'UNPAID') return false;
            break;
          case 'dues-instructed':
            if (duesStatus !== 'INSTRUCTED') return false;
            break;
          case 'meal-plan-paid':
            if (mealPlanStatus !== 'PAID') return false;
            break;
          case 'meal-plan-unpaid':
            if (mealPlanStatus !== 'UNPAID') return false;
            break;
          case 'meal-plan-instructed':
            if (mealPlanStatus !== 'INSTRUCTED') return false;
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
            if (filter.startsWith('status:')) {
              const targetStatus = filter.replace('status:', '');
              const memberStatus = (member.status || member.rosterStatus || '').toString();
              if (memberStatus !== targetStatus) return false;
              break;
            }
            if (filter.startsWith('tag:')) {
              const targetTag = filter.replace('tag:', '');
              if (!(member.tags || []).includes(targetTag)) return false;
              break;
            }
            if (filter.startsWith('food:')) {
              break;
            }
            if (filter.startsWith('cf:')) {
              const [, key, value] = filter.split(':');
              const fieldValue = (member.customFieldValues || {})[key];
              if (String(fieldValue) !== value) return false;
              break;
            }
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
  }, [members, activeFilters, canViewDuesData]);

  // Early return for unauthorized access - STRICT enforcement
  if (!canAccessRoster) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-h1 font-lato-bold text-custom-text mb-4">
            Access Restricted
          </h1>
          <p className="text-body text-custom-text-secondary mb-4">
            Roster access is restricted to Camp Admins, Camp Leads, and Events Leads only.
          </p>
          <p className="text-body text-custom-text-secondary">
            Events Leads can view the roster and manage meal-plan payment, food preferences, and meal-plan communications.
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
          {canEdit && !hasActiveRoster && (
            <Button
              variant="primary"
              onClick={handleOpenRosterSetupModal}
              disabled={createLoading}
              className="flex items-center gap-2"
            >
              <Plus className={`w-4 h-4 ${createLoading ? 'animate-pulse' : ''}`} />
              Create New Roster
            </Button>
          )}

          {canEdit && hasActiveRoster && activeRosterType === 'shifts_only' && !isFullMembershipRoster && (
            <div className="flex flex-col">
              <Button
                variant="outline"
                onClick={() => setImportRosterModalOpen(true)}
                className="flex items-center gap-2 text-purple-600 border-purple-600 hover:bg-purple-50"
                title="Upload CSV to create shifts-only roster entries. No invitations are sent."
              >
                <Upload className="w-4 h-4" />
                Import CSV (Shifts-Only)
              </Button>
              <p className="text-[11px] text-gray-500 mt-1">Creates roster records only. No invites sent.</p>
            </div>
          )}

          {canEdit && hasActiveRoster && isFullMembershipRoster && !hasShiftsOnlyRoster && (
            <div className="flex flex-col">
              <Button
                variant="outline"
                onClick={() => setInviteModalOpen(true)}
                disabled={!canManageFullMembershipInvites}
                className="flex items-center gap-2 text-blue-600 border-blue-600 hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-300 disabled:hover:bg-white"
                title={canManageFullMembershipInvites
                  ? 'Upload/paste recipients and send full-membership invitations.'
                  : 'Enable applications on your camp profile to send full-membership invites.'}
              >
                <Mail className="w-4 h-4" />
                Invite Members (Full Membership)
              </Button>
              <p className="text-[11px] text-gray-500 mt-1">
                {canManageFullMembershipInvites
                  ? 'Sends invitation emails for full membership applications.'
                  : 'Full-member invites are unavailable while applications are off.'}
              </p>
            </div>
          )}

          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCampInvitationUrl}
              disabled={!campInvitationUrl}
              className="flex items-center gap-2 text-indigo-600 border-indigo-600 hover:bg-indigo-50 disabled:text-gray-400 disabled:border-gray-300 disabled:hover:bg-white"
              title={
                !campInvitationUrl
                  ? 'Camp application URL is loading.'
                  : !campPubliclyVisible || !campAcceptingApplications
                    ? 'Make the camp profile public and turn on applications before sharing this URL.'
                    : 'Copy a direct camp application URL for prospective members.'
              }
            >
              {campInvitationLinkCopied ? <CheckCircle className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
              {campInvitationLinkCopied ? 'Copied' : 'Copy Application URL'}
            </Button>
          )}

          {/* Export Roster button - Only available when an active roster exists */}
          {canEdit && rosterId && hasActiveRoster && (
            <Button
              variant="outline"
              onClick={handleExportRoster}
              className="flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50"
              title="Download the current roster as a file."
            >
              <span className="text-lg">↓</span>
              Export Roster
            </Button>
          )}

          {/* Copy Paid Member Emails - FMR only.
              Shifts-only rosters do not track dues, so this action is
              only meaningful on full-membership rosters. */}
          {canViewDuesData && rosterId && hasActiveRoster && isFullMembershipRoster && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPaidMembersEmails}
              className="flex items-center gap-2 text-blue-600 border-blue-600 hover:bg-blue-50"
              title="Copy comma-separated emails of all dues-paid members to your clipboard."
            >
              <Mail className="w-4 h-4" />
              Copy Paid Emails
            </Button>
          )}

          {canManageMealPlan && rosterId && hasActiveRoster && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenMealPlanTemplates}
              disabled={mealPlanTemplatesLoading}
              className="flex items-center gap-2 text-teal-700 border-teal-700 hover:bg-teal-50 disabled:text-gray-400 disabled:border-gray-300 disabled:hover:bg-white"
              title="Edit the default meal-plan payment instruction and receipt emails."
            >
              <Mail className={`w-4 h-4 ${mealPlanTemplatesLoading ? 'animate-pulse' : ''}`} />
              Meal Emails
            </Button>
          )}

          {canEdit && hasActiveRoster && activeRosterType !== 'none' && (
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setCustomFieldsModalOpen(true)}
              title="Configure up to 5 custom fields used across this roster."
            >
              Custom Fields
            </Button>
          )}

          {/* Archive button - Only for admins/leads */}
          {canEdit && hasActiveRoster && (
            <Button
              variant="outline"
              onClick={handleArchiveRoster}
              disabled={archiveLoading}
              className="flex items-center gap-2 text-orange-600 border-orange-600 hover:bg-orange-50"
              title="Archive the current roster and move it to historical records."
            >
              <Users className={`w-4 h-4 ${archiveLoading ? 'animate-pulse' : ''}`} />
              Archive Roster
            </Button>
          )}

          {showAddMemberTile && canEdit && rosterId && !isFullMembershipRoster && (
            <Button
              variant="primary"
              className="flex items-center gap-2"
              onClick={() => setAddMemberModalOpen(true)}
            >
              <User className="w-4 h-4" />
              Add Member
            </Button>
          )}
        </div>
      </div>

      {!hasActiveRoster && canEdit && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4" role="status" aria-live="polite">
          <h2 className="text-lg font-semibold text-custom-text">No roster yet</h2>
          <p className="text-sm text-custom-text-secondary mt-1">
            To start adding people to this camp, you&apos;ll need to create a roster first. Click
            <span className="font-semibold"> Create New Roster</span> to get started.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Metrics Panel - Legacy pre-SOR full-membership camps */}
      {canViewFullMembershipMetrics && (
        <MetricsPanel
          members={filteredMembers}
          showDuesPaid={canViewDuesData}
        />
      )}

      {canViewShiftsOnlyMetrics && (
        <ShiftsOnlyMetricsPanel
          members={filteredMembers}
          showRoleMetrics={!limitDelegatedRoleVisibilityToSelf}
        />
      )}

      {/* Filters - Only for admins/leads */}
      {canUseFilters && (
        <RosterFilters 
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          availableSkills={availableSkills}
          availableTags={availableTags}
          customFieldOptions={customFieldFilterOptions}
          showDuesFilters={canViewDuesData}
        />
      )}

      {/* Members List */}
      <Card>
        {showRosterTopScrollbar && (
          <div className="sticky top-16 z-20 mb-2 bg-white border-b border-gray-100 px-1 py-1">
            <input
              type="range"
              min={0}
              max={rosterMaxScrollLeft}
              value={Math.min(rosterScrollLeft, rosterMaxScrollLeft)}
              onChange={(e) => {
                const next = Number(e.target.value);
                setRosterScrollLeft(next);
                if (rosterTableScrollRef.current) {
                  rosterTableScrollRef.current.scrollLeft = next;
                }
              }}
              className="w-full h-2 cursor-ew-resize accent-gray-500"
              aria-label="Horizontal scroll for roster table"
            />
          </div>
        )}
        {activeRosterType === 'shifts_only' ? (
          <ShiftsOnlyRosterTable
            rosterId={rosterId}
            campId={campId}
            members={filteredMembers.map((member) => {
              const memberId = member?._id?.toString?.() || String(member?._id || '');
              const group = responseGroupsByPrimary[memberId];
              return {
                ...(member as any),
                responseGroupExtraCount: group?.extraCount || 0,
                responseGroupOtherNames: group?.otherNames || []
              };
            }) as any}
            canEdit={canEdit}
            canAssignCampLead={canAssignDelegatedRoles}
            canAssignEventsLead={canAssignDelegatedRoles}
            canOpenContactDetails={canUseContactDetails}
            canSendReminders={canEdit}
            currentUserId={authUserId}
            limitRoleBadgesToCurrentUser={limitDelegatedRoleVisibilityToSelf}
            onDelete={(m) => handleDeleteMember(m as any)}
            onRefresh={fetchMembers}
            inviteRemindersEnabled={sorInviteRemindersEnabled}
          />
        ) : (
        <div ref={rosterTableScrollRef} className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="sticky left-0 z-20 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)] min-w-[16rem]">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Playa Name
                </th>
                {canViewDuesData && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dues
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meal Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Food Prefs
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
                {canAssignDelegatedRoles && (
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Camp Lead
                  </th>
                )}
                {canAssignDelegatedRoles && (
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Events Lead
                  </th>
                )}
                {canViewRosterActions && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.map((member, index) => {
                // memberData is the raw populated Member document (from Mongoose).
                // member.user is the NORMALIZED user: real User doc when present,
                // or a fallbackUser built from memberData.name/email for SOR members.
                const memberData = member.member || member;
                const user = (member as any).user || (typeof memberData.user === 'object' ? memberData.user : null);
                // realUserId: only set when an actual User account is linked (FMR/invited).
                const realUserId = (memberData.user as any)?._id ?? null;
                const linkedUserId = toIdString(
                  (memberData.user as any)?._id ??
                    (typeof memberData.user === 'string' ? memberData.user : null) ??
                    user?._id
                );
                const csvName = (memberData as any).name || '';
                const derivedName = user
                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                  : '';
                const userName = derivedName || csvName || 'Unknown';
                const userPhoto = user?.profilePhoto;
                const isEditing = editingMemberId === member._id.toString();
                const canEditMemberDetails = isEditing && canEdit;
                const memberId = member._id.toString();
                const canViewDelegatedRoleBadges =
                  !limitDelegatedRoleVisibilityToSelf || (!!authUserId && linkedUserId === authUserId);
                const isFoodPreferenceCellEditing = editingFoodPreferencesMemberId === memberId;
                const canEditFoodPreferenceCell = canEditFoodPreferences && (isEditing || isFoodPreferenceCellEditing);
                const isSavingFoodPreferences = foodPreferenceSavingId === memberId;
                const editedFoodPreferences = localEdits[memberId]?.foodPreferences;
                const effectiveFoodPreferences = normalizeFoodPreferences(
                  editedFoodPreferences !== undefined
                    ? editedFoodPreferences
                    : (member as any).overrides?.foodPreferences !== undefined
                    ? (member as any).overrides.foodPreferences
                    : user?.foodPreferences
                );
                const memberGroup = responseGroupsByPrimary[member._id.toString()];
                const extraResponses = memberGroup?.extraCount || 0;
                const groupTooltip = memberGroup?.otherNames?.length
                  ? `Also submitted for: ${memberGroup.otherNames.join(', ')}`
                  : 'Submitted as a grouped response';
                
                return (
                  <tr key={member._id} className={`group ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    {/* Row Number */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                      {index + 1}
                    </td>
                    {/* Member */}
                    <td className={`sticky left-0 z-10 px-6 py-4 whitespace-nowrap shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)] min-w-[16rem] ${isEditing ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`}>
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
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">
                              {canUseContactDetails && campId && realUserId ? (
                                // FMR / linked-account member → full Contact 360 view
                                <Link to={`/camp/${campId}/contacts/${realUserId}`} className="text-black hover:underline">
                                  {userName}
                                </Link>
                              ) : canUseContactDetails && campId && member._id ? (
                                // SOR member (no user account yet) → member-based 360 view
                                <Link to={`/camp/${campId}/contacts/member/${member._id}`} className="text-black hover:underline">
                                  {userName}
                                </Link>
                              ) : (
                                <>{userName}</>
                              )}
                            </div>
                            {canViewDelegatedRoleBadges && member.isCampLead && <CampLeadBadge size="sm" />}
                            {canViewDelegatedRoleBadges && member.isEventsLead && (
                              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5 font-medium">
                                Events
                              </span>
                            )}
                            {extraResponses > 0 && (
                              <span
                                className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-xs px-2 py-0.5"
                                title={groupTooltip}
                                aria-label={groupTooltip}
                              >
                                +{extraResponses}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Playa Name */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {canEditMemberDetails ? (
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
                    {canViewDuesData && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(() => {
                          const duesStatus = normalizeDuesStatus(member.duesStatus);
                          const duesColorClass = duesStatus === 'PAID'
                            ? 'text-green-600 font-bold'
                            : duesStatus === 'INSTRUCTED'
                              ? 'text-orange-500 font-bold'
                              : 'text-gray-400';
                          const tooltipDetails = duesStatus === 'PAID'
                            ? `Paid on: ${member.duesPaidAt ? formatDate(member.duesPaidAt as string) : 'N/A'}\nReceipt sent: ${member.duesReceiptSentAt ? formatDate(member.duesReceiptSentAt as string) : 'N/A'}`
                            : duesStatus === 'INSTRUCTED'
                              ? 'Payment instructions sent'
                              : 'Unpaid';
                          return (
                        <button
                          onClick={() => handleDuesClick(member)}
                          disabled={!canEdit || duesLoading === member._id.toString()}
                          className={`text-xl ${canEdit ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} ${
                            duesColorClass
                          }`}
                          title={tooltipDetails}
                        >
                          {duesLoading === member._id.toString() ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                          ) : (
                            '$'
                          )}
                        </button>
                          );
                        })()}
                      </td>
                    )}
                    {/* Meal Plan */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => {
                        const mealPlanStatus = normalizeDuesStatus(member.mealPlanStatus);
                        const mealPlanColorClass = mealPlanStatus === 'PAID'
                          ? 'text-green-600 font-bold'
                          : mealPlanStatus === 'INSTRUCTED'
                            ? 'text-orange-500 font-bold'
                            : 'text-gray-400';
                        const tooltipDetails = mealPlanStatus === 'PAID'
                          ? `Paid on: ${member.mealPlanPaidAt ? formatDate(member.mealPlanPaidAt as string) : 'N/A'}\nReceipt sent: ${member.mealPlanReceiptSentAt ? formatDate(member.mealPlanReceiptSentAt as string) : 'N/A'}`
                          : mealPlanStatus === 'INSTRUCTED'
                            ? 'Meal plan payment instructions sent'
                            : 'Meal plan unpaid';
                        return (
                      <button
                        onClick={() => handleMealPlanClick(member)}
                        disabled={!canManageMealPlan || mealPlanLoading === member._id.toString()}
                        className={`text-xl ${canManageMealPlan ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} ${
                          mealPlanColorClass
                        }`}
                        title={tooltipDetails}
                      >
                        {mealPlanLoading === member._id.toString() ? (
                          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                        ) : (
                          '$'
                        )}
                      </button>
                        );
                      })()}
                    </td>
                    {/* Food Preferences */}
                    <td
                      className={`px-6 py-4 text-sm text-gray-900 min-w-[12rem] ${canEditFoodPreferences ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                      onClick={() => {
                        if (!canEditFoodPreferenceCell && canEditFoodPreferences) {
                          handleStartFoodPreferencesEdit(memberId);
                        }
                      }}
                      title={canEditFoodPreferences ? 'Click to edit meal preferences' : undefined}
                    >
                      {canEditFoodPreferenceCell ? (
                        <div onClick={(event) => event.stopPropagation()}>
                          <FoodPreferenceMultiSelect
                            value={effectiveFoodPreferences}
                            onChange={(foodPreferences) => handleFieldChange(memberId, 'foodPreferences', foodPreferences)}
                            onClose={!isEditing ? () => handleCloseFoodPreferencesEdit(memberId) : undefined}
                            defaultOpen={!isEditing && isFoodPreferenceCellEditing}
                            buttonClassName="min-w-[10rem] py-1"
                          />
                        </div>
                      ) : isSavingFoodPreferences ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving
                        </div>
                      ) : (
                        <FoodPreferenceTags preferences={effectiveFoodPreferences} compact />
                      )}
                    </td>
                    {/* Ticket/VP */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {canEditMemberDetails ? (
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
                      {canEditMemberDetails ? (
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
                      {canEditMemberDetails ? (
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
                      {canEditMemberDetails ? (
                        <EditableLocation user={user} memberId={member._id.toString()} />
                      ) : (
                        (() => {
                          const overrideLocation = toStructuredLocationOrNull((member as any).overrides?.location);
                          const userLocation = toStructuredLocationOrNull(user?.location);
                          const city = overrideLocation?.city || (member as any).overrides?.city || userLocation?.city || user?.city;
                          const state = overrideLocation?.state || (member as any).overrides?.state || userLocation?.state;
                          const country = overrideLocation?.country || userLocation?.country;
                          const countryCode = overrideLocation?.countryCode || userLocation?.countryCode;

                          return formatRosterLocation({ city, state, country, countryCode });
                        })()
                      )}
                    </td>
                    {/* Burns */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {canEditMemberDetails ? (
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
                      {canEditMemberDetails ? (
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
                    {/* Camp Lead Role */}
                    {canAssignDelegatedRoles && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {canEditMemberDetails ? (
                          <div className="flex items-center justify-center">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={member.isCampLead || false}
                                onChange={(e) => {
                                  e.preventDefault();
                                  handleCampLeadToggle(member, member.isCampLead || false);
                                }}
                                disabled={
                                  campLeadLoading === member._id.toString() ||
                                  member.rosterStatus !== 'approved'
                                }
                                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded disabled:opacity-50"
                                title={
                                  member.rosterStatus !== 'approved'
                                    ? 'Member must be approved to become Camp Lead'
                                    : 'Grant or revoke Camp Lead role'
                                }
                              />
                              <span className="ml-2 text-xs text-gray-600">Camp Lead</span>
                            </label>
                          </div>
                        ) : (
                          <div className="text-center">
                            {member.isCampLead ? (
                              <span className="text-xs text-orange-600 font-medium">✓ Lead</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    {/* Events Lead Role */}
                    {canAssignDelegatedRoles && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {canEditMemberDetails ? (
                          <div className="flex items-center justify-center">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={member.isEventsLead || false}
                                onChange={(e) => {
                                  e.preventDefault();
                                  handleEventsLeadToggle(member, member.isEventsLead || false);
                                }}
                                disabled={
                                  campLeadLoading === member._id.toString() ||
                                  member.rosterStatus !== 'approved'
                                }
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                                title={
                                  member.rosterStatus !== 'approved'
                                    ? 'Member must be approved to become Events Lead'
                                    : 'Grant or revoke Events Lead role'
                                }
                              />
                              <span className="ml-2 text-xs text-gray-600">Events Lead</span>
                            </label>
                          </div>
                        ) : (
                          <div className="text-center">
                            {member.isEventsLead ? (
                              <span className="text-xs text-blue-600 font-medium">✓ Events</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    {canViewRosterActions && (
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
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Count indicator — hidden for SOR (the SOR component renders its own empty state). */}
        {activeRosterType !== 'shifts_only' && (
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
        )}
        {activeRosterType === 'shifts_only' && members.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing <strong>{filteredMembers.length}</strong> of <strong>{members.length}</strong> members
            </p>
          </div>
        )}

        {/* Empty states */}
        {members.length === 0 && !hasActiveRoster && (
          <div className="text-center py-12 bg-blue-50 rounded-lg border-2 border-blue-200">
            <Users className="w-16 h-16 mx-auto text-blue-500 mb-4" />
            <h3 className="text-h3 font-lato-bold text-custom-text mb-2">
              No roster yet
            </h3>
            <p className="text-body text-custom-text-secondary mb-4">
              To start adding people to this camp, you&apos;ll need to create a roster first.
            </p>
            {canEdit && (
              <Button
                variant="primary"
                onClick={handleOpenRosterSetupModal}
                disabled={createLoading}
                className="flex items-center gap-2 mx-auto"
              >
                {createLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create New Roster
                  </>
                )}
              </Button>
            )}
          </div>
        )}
        
        {members.length === 0 && hasActiveRoster && activeRosterType !== 'shifts_only' && (
          <div className="text-center py-12">
            <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
              Roster is Empty
            </h3>
            <p className="text-body text-custom-text-secondary mb-4">
              Your roster has been created but has no members yet.
            </p>
            <p className="text-sm text-custom-text-secondary">
              Add members by approving applications or sending invites.
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
                            {(() => {
                              const panelMemberData = (selectedMember as any)?.member || selectedMember;
                              const panelUser = (selectedMember as any)?.user || (typeof (panelMemberData as any)?.user === 'object' ? (panelMemberData as any)?.user : null);
                              const panelCsvName = (panelMemberData as any)?.name || '';
                              const panelDerivedName = panelUser
                                ? `${panelUser.firstName || ''} ${panelUser.lastName || ''}`.trim()
                                : '';
                              return panelDerivedName || panelCsvName || 'Unknown';
                            })()}
                      </h3>
                          {(user?.playaName || (selectedMember?.member as any)?.playaName) && (
                            <p className="text-body text-orange-600 font-medium">
                              "{user?.playaName || (selectedMember?.member as any)?.playaName}"
                            </p>
                          )}
                      <p className="text-body text-custom-text-secondary">
                            {user?.email || (selectedMember?.member as any)?.email || 'No email'}
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

                      {/* Ticket & VP */}
                  <div>
                    <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                      Ticket & VP
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

                      {canViewApplicationData && (
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
                      )}

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

                        {canViewApplicationData && selectedMember.reviewNotes && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Review Notes
                            </label>
                            <div className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg">
                              <p className="text-sm text-gray-700">{selectedMember.reviewNotes}</p>
                            </div>
                          </div>
                        )}

                        {canViewApplicationData && selectedMember.appliedAt && (
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
                  {isFullMembershipRoster ? (
                    <>
                      <li>Move their application to the undecided queue</li>
                      <li>Send them a friendly note that they can reach out when ready to commit</li>
                    </>
                  ) : (
                    <>
                      <li>Reset their application status</li>
                      <li>Release their shift assignments</li>
                    </>
                  )}
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
                          Has VP
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

      {/* Meal Plan Template Defaults Modal */}
      <Modal
        isOpen={mealPlanTemplatesModalOpen}
        onClose={() => !mealPlanTemplatesLoading && setMealPlanTemplatesModalOpen(false)}
        title="Meal Plan Email Template Defaults"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            These defaults are used for meal-plan payment instructions and receipts.
          </p>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
            <p className="font-semibold text-gray-800">Rich text + variables guide</p>
            <p>Formatting: <code># Heading</code>, <code>## Subheading</code>, <code>**bold**</code>, <code>*italic*</code>, and bullet lists with <code>- item</code>.</p>
            <p>Insert camp name: <code>{'{{camp_name}}'}</code></p>
            <p>Insert member first name: <code>{'{{member_name}}'}</code> or <code>{'{{first_name}}'}</code></p>
            <p>Insert today's date: <code>{'{{today_date}}'}</code></p>
            <p>Enter starts a new line; a blank line adds a small paragraph break.</p>
            <p className="text-gray-500">Other supported variables: <code>{'{{meal_plan_amount}}'}</code>, <code>{'{{due_date}}'}</code>, <code>{'{{payment_link}}'}</code>, <code>{'{{payment_date}}'}</code>.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions Subject</label>
            <Input
              value={mealPlanTemplatesForm.instructionsSubject}
              onChange={(e) => setMealPlanTemplatesForm(prev => ({ ...prev, instructionsSubject: e.target.value }))}
              placeholder="Meal Plan Payment Instructions for {{camp_name}}"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions Body</label>
            <textarea
              className="w-full min-h-[140px] border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={mealPlanTemplatesForm.instructionsBody}
              onChange={(e) => setMealPlanTemplatesForm(prev => ({ ...prev, instructionsBody: e.target.value }))}
            />
            <div className="mt-2 rounded-md border border-gray-200 p-3 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Live Preview</p>
              <div
                className="text-sm text-gray-700"
                dangerouslySetInnerHTML={{
                  __html: renderRichTextToHtml(mealPlanTemplatesForm.instructionsBody, {
                    camp_name: campPublicIdentifier || 'Your Camp',
                    member_name: 'Member',
                    first_name: 'Member',
                    today_date: new Date().toLocaleDateString('en-US'),
                    meal_plan_amount: 'USD 0',
                    due_date: new Date().toLocaleDateString('en-US'),
                    payment_link: window.location.origin,
                    payment_date: new Date().toLocaleDateString('en-US')
                  })
                }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Subject</label>
            <Input
              value={mealPlanTemplatesForm.receiptSubject}
              onChange={(e) => setMealPlanTemplatesForm(prev => ({ ...prev, receiptSubject: e.target.value }))}
              placeholder="Meal Plan Payment Received - {{camp_name}}"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Body</label>
            <textarea
              className="w-full min-h-[140px] border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={mealPlanTemplatesForm.receiptBody}
              onChange={(e) => setMealPlanTemplatesForm(prev => ({ ...prev, receiptBody: e.target.value }))}
            />
            <div className="mt-2 rounded-md border border-gray-200 p-3 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Live Preview</p>
              <div
                className="text-sm text-gray-700"
                dangerouslySetInnerHTML={{
                  __html: renderRichTextToHtml(mealPlanTemplatesForm.receiptBody, {
                    camp_name: campPublicIdentifier || 'Your Camp',
                    member_name: 'Member',
                    first_name: 'Member',
                    today_date: new Date().toLocaleDateString('en-US'),
                    meal_plan_amount: 'USD 0',
                    due_date: new Date().toLocaleDateString('en-US'),
                    payment_link: window.location.origin,
                    payment_date: new Date().toLocaleDateString('en-US')
                  })
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setMealPlanTemplatesModalOpen(false)}
              disabled={mealPlanTemplatesLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveMealPlanTemplates}
              disabled={mealPlanTemplatesLoading}
            >
              {mealPlanTemplatesLoading ? 'Saving...' : 'Save Defaults'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dues Action Modal */}
      <Modal
        isOpen={duesActionModal.isOpen}
        onClose={closeDuesActionModal}
        title={PAYMENT_LABELS[duesActionModal.paymentKind].actionTitle}
        size="sm"
      >
        <div className="space-y-3">
          {!duesActionModal.member && (
            <p className="text-sm text-gray-500">Loading member {PAYMENT_LABELS[duesActionModal.paymentKind].errorNoun} actions...</p>
          )}
          {duesActionModal.member && (() => {
            const duesStatus = normalizeDuesStatus(
              duesActionModal.paymentKind === 'dues'
                ? duesActionModal.member.duesStatus
                : duesActionModal.member.mealPlanStatus
            );
            const canManageActivePaymentKind = duesActionModal.paymentKind === 'dues'
              ? canEdit
              : canManageMealPlan;
            const canMarkUnpaid = canManageActivePaymentKind;
            return (
              <>
                {duesStatus === 'UNPAID' && (
                  <>
                    <Button variant="outline" onClick={() => openEmailPreview(duesActionModal.member, 'instructions', 'INSTRUCTED')} className="w-full">
                      Send Payment Instructions
                    </Button>
                    <Button variant="primary" onClick={() => openEmailPreview(duesActionModal.member, 'receipt', 'PAID')} className="w-full">
                      Mark as Paid
                    </Button>
                  </>
                )}
                {duesStatus === 'INSTRUCTED' && (
                  <>
                    <Button variant="outline" onClick={() => openEmailPreview(duesActionModal.member, 'instructions')} className="w-full">
                      Resend Instructions
                    </Button>
                    <Button variant="primary" onClick={() => openEmailPreview(duesActionModal.member, 'receipt', 'PAID')} className="w-full">
                      Mark as Paid
                    </Button>
                  </>
                )}
                {duesStatus === 'PAID' && (
                  <>
                    <Button variant="outline" onClick={() => openEmailPreview(duesActionModal.member, 'receipt')} className="w-full">
                      Resend Receipt
                    </Button>
                    {canMarkUnpaid && (
                      <Button variant="outline" onClick={() => handleDuesStatusChange(duesActionModal.member, 'UNPAID')} className="w-full">
                        Mark as Unpaid (Admin Correction)
                      </Button>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </div>
      </Modal>

      {/* Dues Email Preview Modal */}
      <Modal
        isOpen={emailPreviewModal.isOpen}
        onClose={() => !emailPreviewModal.sending && setEmailPreviewModal(prev => ({ ...prev, isOpen: false }))}
        title={`${PAYMENT_LABELS[emailPreviewModal.paymentKind].singular} Email Preview`}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Subject"
            value={emailPreviewModal.subject}
            onChange={(e) => setEmailPreviewModal(prev => ({ ...prev, subject: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
            <textarea
              className="w-full min-h-[220px] border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={emailPreviewModal.body}
              onChange={(e) => setEmailPreviewModal(prev => ({ ...prev, body: e.target.value }))}
            />
            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
              <p className="font-medium text-gray-700">Formatting help</p>
              <p>Titles: <code># Title</code>, <code>## Subtitle</code>, <code>### Section</code> or <code>Title:</code>, <code>Subtitle:</code>, <code>Section:</code></p>
              <p>Text styles: <code>**bold**</code>, <code>*italic*</code></p>
              <p>Bullets (one per line): <code>- item</code>, <code>* item</code>, or <code>• item</code></p>
              <p>Enter starts a new line; a blank line adds a small paragraph break.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={emailPreviewModal.saveAsCampDefault}
              onChange={(e) => setEmailPreviewModal(prev => ({ ...prev, saveAsCampDefault: e.target.checked }))}
            />
            Save as camp default
          </label>

          <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">Live Preview</p>
            <p className="font-semibold text-sm mb-2">{emailPreviewModal.subject}</p>
            <div
              className="text-sm text-gray-700"
              dangerouslySetInnerHTML={{ __html: renderRichTextToHtml(emailPreviewModal.body) }}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setEmailPreviewModal(prev => ({ ...prev, isOpen: false }))}
              disabled={emailPreviewModal.sending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSendPreviewEmail}
              disabled={emailPreviewModal.sending || !emailPreviewModal.subject.trim() || !emailPreviewModal.body.trim()}
            >
              {emailPreviewModal.sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Members Modal */}
      <InviteMembersModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        campId={campId || user?.campId?.toString() || user?._id?.toString() || ''}
      />

      {/* Import Roster Modal */}
      <ImportRosterModal
        isOpen={importRosterModalOpen}
        onClose={() => {
          setImportRosterModalOpen(false);
          if (pendingRosterBootstrapType === 'shifts_only') {
            setPendingRosterBootstrapType(null);
          }
        }}
        campId={campId || user?.campId?.toString() || user?._id?.toString() || ''}
        customFields={customFields}
        onImportCompleted={handleShiftsOnlyImportCompleted}
      />

      {/* Create Roster Setup Modal */}
      <Modal
        isOpen={showRosterSetupModal}
        onClose={handleCloseRosterSetupModal}
        title="Create New Roster"
      >
        <div className="space-y-4">
          <div className="text-xs text-gray-500">
            Step {rosterSetupStep} of 2
          </div>

          {rosterSetupStep === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Choose the roster type for this camp. You can add people after creation.
              </p>

              <button
                type="button"
                onClick={() => setRosterSetupType('shifts_only')}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  rosterSetupType === 'shifts_only'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-custom-text">Volunteer Shifts</p>
                <p className="text-sm text-gray-600 mt-1">
                  Your camp wants to use G8Road only for volunteer shifts sign up and management.
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Invitations to sign up for shifts will be sent ONLY when you trigger them from the Events section, not now (and you have total control of who you invite).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRosterSetupType('full_membership')}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  rosterSetupType === 'full_membership'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-custom-text">Full Membership Roster</p>
                <p className="text-sm text-gray-600 mt-1">
                  Your camp wants to use G8Road for everything:
                </p>
                <ul className="mt-1 ml-5 list-disc text-sm text-gray-600 space-y-1">
                  <li>accept and manage member applications, manage roster</li>
                  <li>send dues and meal plan payment instructions, reminders and receipts</li>
                  <li>volunteer shifts sign up and management</li>
                  <li>tasks</li>
                </ul>
                <p className="text-sm text-gray-600 mt-2">
                  Invitations to join your camp will be sent at the end of this process, and you'll be notified as they come in.
                </p>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                You selected <span className="font-semibold">{rosterSetupType === 'shifts_only' ? 'Shifts-Only Roster' : 'Full Membership Roster'}</span>.
              </p>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                {rosterSetupType === 'shifts_only' ? (
                  <>
                    Next: we will create the roster, then open CSV import for shifts-only members (no invites sent).
                  </>
                ) : (
                  <>
                    Next: we will create the roster, then open full-membership invite import.
                    {!canManageFullMembershipInvites && (
                      <p className="mt-2 text-amber-700">
                        Note: Applications are currently OFF. You can still create the roster, but invites will stay unavailable until applications are enabled.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={rosterSetupStep === 1 ? handleCloseRosterSetupModal : () => setRosterSetupStep(1)}
              disabled={createLoading}
            >
              {rosterSetupStep === 1 ? 'Cancel' : 'Back'}
            </Button>
            <Button
              variant="primary"
              onClick={handleRosterSetupContinue}
              disabled={createLoading || !rosterSetupType}
            >
              {createLoading
                ? 'Creating...'
                : rosterSetupStep === 1
                  ? 'Continue'
                  : 'Create and Continue'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Camp Lead Confirmation Modal */}
      <CampLeadConfirmModal
        isOpen={campLeadConfirmModal.isOpen}
        onClose={handleCloseCampLeadModal}
        onConfirm={handleConfirmCampLeadChange}
        memberName={(() => {
          const member = campLeadConfirmModal.member;
          if (!member) return '';
          const memberData = member.member || member;
          const user = typeof memberData.user === 'object' ? memberData.user : null;
          return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Member';
        })()}
        action={campLeadConfirmModal.action}
        role={campLeadConfirmModal.role}
        replaceExistingRole={campLeadConfirmModal.replaceExistingRole}
        loading={!!campLeadLoading}
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
          rosterId={rosterId}
          onMemberAdded={fetchMembers}
          customFields={customFields}
          rosterType={activeRosterType === 'shifts_only' ? 'shifts_only' : 'full_membership'}
        />
      )}

      <Modal
        isOpen={customFieldsModalOpen}
        onClose={() => !customFieldsSaving && setCustomFieldsModalOpen(false)}
        title="Roster Custom Fields"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Define up to 5 custom fields for this roster. Field keys should be unique and use letters, numbers, or underscores.
          </p>
          {customFields.length > 0 && (
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500">
              <span className="col-span-5">Label</span>
              <span className="col-span-3">Type</span>
              <span className="col-span-3">Key</span>
              <span className="col-span-1 text-center">Remove</span>
            </div>
          )}
          {customFields.map((field, index) => (
            <div key={field.key} className="grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={field.label}
                onChange={(e) => setCustomFields((prev) => prev.map((f, i) => i === index ? { ...f, label: e.target.value } : f))}
                className="col-span-5 border border-gray-300 rounded px-2 py-2 text-sm"
                placeholder="Display label"
              />
              <select
                className="col-span-3 border border-gray-300 rounded px-2 py-2 text-sm"
                value={field.type}
                onChange={(e) => setCustomFields((prev) => prev.map((f, i) => i === index ? { ...f, type: e.target.value as any } : f))}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="dropdown">Dropdown</option>
                <option value="checkbox">Checkbox</option>
              </select>
              <input
                type="text"
                value={field.key}
                onChange={(e) =>
                  setCustomFields((prev) =>
                    prev.map((f, i) =>
                      i === index
                        ? { ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }
                        : f
                    )
                  )
                }
                className="col-span-3 border border-gray-300 rounded px-2 py-2 text-sm"
                placeholder="field_key"
              />
              <button
                className="col-span-1 text-red-600 text-sm"
                onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== index))}
                title="Remove field"
              >
                ✕
              </button>
              {field.type === 'dropdown' && (
                <div className="col-span-12">
                  <Input
                    label="Dropdown options"
                    value={(field.options || []).join(', ')}
                    onChange={(e) =>
                      setCustomFields((prev) =>
                        prev.map((f, i) =>
                          i === index
                            ? { ...f, options: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) }
                            : f
                        )
                      )
                    }
                    placeholder="Dropdown options separated by commas"
                  />
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-between">
            <Button
              variant="outline"
              disabled={customFields.length >= 5}
              onClick={() =>
                setCustomFields((prev) => [
                  ...prev,
                  { key: `field_${prev.length + 1}`, label: `Field ${prev.length + 1}`, type: 'text', options: [] }
                ] as any)
              }
            >
              Add Field
            </Button>
            <Button
              variant="primary"
              disabled={customFieldsSaving}
              onClick={async () => {
                if (!campId) return;
                try {
                  setCustomFieldsSaving(true);
                  await api.updateRosterCustomFields(campId, customFields as any);
                  await fetchCustomFields();
                  setCustomFieldsModalOpen(false);
                } catch (err: any) {
                  alert(err?.response?.data?.message || 'Failed to save custom fields');
                } finally {
                  setCustomFieldsSaving(false);
                }
              }}
            >
              {customFieldsSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default MemberRoster;
