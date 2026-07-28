import { render, screen } from '@testing-library/react';
import api from '../../../services/api';
import Navbar from '../Navbar';

let mockUser: Record<string, unknown>;

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => jest.fn()
}), { virtual: true });

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    logout: jest.fn()
  })
}));

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn()
  }
}));

jest.mock('../../notifications/NotificationBell', () => () => null);

const expectNoCampTasksLink = () => {
  expect(screen.queryByRole('button', { name: 'Tasks' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Camp Tasks' })).toBeNull();
};

describe('Navbar task and shift links', () => {
  beforeEach(() => {
    (api.get as jest.Mock).mockImplementation(() => new Promise(() => {}));
  });

  test('shows My Shifts and hides camp tasks for a camp lead', () => {
    mockUser = {
      _id: 'lead-1',
      accountType: 'personal',
      firstName: 'Lead',
      isCampLead: true,
      campLeadCampId: 'camp-1',
      campLeadCampSlug: 'mudskippers'
    };

    render(<Navbar />);

    expect(screen.getByRole('button', { name: 'My Shifts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'To-dos' })).toBeTruthy();
    expectNoCampTasksLink();
  });

  test('shows My Shifts and hides camp tasks for an events lead', () => {
    mockUser = {
      _id: 'events-lead-1',
      accountType: 'personal',
      firstName: 'Events',
      isEventsLead: true,
      eventsLeadCampId: 'camp-1'
    };

    render(<Navbar />);

    expect(screen.getByRole('button', { name: 'My Shifts' })).toBeTruthy();
    expectNoCampTasksLink();
  });

  test('hides camp tasks for a camp account', () => {
    mockUser = {
      _id: 'camp-user-1',
      accountType: 'camp',
      firstName: 'Camp',
      campId: 'camp-1'
    };

    render(<Navbar />);

    expectNoCampTasksLink();
  });

  test('does not add a camp tasks link for a regular member', () => {
    mockUser = {
      _id: 'member-1',
      accountType: 'personal',
      firstName: 'Member'
    };

    render(<Navbar />);

    expect(screen.getByRole('button', { name: 'To-dos' })).toBeTruthy();
    expectNoCampTasksLink();
  });
});
