import { fireEvent, render, screen } from '@testing-library/react';
import api from '../../../services/api';
import MyTasks from '../MyTasks';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}), { virtual: true });

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    getMyPendingSurveys: jest.fn(),
    getMyShifts: jest.fn()
  }
}));

jest.mock('../../../contexts/AuthContext', () => {
  const user = { _id: 'user-1', accountType: 'personal' };
  return {
    useAuth: () => ({ user })
  };
});

const mockedGet = api.get as jest.Mock;
const mockedGetMyPendingSurveys = api.getMyPendingSurveys as jest.Mock;
const mockedGetMyShifts = api.getMyShifts as jest.Mock;

describe('MyTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue([]);
    mockedGetMyPendingSurveys.mockResolvedValue({ pendingSurveys: [], completedSurveys: [] });
  });

  test('shows one link to available shifts instead of listing every shift', async () => {
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

    render(<MyTasks />);

    expect(await screen.findByText('Pending Shift Signups')).toBeTruthy();
    expect(screen.getByText('There are shifts available to sign up for.')).toBeTruthy();
    expect(screen.queryByText('Kitchen Setup')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View Available Shifts' }));
    expect(mockNavigate).toHaveBeenCalledWith('/my-shifts');
  });

  test('puts a non-empty pending section before an empty pending section', async () => {
    mockedGetMyPendingSurveys.mockResolvedValue({
      pendingSurveys: [{
        surveyId: 'survey-1',
        title: 'Camp Logistics Survey',
        campName: 'Mudskippers',
        assignedAt: '2026-07-20T12:00:00.000Z'
      }],
      completedSurveys: []
    });
    mockedGetMyShifts.mockResolvedValue({ camps: [], availableShifts: [], signedUpShifts: [] });

    render(<MyTasks />);

    await screen.findByText('Camp Logistics Survey');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings.indexOf('Pending Surveys')).toBeLessThan(headings.indexOf('Pending Shift Signups'));
  });

  test('puts the pending section with the oldest assignment first', async () => {
    mockedGetMyPendingSurveys.mockResolvedValue({
      pendingSurveys: [{
        surveyId: 'survey-1',
        title: 'Older Survey',
        campName: 'Mudskippers',
        assignedAt: '2026-07-10T12:00:00.000Z'
      }],
      completedSurveys: []
    });
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
        assignedAt: '2026-07-20T12:00:00.000Z',
        maxSignUps: 4,
        signedUpCount: 1,
        remainingSpots: 3,
        isFull: false,
        memberIds: [],
        coworkers: []
      }],
      signedUpShifts: []
    });

    render(<MyTasks />);

    await screen.findByText('Older Survey');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings.indexOf('Pending Surveys')).toBeLessThan(headings.indexOf('Pending Shift Signups'));
  });
});
