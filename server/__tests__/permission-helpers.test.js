jest.mock('../database/databaseAdapter', () => ({
  findActiveRoster: jest.fn()
}));

jest.mock('../models/Member', () => ({
  find: jest.fn()
}));

jest.mock('../models/Roster', () => ({
  findOne: jest.fn()
}));

const db = require('../database/databaseAdapter');
const Member = require('../models/Member');
const Roster = require('../models/Roster');
const {
  isCampLeadForCamp,
  isEventsLeadForCamp,
  canManageCamp,
  canManageEventPlanning,
  canViewCampRoster
} = require('../utils/permissionHelpers');

function mockRosterLeadQuery(result) {
  Roster.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue(result)
  });
}

function mockRosterRoleQueries({ campLeadResult = null, eventsLeadResult = null } = {}) {
  Roster.findOne.mockImplementation((query) => ({
    select: jest.fn().mockResolvedValue(
      query?.members?.$elemMatch?.isEventsLead === true
        ? eventsLeadResult
        : campLeadResult
    )
  }));
}

describe('permissionHelpers camp-lead role fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.findActiveRoster.mockResolvedValue(null);
    mockRosterLeadQuery(null);
  });

  test('grants camp access for legacy camp_lead role with pending status', async () => {
    Member.find.mockResolvedValue([
      {
        _id: 'member-1',
        camp: 'camp-1',
        role: 'camp_lead',
        status: 'pending'
      }
    ]);

    const req = {
      user: {
        _id: 'user-1',
        accountType: 'personal'
      }
    };

    const result = await isCampLeadForCamp(req, 'camp-1');
    expect(result).toBe(true);
  });

  test('denies camp access for removed camp-lead statuses', async () => {
    Member.find.mockResolvedValue([
      {
        _id: 'member-1',
        camp: 'camp-1',
        role: 'camp-lead',
        status: 'withdrawn'
      }
    ]);

    const req = {
      user: {
        _id: 'user-1',
        accountType: 'personal'
      }
    };

    const result = await isCampLeadForCamp(req, 'camp-1');
    expect(result).toBe(false);
  });

  test('canManageCamp inherits camp-lead role fallback access', async () => {
    Member.find.mockResolvedValue([
      {
        _id: 'member-1',
        camp: 'camp-1',
        role: 'camp_lead',
        status: 'pending'
      }
    ]);

    const req = {
      user: {
        _id: 'user-1',
        accountType: 'personal'
      }
    };

    const result = await canManageCamp(req, 'camp-1');
    expect(result).toBe(true);
  });

  test('events lead roster flag grants planning and roster view access', async () => {
    Member.find.mockResolvedValue([
      {
        _id: 'member-1',
        camp: 'camp-1',
        role: 'member',
        status: 'approved'
      }
    ]);
    mockRosterRoleQueries({
      eventsLeadResult: { _id: 'roster-1' }
    });

    const req = {
      user: {
        _id: 'user-1',
        accountType: 'personal'
      }
    };

    await expect(isEventsLeadForCamp(req, 'camp-1')).resolves.toBe(true);
    await expect(canManageEventPlanning(req, 'camp-1')).resolves.toBe(true);
    await expect(canViewCampRoster(req, 'camp-1')).resolves.toBe(true);
  });

  test('events lead roster flag does not grant full camp management access', async () => {
    Member.find.mockResolvedValue([
      {
        _id: 'member-1',
        camp: 'camp-1',
        role: 'member',
        status: 'approved'
      }
    ]);
    mockRosterRoleQueries({
      eventsLeadResult: { _id: 'roster-1' }
    });

    const req = {
      user: {
        _id: 'user-1',
        accountType: 'personal'
      }
    };

    await expect(canManageCamp(req, 'camp-1')).resolves.toBe(false);
  });
});
