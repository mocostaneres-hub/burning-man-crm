import React, { useState, useEffect } from 'react';
import { Card, Badge } from '../ui';
import { Clock, Edit } from 'lucide-react';
import apiService from '../../services/api';
import { formatDate } from '../../utils/dateFormatters';

interface HistoryEntry {
  _id: string;
  userId: number;
  editorId: number;
  editorName: string;
  changes: Record<string, { from: any; to: any }>;
  timestamp: string;
  action: string;
}

interface UserProfileHistoryProps {
  userId: number;
  isOpen: boolean;
  onClose: () => void;
}

const UserProfileHistory: React.FC<UserProfileHistoryProps> = ({ userId, isOpen, onClose }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && userId) {
      fetchHistory();
    }
  }, [isOpen, userId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.get(`/users/${userId}/history`);
      setHistory(response.history || []);
    } catch (err) {
      console.error('Error fetching user history:', err);
      setError('Failed to load user history');
    } finally {
      setLoading(false);
    }
  };

  const formatFieldName = (fieldName: string) => {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'Not set';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            User Profile History
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No edit history found for this user.</p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-4">
              {history.map((entry) => (
                <Card key={entry._id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Edit className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-gray-900">
                        {entry.editorName}
                      </span>
                      <Badge variant="info" size="sm">
                        {entry.action.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(entry.timestamp)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(entry.changes).map(([field, change]) => (
                      <div key={field} className="bg-gray-50 p-3 rounded-lg">
                        <div className="font-medium text-sm text-gray-700 mb-2">
                          {formatFieldName(field)}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">From:</span>
                            <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-800">
                              {formatValue(change.from)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">To:</span>
                            <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-green-800">
                              {formatValue(change.to)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileHistory;
