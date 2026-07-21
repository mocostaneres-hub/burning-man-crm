import { render, screen } from '@testing-library/react';
import api from '../../../services/api';
import MyTasksList from '../MyTasksList';

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    getMyPendingSurveys: jest.fn(),
    getMyShifts: jest.fn()
  }
}));

const mockedGet = api.get as jest.Mock;
const mockedGetMyPendingSurveys = api.getMyPendingSurveys as jest.Mock;
const mockedGetMyShifts = api.getMyShifts as jest.Mock;

describe('MyTasksList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyShifts.mockResolvedValue({ camps: [], availableShifts: [], signedUpShifts: [] });
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

  test('shows a pending shift signup as an open profile to-do', async () => {
    mockedGet.mockResolvedValue([]);
    mockedGetMyPendingSurveys.mockResolvedValue({ pendingSurveys: [], completedSurveys: [] });
    mockedGetMyShifts.mockResolvedValue({
      camps: [{ _id: 'camp-1', name: 'Mudskippers' }],
      availableShifts: [{
        shiftId: 'shift-1',
        eventId: 'event-1',
        eventName: 'Build Week',
        campId: 'camp-1',
        campName: 'Mudskippers',
        title: 'Kitchen Setup',
        date: '2026-08-20T16:00:00.000Z',
        startTime: '2026-08-20T16:00:00.000Z',
        endTime: '2026-08-20T18:00:00.000Z',
        maxSignUps: 4,
        signedUpCount: 1,
        remainingSpots: 3,
        isFull: false,
        memberIds: [],
        coworkers: []
      }],
      signedUpShifts: []
    });

    render(<MyTasksList />);

    expect(await screen.findByText('Kitchen Setup')).toBeTruthy();
    expect(screen.getByText('needs signup')).toBeTruthy();
  });
});
