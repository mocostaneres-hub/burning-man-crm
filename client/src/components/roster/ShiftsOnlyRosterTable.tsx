import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Edit, Trash2, CheckCircle, Mail } from 'lucide-react';
import { Button } from '../ui';
import apiService from '../../services/api';

/**
 * Shifts-Only Roster (SOR) table.
 *
 * Rendered in place of the legacy FMR grid when `rosterMode === 'shifts_only'`.
 * Columns: [Select] # · Name · Email · Status · Shifts · Skills · Camp Lead · Actions
 *
 * Responsibilities:
 *   • Compute per-row Status (Active = has linked user account; Invited = none).
 *   • Enforce a 24-hour client-side cooldown display for the Remind button,
 *     based on `member.lastReminderAt` from the backend. Server independently
 *     enforces the same cooldown — client display is strictly advisory.
 *   • Support bulk selection and bulk-remind via the sticky action bar.
 *   • Camp Lead toggle is ONLY rendered for Active members (has user account),
 *     matching backend enforcement that requires a User doc to exist.
 *   • Delegates Edit / Delete / Camp-Lead-change / View-360 to parent-provided
 *     callbacks so this component stays stateless w.r.t. the wider page.
 */

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface SorMemberRow {
  /** The roster member entry _id (typically the Member document id). */
  _id: string;
  /** Populated Member subdoc from the roster response. */
  member: any;
  /** Normalised user object (real User doc if linked, else a fallback built from Member). */
  user: any;
  isCampLead?: boolean;
  rosterStatus?: string;
}

interface Props {
  rosterId: string | null;
  campId: string | null;
  members: SorMemberRow[];
  canEdit: boolean;
  canAssignCampLead: boolean;
  onEdit: (memberId: string) => void;
  onDelete: (member: SorMemberRow) => void;
  onToggleCampLead: (member: SorMemberRow, currentStatus: boolean) => void;
  campLeadLoadingId: string | null;
  /** Called after a successful single/bulk reminder to let the parent refresh roster data. */
  onReminderSent?: () => void;
}

