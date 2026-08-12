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

    expect(await screen.findByText('Shift Signup')).toBeTruthy();
    expect(screen.getByText('You still need to choose a shift. Pick one that works for you.')).toBeTruthy();
    expect(screen.queryByText('Kitchen Setup')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Choose a Shift' }));
    expect(mockNavigate).toHaveBeenCalledWith('/my-shifts');
  });

  test('acknowledges an existing signup and offers to browse more shifts', async () => {
    mockedGetMyShifts.mockResolvedValue({
      camps: [{ _id: 'camp-1', name: 'Mudskippers' }],
      availableShifts: [{
        shiftId: 'shift-available',
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
      signedUpShifts: [{
        shiftId: 'signed-shift',
        date: '2026-08-19T16:00:00.000Z',
        startTime: '2026-08-19T16:00:00.000Z'
      }]
    });

    render(<MyTasks />);

    expect(await screen.findByText('You’re all set for this year')).toBeTruthy();
    expect(screen.getByText(/We see you already have 1 shift for this year—thank you for helping!/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse More Shifts' })).toBeTruthy();
    expect(screen.queryByText('Kitchen Setup')).toBeNull();
  });

  test('treats a directly assigned shift as an existing commitment', async () => {
    mockedGetMyShifts.mockResolvedValue({
      camps: [{ _id: 'camp-1', name: 'Mudskippers' }],
      availableShifts: [{
        shiftId: 'assigned-shift',
        eventId: 'event-1',
        eventName: 'Build Week',
        campId: 'camp-1',
        campName: 'Mudskippers',
        title: 'Gate Greeter',
        date: '2026-08-19T16:00:00.000Z',
        startTime: '2026-08-19T16:00:00.000Z',
        endTime: '2026-08-19T18:00:00.000Z',
        maxSignUps: 4,
        signedUpCount: 1,
        remainingSpots: 3,
        isFull: false,
        isDirectlyAssignedToMe: true,
        memberIds: ['user-1'],
        coworkers: []
      }],
      signedUpShifts: []
    });

    render(<MyTasks />);

    expect(await screen.findByText('You’re all set for this year')).toBeTruthy();
    expect(screen.getByText(/We see you already have 1 shift for this year—thank you for helping!/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose a Shift' })).toBeNull();
  });

  test('does not show an empty shift section when there is no shift action', async () => {
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
    expect(headings).toContain('Pending Surveys');
    expect(headings).not.toContain('Shift Signup');
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
    expect(headings.indexOf('Pending Surveys')).toBeLessThan(headings.indexOf('Shift Signup'));
  });
});
