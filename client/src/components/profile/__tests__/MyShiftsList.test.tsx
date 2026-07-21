import { render, screen } from '@testing-library/react';
import api from '../../../services/api';
import MyShiftsList from '../MyShiftsList';

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: {
    getMyShifts: jest.fn()
  }
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'user-1', accountType: 'personal' }
  })
}));

const mockedGetMyShifts = api.getMyShifts as jest.Mock;

const shift = {
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
  coworkers: [{
    _id: 'coworker-1',
    firstName: 'Alex',
    lastName: 'Rivera',
    playaName: 'Sparky'
  }]
};

describe('MyShiftsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows an assigned shift and the coworkers already signed up', async () => {
    mockedGetMyShifts.mockResolvedValue({
      camps: [{ _id: 'camp-1', name: 'Mudskippers' }],
      availableShifts: [shift],
      signedUpShifts: []
    });

    render(<MyShiftsList />);

    expect(await screen.findByText('Kitchen Setup')).toBeTruthy();
    expect(screen.getByText('Needs signup')).toBeTruthy();
    expect(screen.getByText('Working with')).toBeTruthy();
    expect(screen.getByText('Sparky')).toBeTruthy();
    expect(screen.queryByText('You have no assigned or signed-up shifts.')).toBeNull();
  });
});