function formatCooldownRemaining(lastReminderAt: string | Date | null | undefined): string | null {
  if (!lastReminderAt) return null;
  const last = new Date(lastReminderAt).getTime();
  const elapsed = Date.now() - last;
  if (elapsed >= COOLDOWN_MS) return null;
  const remainingMs = COOLDOWN_MS - elapsed;
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function deriveStatus(member: SorMemberRow): 'active' | 'invited' {
  const memberDoc = member.member || {};
  const hasUserAccount = !!(memberDoc.user && (memberDoc.user._id || typeof memberDoc.user === 'string'));
  return hasUserAccount ? 'active' : 'invited';
}

function memberDisplayName(member: SorMemberRow): string {
  const u = member.user || {};
  const memberDoc = member.member || {};
  const fromUser = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  if (fromUser) return fromUser;
  if (memberDoc.name) return memberDoc.name;
  return 'Unknown';
}

function memberEmail(member: SorMemberRow): string {
  return (member.user?.email || member.member?.email || '').trim();
}

function memberSkills(member: SorMemberRow): string[] {
  const u = member.user || {};
  const memberDoc = member.member || {};
  const userSkills = Array.isArray(u.skills) ? u.skills : [];
  const memberSkills = Array.isArray(memberDoc.skills) ? memberDoc.skills : [];
  // Prefer the richer of the two.
  return userSkills.length >= memberSkills.length ? userSkills : memberSkills;
}

function memberShiftCount(member: SorMemberRow): number {
  return Number(member.member?.shiftSignupCount || 0);
}

function memberLastReminderAt(member: SorMemberRow): string | null {
  return member.member?.lastReminderAt || null;
}

export const ShiftsOnlyRosterTable: React.FC<Props> = ({
  rosterId,
  campId,
  members,
  canEdit,
  canAssignCampLead,
  onEdit,
  onDelete,
  onToggleCampLead,
  campLeadLoadingId,
  onReminderSent
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reminderLoadingIds, setReminderLoadingIds] = useState<Set<string>>(new Set());
  const [bulkRemindLoading, setBulkRemindLoading] = useState(false);
  const [bulkResultBanner, setBulkResultBanner] = useState<string | null>(null);

  // Local overlay of lastReminderAt updates so the cooldown UI reflects a just-sent
  // reminder immediately (server will return the same value on the next refresh).
  const [localReminderOverrides, setLocalReminderOverrides] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    return members.map((m, index) => {
      const status = deriveStatus(m);
      const overriddenReminderAt = localReminderOverrides[m._id] || memberLastReminderAt(m);
      const cooldownText = formatCooldownRemaining(overriddenReminderAt);
      return {
        member: m,
        index,
        status,
        name: memberDisplayName(m),
        email: memberEmail(m),
        skills: memberSkills(m),
        shiftCount: memberShiftCount(m),
        lastReminderAt: overriddenReminderAt,
        cooldownText,
        canRemind: !cooldownText
      };
    });
  }, [members, localReminderOverrides]);

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.member._id));
  const anySelected = selectedIds.size > 0;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === rows.length) return new Set();
      return new Set(rows.map((r) => r.member._id));
    });
  }, [rows]);

  const toggleSelect = useCallback((memberId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }, []);

  const handleRemindOne = useCallback(
    async (memberId: string) => {
      if (!rosterId) return;
      setReminderLoadingIds((prev) => new Set(prev).add(memberId));
      try {
        const res = await apiService.remindRosterMember(rosterId, memberId);
        setLocalReminderOverrides((prev) => ({ ...prev, [memberId]: res.lastReminderAt }));
        onReminderSent?.();
      } catch (err: any) {
        const status = err?.response?.status;
        const nextAllowedAt = err?.response?.data?.nextAllowedAt;
        if (status === 429 && nextAllowedAt) {
          // Server-side cooldown hit — mirror into local state.
          setLocalReminderOverrides((prev) => ({
            ...prev,
            [memberId]: new Date(new Date(nextAllowedAt).getTime() - COOLDOWN_MS).toISOString()
          }));
        } else {
          alert(err?.response?.data?.message || 'Failed to send reminder');
        }
      } finally {
        setReminderLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(memberId);
          return next;
        });
      }
    },
    [rosterId, onReminderSent]
  );

  const handleBulkRemind = useCallback(async () => {
    if (!rosterId || selectedIds.size === 0) return;
    setBulkRemindLoading(true);
    setBulkResultBanner(null);
    try {
      const ids = Array.from(selectedIds);
      const res = await apiService.bulkRemindRosterMembers(rosterId, ids);
      const now = new Date().toISOString();
      const overrides: Record<string, string> = {};
      for (const r of res.results) {
        if (r.status === 'sent' && r.lastReminderAt) overrides[r.memberId] = r.lastReminderAt;
        if (r.status === 'cooldown' && r.nextAllowedAt) {
          overrides[r.memberId] = new Date(new Date(r.nextAllowedAt).getTime() - COOLDOWN_MS).toISOString();
        }
      }
      setLocalReminderOverrides((prev) => ({ ...prev, ...overrides, ...(Object.keys(overrides).length === 0 ? { _tick: now } : {}) }));
      setBulkResultBanner(res.message);
      setSelectedIds(new Set());
      onReminderSent?.();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send bulk reminders');
    } finally {
      setBulkRemindLoading(false);
    }
  }, [rosterId, selectedIds, onReminderSent]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Mail className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p>No members in this roster yet. Import a CSV or add members manually to get started.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Sticky action bar — appears when anything is selected */}
      {anySelected && (
        <div className="sticky top-0 z-10 bg-orange-50 border-b border-orange-200 px-4 py-3 mb-2 flex items-center justify-between">
          <div className="text-sm text-orange-900">
            <strong>{selectedIds.size}</strong> member{selectedIds.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkRemindLoading}
            >
              Clear
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex items-center gap-1"
              onClick={handleBulkRemind}
              disabled={bulkRemindLoading}
            >
              <Bell className="w-4 h-4" />
              {bulkRemindLoading ? 'Sending…' : `Remind ${selectedIds.size} selected`}
            </Button>
          </div>
        </div>
      )}

      {bulkResultBanner && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded mb-2 text-sm flex items-center justify-between">
          <span>
            <CheckCircle className="w-4 h-4 inline mr-2" />
            {bulkResultBanner}
          </span>
          <button
            className="text-green-700 hover:text-green-900 text-xs"
            onClick={() => setBulkResultBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  aria-label="Select all members"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shifts</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
              {canAssignCampLead && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Camp Lead
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row) => {
              const { member, index, status, name, email, skills, shiftCount, cooldownText } = row;
              const memberId = member._id;
              const realUserId = member.member?.user?._id || (typeof member.member?.user === 'string' ? member.member.user : null);
              const contact360Link = realUserId
                ? `/camp/${campId}/contacts/${realUserId}`
                : `/camp/${campId}/contacts/member/${memberId}`;
              const isReminderLoading = reminderLoadingIds.has(memberId);
              const isSelected = selectedIds.has(memberId);

              return (
                <tr key={memberId} className={isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(memberId)}
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      aria-label={`Select ${name}`}
                    />
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 font-medium">{index + 1}</td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {campId ? (
                      <Link to={contact360Link} className="text-orange-600 hover:text-orange-700 font-medium">
                        {name}
                      </Link>
                    ) : (
                      <span className="font-medium">{name}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">{email || '—'}</td>
                  <td className="px-4 py-4 text-sm">
                    {status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Invited
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {shiftCount > 0 ? (
                      <Link
                        to={`${contact360Link}#volunteer-shifts`}
                        className="text-orange-600 hover:text-orange-700 font-medium"
                      >
                        {shiftCount} signed up →
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {skills.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {skills.slice(0, 4).map((s: string, i: number) => (
                          <span
                            key={`${memberId}-skill-${i}`}
                            className="inline-block px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700"
                          >
                            {s}
                          </span>
                        ))}
                        {skills.length > 4 && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                            +{skills.length - 4}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {canAssignCampLead && (
                    <td className="px-4 py-4 text-center">
                      {status === 'active' ? (
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={member.isCampLead || false}
                            onChange={() => onToggleCampLead(member, member.isCampLead || false)}
                            disabled={campLeadLoadingId === memberId}
                            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                            title="Grant or revoke Camp Lead role"
                          />
                          {member.isCampLead && (
                            <span className="ml-2 text-xs text-orange-600 font-medium">✓ Lead</span>
                          )}
                        </label>
                      ) : (
                        <span
                          className="text-xs text-gray-400"
                          title="Camp Lead can only be assigned to Active members (those who have signed up)"
                        >
                          —
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-4 text-sm">
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => handleRemindOne(memberId)}
                        disabled={!row.canRemind || isReminderLoading}
                        title={
                          cooldownText
                            ? `Already reminded — next allowed in ${cooldownText}`
                            : status === 'active'
                              ? 'Send a reminder to sign up for shifts'
                              : 'Send a friendly reminder of the original invite'
                        }
                      >
                        <Bell className="w-3 h-3" />
                        {isReminderLoading
                          ? 'Sending…'
                          : cooldownText
                            ? `Remind (${cooldownText})`
                            : 'Remind'}
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                            onClick={() => onEdit(memberId)}
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                            onClick={() => onDelete(member)}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
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
    </div>
  );
};

export default ShiftsOnlyRosterTable;
