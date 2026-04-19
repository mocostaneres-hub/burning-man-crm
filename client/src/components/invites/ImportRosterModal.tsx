import React, { useState } from 'react';
import { Modal, Button } from '../ui';
import { Upload, Loader2, X } from 'lucide-react';
import api from '../../services/api';

interface ImportRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  campId?: string;
  customFields?: Array<{ key: string; label: string; type: string }>;
  onImportCompleted?: (summary: { createdCount?: number; skippedCount?: number; invalidCount?: number }) => void | Promise<void>;
}

const ImportRosterModal: React.FC<ImportRosterModalProps> = ({ isOpen, onClose, campId, customFields = [], onImportCompleted }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setPreview(null);
    setCsvColumns([]);
    setMapping({});
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
      setPreview(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file.');
      setSelectedFile(null);
      setPreview(null);
      return;
    }
    setSelectedFile(file);
    setPreview(null);
    try {
      const text = await file.text();
      const headerLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) || '';
      const columns = headerLine.split(',').map((c) => c.trim().replace(/^"|"$/g, '')).filter(Boolean);
      setCsvColumns(columns);
      const initialMapping: Record<string, string> = {};
      const matchColumn = (keys: string[]) =>
        columns.find((c) => keys.includes(c.toLowerCase().replace(/\s+/g, '_')));
      initialMapping.name = matchColumn(['name', 'full_name']) || '';
      initialMapping.email = matchColumn(['email', 'email_address']) || '';
      initialMapping.phone = matchColumn(['phone', 'phone_number']) || '';
      initialMapping.role = matchColumn(['role']) || '';
      initialMapping.tags = matchColumn(['tags']) || '';
      initialMapping.playa_name = matchColumn(['playa_name', 'playaname']) || '';
      customFields.forEach((field) => {
        const byKey = matchColumn([field.key.toLowerCase()]);
        const byLabel = matchColumn([field.label.toLowerCase().replace(/\s+/g, '_')]);
        initialMapping[`cf_${field.key}`] = byKey || byLabel || '';
      });
      setMapping(initialMapping);
    } catch (e) {
      setCsvColumns([]);
      setMapping({});
    }
  };

  const handlePreview = async () => {
    if (!campId) {
      setError('Camp ID is required');
      return;
    }
    if (!selectedFile) {
      setError('Please select a CSV file first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await api.importMembersCsv({
        file: selectedFile,
        campId,
        confirm: false,
        mapping
      });
      setPreview(response);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate CSV preview');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!campId || !selectedFile) {
      setError('Camp ID and file are required');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const response = await api.importMembersCsv({
        file: selectedFile,
        campId,
        confirm: true,
        mapping
      });
      setSuccess(
        `Import complete: ${response.createdCount || 0} created, ${response.skippedCount || 0} skipped, ${response.invalidCount || 0} invalid.`
      );
      if (onImportCompleted) {
        await onImportCompleted({
          createdCount: response.createdCount || 0,
          skippedCount: response.skippedCount || 0,
          invalidCount: response.invalidCount || 0
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to import CSV roster');
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
            Import CSV (Shifts-Only Roster)
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
              Required columns: <strong>name</strong>, <strong>email</strong>. Optional: phone, role, tags, playa_name.
            </p>
            <p className="text-sm text-gray-700 mt-3">
              CSV import creates roster-only members. Invites and account emails are only sent from the Events page invite flow.
            </p>
          </div>

          {selectedFile && csvColumns.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Column Mapping</h3>
              <p className="text-xs text-gray-600 mb-3">
                Map your CSV headers to roster fields. Name and Email are required for import.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: 'name', label: 'Name (required)' },
                  { key: 'email', label: 'Email (required)' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'role', label: 'Role' },
                  { key: 'tags', label: 'Tags' },
                  { key: 'playa_name', label: 'Playa Name' }
                ].map((field) => (
                  <label key={field.key} className="text-xs text-gray-700">
                    <span className="block mb-1">{field.label}</span>
                    <select
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    >
                      <option value="">-- Unmapped --</option>
                      {csvColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </label>
                ))}
                {customFields.map((field) => (
                  <label key={field.key} className="text-xs text-gray-700">
                    <span className="block mb-1">{field.label} (custom)</span>
                    <select
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      value={mapping[`cf_${field.key}`] || ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [`cf_${field.key}`]: e.target.value }))}
                    >
                      <option value="">-- Unmapped --</option>
                      {csvColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedFile && preview && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                <Upload className="w-4 h-4 text-gray-500" />
                {selectedFile.name}
              </div>
              <div className="text-sm text-gray-700">
                Parsed: <span className="font-semibold">{preview?.summary?.totalRows || 0}</span> rows | New members:{' '}
                <span className="font-semibold text-green-700">{preview?.summary?.toCreate || 0}</span> | Invalid:{' '}
                <span className="font-semibold text-red-700">{preview?.summary?.invalid || 0}</span> | Skipped:{' '}
                <span className="font-semibold text-orange-700">{preview?.summary?.skipped || 0}</span>
              </div>
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
            {!preview ? (
              <Button
                variant="primary"
                onClick={handlePreview}
                disabled={loading || !selectedFile}
                className="flex items-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <><Upload className="w-4 h-4" />Preview Import</>}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Importing...</> : <><Upload className="w-4 h-4" />Create Roster Members</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ImportRosterModal;
