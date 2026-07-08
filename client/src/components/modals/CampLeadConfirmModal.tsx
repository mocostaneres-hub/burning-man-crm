import React from 'react';
import { Modal, Button } from '../ui';

interface CampLeadConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  memberName: string;
  action: 'grant' | 'revoke';
  role?: 'campLead' | 'eventsLead';
  replaceExistingRole?: boolean;
  loading?: boolean;
}

const CampLeadConfirmModal: React.FC<CampLeadConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  memberName,
  action,
  role = 'campLead',
  replaceExistingRole = false,
  loading = false
}) => {
  if (!isOpen) return null;

  const isGrant = action === 'grant';
  const isEventsLead = role === 'eventsLead';
  const roleName = isEventsLead ? 'Events Lead' : 'Camp Lead';
  const existingRoleName = isEventsLead ? 'Camp Lead' : 'Events Lead';
  const isReplacingRole = isGrant && replaceExistingRole;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isReplacingRole
          ? `Replace ${existingRoleName} Access`
          : isGrant
            ? `Grant ${roleName} Access`
            : `Revoke ${roleName} Access`
      }
    >
      <div className="space-y-4">
        {/* Main Message */}
        <div className="text-gray-700">
          {isReplacingRole ? (
            <div className="space-y-2">
              <p className="text-base">
                <strong>{memberName}</strong> already has {existingRoleName} access.
              </p>
              <p className="text-base">
                A roster member can only have one lead role. Replace {existingRoleName} access with{' '}
                {roleName} access?
              </p>
            </div>
          ) : isGrant ? (
            <p className="text-base">
              Grant <strong>{memberName}</strong> {roleName} permissions?
            </p>
          ) : (
            <p className="text-base">
              Revoke {roleName} access from <strong>{memberName}</strong>?
            </p>
          )}
        </div>

        {/* Permissions Explanation */}
        {isReplacingRole ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">This will:</h4>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>Remove {existingRoleName} access immediately</li>
              <li>Grant {roleName} access immediately</li>
              <li>Send only the {roleName} granted email</li>
            </ul>
          </div>
        ) : isGrant && isEventsLead ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">This allows them to:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>View and update events, volunteer shifts, tasks, and surveys</li>
              <li>View the camp profile and member roster</li>
              <li>Keep their regular member-account features unchanged</li>
            </ul>
          </div>
        ) : isGrant ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">This allows them to:</h4>
            <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
              <li>View and edit roster member details</li>
              <li>Review and manage applications</li>
              <li>Update member dues status</li>
              <li>Manage events, shifts, and tasks</li>
              <li>Access all camp admin dashboards</li>
            </ul>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800">
              They will lose {roleName} permissions immediately. No revocation email is sent.
            </p>
          </div>
        )}

        {/* Limitations Note (for grant only) */}
        {isGrant && isEventsLead ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">But NOT:</h4>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Applications, dues details, or dues actions</li>
              <li>Roster export, archive, rename, or full-member invitations</li>
              <li>Camp profile editing or account settings</li>
            </ul>
          </div>
        ) : isGrant && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">But NOT:</h4>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Delete or archive rosters</li>
              <li>Assign or revoke Camp Lead roles</li>
              <li>Remove the Main Camp Admin</li>
              <li>Delete or transfer camp ownership</li>
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="primary"
            disabled={loading}
            loading={loading}
            className={isGrant ? '' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'}
          >
            {isReplacingRole
              ? `Replace with ${roleName}`
              : isGrant
                ? `Grant ${roleName}`
                : `Revoke ${roleName}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CampLeadConfirmModal;
