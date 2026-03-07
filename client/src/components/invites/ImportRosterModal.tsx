import React, { useMemo, useState } from 'react';
import { Modal, Button } from '../ui';
import { Upload, Loader2, X } from 'lucide-react';
import api from '../../services/api';

interface ImportRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  campId?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmailsFromCsv = (rawText: string): string[] => {
  const normalized = rawText.replace(/\r/g, '\n');
  const tokens = normalized
    .split(/[\n,;\t ]+/)
    .map((value) => value.replace(/^["']+|["']+$/g, '').trim().toLowerCase())
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (!seen.has(token)) {
      deduped.push(token);
      seen.add(token);
    }
  }

  return deduped;
};

const ImportRosterModal: React.FC<ImportRosterModalProps> = ({ isOpen, onClose, campId }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validEmails = useMemo(
    () => parsedEmails.filter((email) => EMAIL_REGEX.test(email)),
    [parsedEmails]
  );

  const resetState = () => {
    setSelectedFile(null);
    setParsedEmails([]);
    setInvalidEmails([]);
    setLoading(false);
    setError(null);
    setSuccess(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setError(null);
    setSuccess(null);

    if (!file) {
      setSelectedFile(null);
      setParsedEmails([]);
      setInvalidEmails([]);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file.');
      setSelectedFile(null);
      setParsedEmails([]);
      setInvalidEmails([]);
      return;
    }

    try {
      const content = await file.text();
      const allEmails = parseEmailsFromCsv(content);
      const invalid = allEmails.filter((email) => !EMAIL_REGEX.test(email));

      setSelectedFile(file);
      setParsedEmails(allEmails);
      setInvalidEmails(invalid);
    } catch (readError) {
      console.error('Error reading CSV file:', readError);
      setError('Could not read the CSV file. Please try again.');
      setSelectedFile(null);
      setParsedEmails([]);
      setInvalidEmails([]);
    }
  };

  const handleImport = async () => {
    if (!campId) {
      setError('Camp ID is required');
      return;
    }

    if (validEmails.length === 0) {
      setError('No valid email addresses were found in the CSV file.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await api.sendInvites({
        recipients: validEmails,
        method: 'email',
        campId
      });

      const summary = response?.summary || { sent: 0, failed: 0 };
      const invalidCount = invalidEmails.length;
      const duplicateOrSendFailures = summary.failed || 0;

      setSuccess(
        `Import complete: ${summary.sent} invites sent, ${invalidCount} invalid emails, ${duplicateOrSendFailures} skipped/failed.`
      );
    } catch (err: any) {
      console.error('Error importing roster CSV:', err);
      setError(err.response?.data?.message || 'Failed to import roster CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Upload className="w-6 h-6 text-blue-600" />
            Import Roster
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close import roster modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <label htmlFor="roster-csv-upload" className="block text-sm font-medium text-gray-700 mb-2">
              Upload CSV file
            </label>
            <input
              id="roster-csv-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white hover:file:bg-blue-700"
            />
            <p className="text-xs text-gray-500 mt-2">
              Include email addresses in one column or multiple columns. One email per cell works best.
            </p>
            <p className="text-sm text-gray-700 mt-3">
              Once you submit your file, each email address will receive an invitation to join your camp. You&apos;ll be notified of each application, and you can review them in your Applications section and move them to your roster.
            </p>
          </div>

          {selectedFile && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                <Upload className="w-4 h-4 text-gray-500" />
                {selectedFile.name}
              </div>
              <div className="text-sm text-gray-700">
                Parsed: <span className="font-semibold">{parsedEmails.length}</span> entries | Valid:{' '}
                <span className="font-semibold text-green-700">{validEmails.length}</span> | Invalid:{' '}
                <span className="font-semibold text-red-700">{invalidEmails.length}</span>
              </div>
              {invalidEmails.length > 0 && (
                <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 max-h-24 overflow-auto">
                  Invalid emails: {invalidEmails.slice(0, 20).join(', ')}
                  {invalidEmails.length > 20 ? ' ...' : ''}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-700 text-sm">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="text-green-700 text-sm">{success}</div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={loading || validEmails.length === 0}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Send Bulk Invites
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ImportRosterModal;
