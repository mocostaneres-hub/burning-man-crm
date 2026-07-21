import { render, screen } from '@testing-library/react';
import api from '../../../services/api';
import MyTasksList from '../MyTasksList';

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    getMyPendingSurveys: jest.fn()
  }
}));

const mockedGet = api.get as jest.Mock;
const mockedGetMyPendingSurveys = api.getMyPendingSurveys as jest.Mock;

describe('MyTasksList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows a pending survey as an open profile to-do', async () => {
    mockedGet.mockResolvedValue([]);
    mockedGetMyPendingSurveys.mockResolvedValue({
      pendingSurveys: [{
        surveyId: 'survey-1',
        title: 'Camp Logistics Survey',
        status: 'sent',
        campId: 'camp-1',
        campName: 'Mudskippers',
        assignedAt: '2026-07-20T12:00:00.000Z'
      }],
      completedSurveys: []
    });

    render(<MyTasksList />);

    expect(await screen.findByText('Camp Logistics Survey')).toBeTruthy();
    expect(screen.getByText('pending')).toBeTruthy();
    expect(screen.queryByText('No open to-dos assigned to you.')).toBeNull();
  });
});
