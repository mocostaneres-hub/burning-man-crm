import React from 'react';
import { Modal, Button } from '../ui';

interface CampLeadConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  memberName: string;
  action: 'grant' | 'revoke';
  loading?: boolean;
}

const CampLeadConfirmModal: React.FC<CampLeadConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  memberName,
  action,
  loading = false
}) => {
  if (!isOpen) return null;

  const isGrant = action === 'grant';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isGrant ? 'Grant Camp Lead Access' : 'Revoke Camp Lead Access'}
    >
      <div className="space-y-4">
        {/* Main Message */}
        <div className="text-gray-700">
          {isGrant ? (
            <p className="text-base">
              Grant <strong>{memberName}</strong> Camp Lead permissions?
            </p>
          ) : (
            <p className="text-base">
              Revoke Camp Lead access from <strong>{memberName}</strong>?
            </p>
          )}
        </div>

        {/* Permissions Explanation */}
        {isGrant ? (
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
              They will lose admin permissions and revert to standard member access immediately.
            </p>
          </div>
        )}

        {/* Limitations Note (for grant only) */}
        {isGrant && (
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
            variant={isGrant ? 'primary' : 'danger'}
            disabled={loading}
            loading={loading}
          >
            {isGrant ? 'Grant Access' : 'Revoke Access'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CampLeadConfirmModal;
