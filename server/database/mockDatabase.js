// Mock MongoDB-like database for development
const { ObjectId } = require('mongoose').Types;

// Numeric ID generator
let nextUserId = 1000000;
let nextCampId = 2000000;
let nextMemberId = 3000000;
let nextApplicationId = 4000000;
let nextRosterId = 5000000;
let nextAdminId = 6000000;
let nextCallSlotId = 7000000;
let nextTaskId = 8000000;
let nextEventId = 9000000;
let nextShiftId = 10000000;
let nextInviteId = 11000000;
let nextCategoryId = 13000000;
let nextPerkId = 14000000;
let nextSkillId = 9000022; // Start after existing skills

function generateNumericId(type) {
  switch (type) {
    case 'user':
      return ++nextUserId;
    case 'camp':
      return ++nextCampId;
    case 'member':
      return ++nextMemberId;
    case 'application':
      return ++nextApplicationId;
    case 'roster':
      return ++nextRosterId;
    case 'admin':
      return ++nextAdminId;
    case 'callSlot':
      return ++nextCallSlotId;
    case 'task':
      return ++nextTaskId;
    case 'event':
      return ++nextEventId;
    case 'shift':
      return ++nextShiftId;
    case 'invite':
      return ++nextInviteId;
    case 'category':
      return ++nextCategoryId;
    case 'perk':
      return ++nextPerkId;
    case 'skill':
      return ++nextSkillId;
    default:
      return ++nextUserId;
  }
}

function initializeIdCounters(mockDb) {
  // Find the highest existing IDs and set counters accordingly
  let maxUserId = 1000000;
  let maxCampId = 2000000;
  let maxMemberId = 3000000;
  let maxApplicationId = 4000000;
  let maxRosterId = 5000000;
  let maxAdminId = 6000000;
  let maxCallSlotId = 7000000;
  let maxTaskId = 8000000;
  let maxEventId = 9000000;
  let maxShiftId = 10000000;
  let maxOfferingId = 12000000;
  let maxCategoryId = 13000000;
  let maxPerkId = 14000000;
  
  for (let user of mockDb.collections.users.values()) {
    if (user._id > maxUserId) {
      maxUserId = user._id;
    }
  }
  
  for (let camp of mockDb.collections.camps.values()) {
    if (camp._id > maxCampId) {
      maxCampId = camp._id;
    }
  }
  
  for (let member of mockDb.collections.members.values()) {
    if (member._id > maxMemberId) {
      maxMemberId = member._id;
    }
  }
  
  for (let application of mockDb.collections.applications.values()) {
    if (application._id > maxApplicationId) {
      maxApplicationId = application._id;
    }
  }
  
  for (let roster of mockDb.collections.rosters.values()) {
    if (roster._id > maxRosterId) {
      maxRosterId = roster._id;
    }
  }
  
  for (let admin of mockDb.collections.admins.values()) {
    if (admin._id > maxAdminId) {
      maxAdminId = admin._id;
    }
  }
  
  for (let callSlot of mockDb.collections.callSlots.values()) {
    if (callSlot._id > maxCallSlotId) {
      maxCallSlotId = callSlot._id;
    }
  }
  
  for (let task of mockDb.collections.tasks.values()) {
    if (task._id > maxTaskId) {
      maxTaskId = task._id;
    }
  }
  
  
  for (let category of mockDb.collections.campCategories.values()) {
    if (category._id > maxCategoryId) {
      maxCategoryId = category._id;
    }
  }

  for (let perk of mockDb.collections.globalPerks.values()) {
    if (perk._id > maxPerkId) {
      maxPerkId = perk._id;
    }
  }
  
  nextUserId = maxUserId;
  nextCampId = maxCampId;
  nextMemberId = maxMemberId;
  nextApplicationId = maxApplicationId;
  nextRosterId = maxRosterId;
  nextAdminId = maxAdminId;
  nextCallSlotId = maxCallSlotId;
  nextTaskId = maxTaskId;
  nextCategoryId = maxCategoryId;
  nextPerkId = maxPerkId;
}
const fs = require('fs').promises;
const path = require('path');

class MockDatabase {
  constructor() {
    this.dataFile = path.join(__dirname, 'mockData.json');
    this.collections = {
      users: new Map(),
      camps: new Map(),
      members: new Map(),
      applications: new Map(),
      rosters: new Map(),
      admins: new Map(),
      callSlots: new Map(),
      tasks: new Map(),
      events: new Map(),
      shifts: new Map(),
      invites: new Map(),
      campCategories: new Map(),
      globalPerks: new Map(),
      skills: new Map()
    };
    this.loaded = false;
  }

  async ensureLoaded() {
    if (!this.loaded) {
      await this.loadData();
      this.loaded = true;
    }
  }

  async reloadData() {
    console.log('🔄 Reloading mock database data...');
    this.loaded = false;
    await this.loadData();
    this.loaded = true;
    console.log('✅ Mock database data reloaded successfully');
  }

  async loadData() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(data);
      
      // Convert arrays back to Maps and restore ObjectIds
      this.collections.users = new Map(parsed.users || []);
      this.collections.camps = new Map(parsed.camps || []);
      this.collections.members = new Map(parsed.members || []);
      this.collections.applications = new Map(parsed.applications || []);
      this.collections.rosters = new Map(parsed.rosters || []);
      this.collections.admins = new Map(parsed.admins ? parsed.admins.map(admin => [admin._id, admin]) : []);
      this.collections.callSlots = new Map(parsed.callSlots || []);
      this.collections.tasks = new Map(parsed.tasks || []);
      this.collections.events = new Map(parsed.events || []);
      this.collections.shifts = new Map(parsed.shifts || []);
      this.collections.invites = new Map(parsed.invites || []);
      this.collections.campCategories = new Map(parsed.campCategories || []);
      this.collections.globalPerks = new Map(parsed.globalPerks || []);
      this.collections.skills = new Map(parsed.skills || []);
      
      // Convert string IDs back to numbers (numeric IDs are stored as strings in JSON)
      for (let [key, user] of this.collections.users.entries()) {
        if (typeof user._id === 'string') {
          user._id = parseInt(user._id);
        }
      }
      
      for (let [key, camp] of this.collections.camps.entries()) {
        if (typeof camp._id === 'string') {
          camp._id = parseInt(camp._id);
        }
        if (typeof camp.owner === 'string') {
          camp.owner = parseInt(camp.owner);
        }
      }
      
      for (let [key, member] of this.collections.members.entries()) {
        if (typeof member._id === 'string') {
          // Only convert to int if it's a pure numeric string
          if (/^\d+$/.test(member._id)) {
            member._id = parseInt(member._id);
          }
          // Keep string IDs as strings (like MongoDB ObjectIds)
        }
        if (typeof member.camp === 'string') {
          member.camp = parseInt(member.camp);
        }
        if (typeof member.user === 'string') {
          member.user = parseInt(member.user);
        }
      }
      
      for (let [key, application] of this.collections.applications.entries()) {
        if (typeof application._id === 'string') {
          application._id = parseInt(application._id);
        }
        if (typeof application.camp === 'string') {
          application.camp = parseInt(application.camp);
        }
        if (typeof application.applicant === 'string') {
          application.applicant = parseInt(application.applicant);
        }
        if (typeof application.reviewedBy === 'string') {
          application.reviewedBy = parseInt(application.reviewedBy);
        }
      }
      
      for (let [key, roster] of this.collections.rosters.entries()) {
        if (typeof roster._id === 'string') {
          roster._id = parseInt(roster._id);
        }
        if (typeof roster.camp === 'string') {
          roster.camp = parseInt(roster.camp);
        }
        if (typeof roster.createdBy === 'string') {
          roster.createdBy = parseInt(roster.createdBy);
        }
        if (typeof roster.archivedBy === 'string') {
          roster.archivedBy = parseInt(roster.archivedBy);
        }
        // Convert member IDs in the roster
        if (roster.members && Array.isArray(roster.members)) {
          roster.members = roster.members.map(memberEntry => ({
            ...memberEntry,
            member: typeof memberEntry.member === 'string' ? parseInt(memberEntry.member) : memberEntry.member,
            addedBy: typeof memberEntry.addedBy === 'string' ? parseInt(memberEntry.addedBy) : memberEntry.addedBy
          }));
        }
      }
      
      for (let [key, admin] of this.collections.admins.entries()) {
        if (typeof admin._id === 'string') {
          admin._id = parseInt(admin._id);
        }
        if (typeof admin.user === 'string') {
          admin.user = parseInt(admin.user);
        }
      }
      
      
      for (let [key, category] of this.collections.campCategories.entries()) {
        if (typeof category._id === 'string') {
          category._id = parseInt(category._id);
        }
      }

      for (let [key, perk] of this.collections.globalPerks.entries()) {
        if (typeof perk._id === 'string') {
          perk._id = parseInt(perk._id);
        }
      }
      
      console.log('Mock database data loaded from file');
      // Initialize ID counters based on existing data
      initializeIdCounters(this);
    } catch (error) {
      console.log('No existing mock database file found, starting fresh');
      // File doesn't exist or is invalid, start with empty collections
    }
  }

  async saveData() {
    try {
      // Create a deep copy and remove circular references
      const cleanData = {
        users: Array.from(this.collections.users.entries()).map(([key, user]) => {
          const cleanUser = { ...user };
          if (cleanUser.actionHistory) {
            cleanUser.actionHistory = cleanUser.actionHistory.map(action => ({
              ...action,
              changes: action.changes ? { ...action.changes } : {}
            }));
          }
          return [key, cleanUser];
        }),
        camps: Array.from(this.collections.camps.entries()).map(([key, camp]) => {
          const cleanCamp = { ...camp };
          if (cleanCamp.actionHistory) {
            cleanCamp.actionHistory = cleanCamp.actionHistory.map(action => ({
              ...action,
              changes: action.changes ? { ...action.changes } : {}
            }));
          }
          return [key, cleanCamp];
        }),
        members: Array.from(this.collections.members.entries()),
        applications: Array.from(this.collections.applications.entries()),
        rosters: Array.from(this.collections.rosters.entries()),
        admins: Array.from(this.collections.admins.entries()).map(([key, admin]) => admin),
        callSlots: Array.from(this.collections.callSlots.entries()),
        tasks: Array.from(this.collections.tasks.entries()),
        events: Array.from(this.collections.events.entries()),
        shifts: Array.from(this.collections.shifts.entries()),
        invites: Array.from(this.collections.invites.entries()),
        campCategories: Array.from(this.collections.campCategories.entries()),
        globalPerks: Array.from(this.collections.globalPerks.entries()),
        skills: Array.from(this.collections.skills.entries())
      };
      
      await fs.writeFile(this.dataFile, JSON.stringify(cleanData, null, 2));
    } catch (error) {
      console.error('Error saving mock database:', error);
    }
  }

  // User operations
  async findUser(query) {
    await this.ensureLoaded();
    if (query.email) {
      return this.collections.users.get(query.email);
    }
    if (query._id) {
      for (let user of this.collections.users.values()) {
        // Handle both string and numeric ID comparisons
        if (user._id === query._id || user._id === parseInt(query._id) || user._id.toString() === query._id.toString()) {
          return user;
        }
      }
    }
    return null;
  }

  async findUsers(query = {}) {
    await this.ensureLoaded();
    let users = Array.from(this.collections.users.values());
    
    // Apply filters
    if (query.isActive !== undefined) {
      users = users.filter(user => user.isActive === query.isActive);
    }
    if (query.accountType) {
      users = users.filter(user => user.accountType === query.accountType);
    }
    
    return users;
  }

  async createUser(userData) {
    await this.ensureLoaded();
    const user = {
      _id: generateNumericId('user'),
      isActive: true,
      isVerified: false,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.collections.users.set(user.email, user);
    await this.saveData();
    return user;
  }

  async updateUser(email, updateData) {
    await this.ensureLoaded();
    const user = this.collections.users.get(email);
    if (user) {
      Object.assign(user, updateData, { updatedAt: new Date() });
      this.collections.users.set(email, user);
      await this.saveData();
      return user;
    }
    return null;
  }

  async updateUserById(id, updateData) {
    await this.ensureLoaded();
    // Find user by ID since users are stored with email as key
    let user = null;
    let userKey = null;
    for (const [key, userData] of this.collections.users.entries()) {
      if (userData._id === parseInt(id) || userData._id === id || userData._id.toString() === id.toString()) {
        user = userData;
        userKey = key;
        break;
      }
    }
    
    if (user && userKey) {
      Object.assign(user, updateData, { updatedAt: new Date() });
      this.collections.users.set(userKey, user);
      await this.saveData();
      return user;
    }
    return null;
  }

  // Camp operations
  async findCamp(query) {
    await this.ensureLoaded();
    
    let foundCamp = null;
    
    if (query._id) {
      for (let camp of this.collections.camps.values()) {
        // Handle both string and numeric ID comparisons
        if (camp._id === query._id || camp._id === parseInt(query._id) || camp._id.toString() === query._id.toString()) {
          foundCamp = camp;
          break;
        }
      }
    }
    if (!foundCamp && query.slug) {
      for (let camp of this.collections.camps.values()) {
        if (camp.slug === query.slug) {
          foundCamp = camp;
          break;
        }
      }
    }
    if (!foundCamp && query.owner) {
      for (let camp of this.collections.camps.values()) {
        try {
          // Direct numeric comparison
          if (camp && camp.owner === query.owner) {
            foundCamp = camp;
            break;
          }
        } catch (error) {
          // Continue to next camp if there's an error with this one
        }
      }
    }
    if (!foundCamp && query.contactEmail) {
      for (let camp of this.collections.camps.values()) {
        if (camp && camp.contactEmail === query.contactEmail) {
          foundCamp = camp;
          break;
        }
      }
    }
    if (!foundCamp && query.campName) {
      for (let camp of this.collections.camps.values()) {
        if (camp && camp.campName === query.campName) {
          foundCamp = camp;
          break;
        }
      }
    }
    
    // Populate categories if camp was found
    if (foundCamp && foundCamp.categories && foundCamp.categories.length > 0) {
      const populatedCategories = foundCamp.categories.map(categoryId => {
        const category = this.collections.campCategories.get(parseInt(categoryId));
        return category ? { _id: category._id, name: category.name } : null;
      }).filter(Boolean);
      foundCamp = { ...foundCamp, categories: populatedCategories };
    }
    
    return foundCamp;
  }

  async findAdmin(query) {
    await this.ensureLoaded();
    
    if (query._id) {
      for (let admin of this.collections.admins.values()) {
        if (admin._id === query._id || admin._id === parseInt(query._id)) {
          return admin;
        }
      }
    }
    if (query.user) {
      for (let admin of this.collections.admins.values()) {
        if (admin.user === query.user || admin.user === parseInt(query.user)) {
          return admin;
        }
      }
    }
    return null;
  }

  async findAdmins(query = {}) {
    await this.ensureLoaded();
    let admins = Array.from(this.collections.admins.values());
    
    if (query.isActive !== undefined) {
      admins = admins.filter(admin => admin.isActive === query.isActive);
    }
    if (query.role) {
      admins = admins.filter(admin => admin.role === query.role);
    }
    
    return admins;
  }

  async createAdmin(adminData) {
    await this.ensureLoaded();
    const admin = {
      _id: generateNumericId('admin'),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...adminData
    };
    
    this.collections.admins.set(admin._id, admin);
    await this.saveData();
    return admin;
  }

  async updateAdmin(query, updates) {
    await this.ensureLoaded();
    const admin = await this.findAdmin(query);
    if (admin) {
      Object.assign(admin, updates, { updatedAt: new Date() });
      await this.saveData();
      return admin;
    }
    return null;
  }

  async deleteAdmin(query) {
    await this.ensureLoaded();
    const admin = await this.findAdmin(query);
    if (admin) {
      this.collections.admins.delete(admin._id);
      await this.saveData();
      return admin;
    }
    return null;
  }

  async findCamps(query = {}) {
    await this.ensureLoaded();
    let camps = Array.from(this.collections.camps.values());
    
    // Apply filters
    if (query.status) {
      camps = camps.filter(camp => camp.status === query.status);
    }
    if (query.isPublic !== undefined) {
      camps = camps.filter(camp => camp.isPublic === query.isPublic);
    }
    
    return camps;
  }

  async createCamp(campData) {
    await this.ensureLoaded();
    
    // Generate slug from camp name if not provided
    let slug = campData.slug;
    if (!slug && campData.name) {
      slug = campData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    
    const camp = {
      _id: generateNumericId('camp'),
      isPublic: true, // Default to public
      acceptingNewMembers: true, // Default to accepting new members
      status: 'active', // Default to active status
      ...campData,
      slug: slug || `camp-${generateNumericId('camp')}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.collections.camps.set(camp._id.toString(), camp);
    await this.saveData();
    return camp;
  }

  async updateCamp(query, updateData) {
    await this.ensureLoaded();
    // Find camp by query (e.g., { owner: userId })
    let camp = null;
    for (const campEntry of this.collections.camps.values()) {
      if (Object.keys(query).every(key => {
        const campValue = campEntry[key];
        const queryValue = query[key];
        // Convert ObjectIds to strings for comparison
        const campStr = campValue && typeof campValue.toString === 'function' ? campValue.toString() : campValue;
        const queryStr = queryValue && typeof queryValue.toString === 'function' ? queryValue.toString() : queryValue;
        return campStr === queryStr;
      })) {
        camp = campEntry;
        break;
      }
    }
    
    if (camp) {
      // Generate slug if name is being updated and no slug provided
      if (updateData.name && !updateData.slug) {
        updateData.slug = updateData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }
      
      Object.assign(camp, updateData, { updatedAt: new Date() });
      this.collections.camps.set(camp._id.toString(), camp);
      await this.saveData();
      return { ...camp };
    }
    return null;
  }

  async updateCampById(id, updateData) {
    await this.ensureLoaded();
    const camp = this.collections.camps.get(id.toString());
    if (camp) {
      // Generate slug if name is being updated and no slug provided
      if (updateData.campName && !updateData.slug) {
        updateData.slug = updateData.campName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }
      
      Object.assign(camp, updateData, { updatedAt: new Date() });
      this.collections.camps.set(camp._id.toString(), camp);
      await this.saveData();
      return { ...camp };
    }
    return null;
  }

  async deleteCamp(campId) {
    await this.ensureLoaded();
    const result = this.collections.camps.delete(campId.toString());
    await this.saveData();
    return result;
  }

  async findAllCamps(query = {}, options = {}) {
    await this.ensureLoaded();
    let camps = Array.from(this.collections.camps.values());
    
    // Apply filters
    if (query.status) {
      camps = camps.filter(camp => camp.status === query.status);
    }
    if (query.isPublic !== undefined) {
      camps = camps.filter(camp => camp.isPublic === query.isPublic);
    }
    if (query.isRecruiting !== undefined) {
      camps = camps.filter(camp => camp.isRecruiting === query.isRecruiting);
    }
    
    // Apply sorting
    if (options.sort) {
      if (options.sort.createdAt === -1) {
        camps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    }
    
    // Apply pagination
    const skip = options.skip || 0;
    const limit = options.limit || 10;
    camps = camps.slice(skip, skip + limit);
    
    // Populate categories
    camps = camps.map(camp => {
      if (camp.categories && camp.categories.length > 0) {
        const populatedCategories = camp.categories.map(categoryId => {
          const category = this.collections.campCategories.get(parseInt(categoryId));
          return category ? { _id: category._id, name: category.name } : null;
        }).filter(Boolean);
        return { ...camp, categories: populatedCategories };
      }
      return camp;
    });
    
    return camps;
  }

  async countCamps(query = {}) {
    await this.ensureLoaded();
    let camps = Array.from(this.collections.camps.values());
    
    // Apply filters
    if (query.status) {
      camps = camps.filter(camp => camp.status === query.status);
    }
    if (query.isPublic !== undefined) {
      camps = camps.filter(camp => camp.isPublic === query.isPublic);
    }
    if (query.isRecruiting !== undefined) {
      camps = camps.filter(camp => camp.isRecruiting === query.isRecruiting);
    }
    
    return camps.length;
  }

  // Member operations
  async findMember(query) {
    await this.ensureLoaded();
    
    for (let member of this.collections.members.values()) {
      let matches = true;
      
      if (query._id && member._id.toString() !== query._id.toString()) {
        matches = false;
      }
      if (query.user && member.user.toString() !== query.user.toString()) {
        matches = false;
      }
      if (query.camp && member.camp.toString() !== query.camp.toString()) {
        matches = false;
      }
      if (query.status && member.status !== query.status) {
        matches = false;
      }
      if (query.role && member.role !== query.role) {
        matches = false;
      }
      
      if (matches) {
        return member;
      }
    }
    
    return null;
  }

  async findMembers(query = {}) {
    await this.ensureLoaded();
    let members = Array.from(this.collections.members.values());
    
    if (query.camp) {
      members = members.filter(member => member.camp && member.camp.toString() === query.camp.toString());
    }
    if (query.status) {
      members = members.filter(member => member.status === query.status);
    }
    
    return members;
  }

  async findRosters(query = {}) {
    await this.ensureLoaded();
    let rosters = Array.from(this.collections.rosters.values());
    
    if (query.camp) {
      rosters = rosters.filter(roster => roster.camp && roster.camp.toString() === query.camp.toString());
    }
    if (query.status) {
      rosters = rosters.filter(roster => roster.status === query.status);
    }
    
    return rosters;
  }

  async createMember(memberData) {
    await this.ensureLoaded();
    const member = {
      _id: generateNumericId('member'),
      ...memberData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.collections.members.set(member._id.toString(), member);
    await this.saveData();
    return member;
  }

  async updateMember(memberId, updateData) {
    await this.ensureLoaded();
    const member = this.collections.members.get(memberId.toString());
    if (member) {
      Object.assign(member, updateData, { updatedAt: new Date() });
      this.collections.members.set(memberId.toString(), member);
      await this.saveData();
      return member;
    }
    return null;
  }

  async deleteMembers(query) {
    await this.ensureLoaded();
    let deleted = 0;
    if (query.camp) {
      for (let [id, member] of this.collections.members.entries()) {
        if (member.camp.toString() === query.camp.toString()) {
          this.collections.members.delete(id);
          deleted++;
        }
      }
    }
    if (deleted > 0) {
      await this.saveData();
    }
    return { deletedCount: deleted };
  }

  async findAllMembers(query = {}, options = {}) {
    await this.ensureLoaded();
    let members = Array.from(this.collections.members.values());

    // Apply filters
    if (query.camp) {
      members = members.filter(member => member.camp.toString() === query.camp.toString());
    }
    if (query.status) {
      members = members.filter(member => member.status === query.status);
    }
    
    // Populate user data (similar to MongoDB populate)
    members = members.map(member => {
      // Find user by ID since users collection is keyed by email
      let user = null;
      for (let [email, userObj] of this.collections.users.entries()) {
        if (userObj._id === member.user) {
          user = userObj;
          break;
        }
      }
      if (user) {
        return {
          ...member,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profilePhoto: user.profilePhoto,
          accountType: user.accountType,
          bio: user.bio,
          skills: user.skills
        };
      }
      return member;
    });
    
    // Apply sorting
    if (options.sort) {
      if (options.sort.createdAt === -1) {
        members.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    }
    
    return members;
  }

  async deleteManyMembers(query) {
    await this.ensureLoaded();
    let deleted = 0;
    if (query.camp) {
      for (let [id, member] of this.collections.members.entries()) {
        if (member.camp.toString() === query.camp.toString()) {
          this.collections.members.delete(id);
          deleted++;
        }
      }
    }
    if (deleted > 0) {
      await this.saveData();
    }
    return { deletedCount: deleted };
  }

  // MemberApplication operations
  async findMemberApplication(query) {
    await this.ensureLoaded();
    if (query._id) {
      return this.collections.applications.get(query._id.toString());
    }
    if (query.applicant && query.camp) {
      for (let application of this.collections.applications.values()) {
        if (application.applicant.toString() === query.applicant.toString() && 
            application.camp.toString() === query.camp.toString()) {
          return application;
        }
      }
    }
    return null;
  }

  async findMemberApplications(query) {
    await this.ensureLoaded();
    const applications = [];
    
    for (let application of this.collections.applications.values()) {
      let matches = true;
      
      if (query.camp && application.camp.toString() !== query.camp.toString()) {
        matches = false;
      }
      if (query.applicant && application.applicant.toString() !== query.applicant.toString()) {
        matches = false;
      }
      if (query.status && application.status !== query.status) {
        matches = false;
      }
      // Support nested query for applicationData.selectedCallSlotId
      if (query['applicationData.selectedCallSlotId']) {
        const selectedId = application.applicationData?.selectedCallSlotId;
        if (!selectedId || selectedId.toString() !== query['applicationData.selectedCallSlotId'].toString()) {
          matches = false;
        }
      }
      
      if (matches) {
        applications.push(application);
      }
    }
    
    // Sort by appliedAt descending (newest first)
    applications.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
    
    return applications;
  }

  async createMemberApplication(applicationData) {
    await this.ensureLoaded();
    
    // Double-check for duplicates right before creation (prevents race conditions)
    // Allow re-application if previous application is in a terminal status
    const existingApplication = await this.findMemberApplication({
      applicant: applicationData.applicant,
      camp: applicationData.camp
    });
    
    // Define terminal statuses that allow re-application
    const terminalStatuses = ['deleted', 'withdrawn', 'rejected'];
    
    if (existingApplication && !terminalStatuses.includes(existingApplication.status)) {
      console.log('❌ [MockDB] Cannot create application - non-terminal application exists:', {
        existingId: existingApplication._id,
        status: existingApplication.status
      });
      throw new Error('Application already exists for this user and camp');
    }
    
    if (existingApplication && terminalStatuses.includes(existingApplication.status)) {
      console.log('✅ [MockDB] Creating new application after terminal status:', {
        previousId: existingApplication._id,
        previousStatus: existingApplication.status
      });
    }
    
    const application = {
      _id: generateNumericId('application'),
      ...applicationData,
      appliedAt: new Date(),
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.collections.applications.set(application._id.toString(), application);
    await this.saveData();
    return application;
  }

  async updateMemberApplication(applicationId, updateData) {
    await this.ensureLoaded();
    const application = this.collections.applications.get(applicationId.toString());
    
    if (!application) {
      return null;
    }
    
    const updatedApplication = {
      ...application,
      ...updateData,
      lastUpdated: new Date(),
      updatedAt: new Date()
    };
    
    this.collections.applications.set(applicationId.toString(), updatedApplication);
    await this.saveData();
    return updatedApplication;
  }

  // Roster operations
  async findRoster(query) {
    await this.ensureLoaded();
    if (query._id) {
      for (let roster of this.collections.rosters.values()) {
        if (roster._id === query._id) {
          return roster;
        }
      }
    }
    return null;
  }

  async findAllRosters(query = {}) {
    await this.ensureLoaded();
    let rosters = Array.from(this.collections.rosters.values());

    if (query.camp) {
      rosters = rosters.filter(roster => roster.camp.toString() === query.camp.toString());
    }
    if (query.isActive !== undefined) {
      rosters = rosters.filter(roster => roster.isActive === query.isActive);
    }
    if (query.isArchived !== undefined) {
      rosters = rosters.filter(roster => roster.isArchived === query.isArchived);
    }

    return rosters;
  }

  async findActiveRoster(query) {
    await this.ensureLoaded();
    for (let roster of this.collections.rosters.values()) {
      if (roster.camp.toString() === query.camp.toString() && roster.isActive && !roster.isArchived) {
        // Populate user data and application data for each member
        const populatedRoster = { ...roster };
        if (populatedRoster.members && populatedRoster.members.length > 0) {
          populatedRoster.members = await Promise.all(populatedRoster.members.map(async (memberEntry) => {
            const populatedMember = { ...memberEntry };
            if (memberEntry.member) {
              // First get the Member record
              const memberRecord = this.collections.members.get(memberEntry.member.toString());
              if (memberRecord && memberRecord.user) {
                // Then get the User record from the Member by iterating through users
                // (users collection is keyed by email, not ID)
                for (let user of this.collections.users.values()) {
                  if (user._id === memberRecord.user || user._id === parseInt(memberRecord.user) || user._id.toString() === memberRecord.user.toString()) {
                    populatedMember.user = {
                      _id: user._id,
                      firstName: user.firstName,
                      lastName: user.lastName,
                      email: user.email,
                      profilePhoto: user.profilePhoto,
                      accountType: user.accountType,
                      playaName: user.playaName,
                      city: user.city,
                      yearsBurned: user.yearsBurned,
                      hasTicket: user.hasTicket,
                      hasVehiclePass: user.hasVehiclePass,
                      interestedInEAP: user.interestedInEAP,
                      interestedInStrike: user.interestedInStrike,
                      arrivalDate: user.arrivalDate,
                      departureDate: user.departureDate,
                      skills: user.skills
                    };
                    break;
                  }
                }

                // Get the application data for this member
                const application = await this.findMemberApplication({
                  applicant: memberRecord.user,
                  camp: roster.camp
                });

                if (application) {
                  // Add application data to member
                  populatedMember.applicationData = application.applicationData;
                  populatedMember.reviewNotes = application.reviewNotes;
                  populatedMember.status = application.status;
                  populatedMember.appliedAt = application.appliedAt;

                  // Populate call slot details if selected
                  if (application.applicationData?.selectedCallSlotId) {
                    const callSlot = await this.findCallSlot({ _id: application.applicationData.selectedCallSlotId });
                    if (callSlot) {
                      populatedMember.applicationData = {
                        ...populatedMember.applicationData,
                        callSlot: {
                          date: callSlot.date,
                          startTime: callSlot.startTime,
                          endTime: callSlot.endTime
                        }
                      };
                    }
                  }
                }
              }
            }
            return populatedMember;
          }));
        }
        return populatedRoster;
      }
    }
    return null;
  }

  async createRoster(rosterData) {
    await this.ensureLoaded();
    const roster = {
      _id: generateNumericId('roster'),
      ...rosterData,
      members: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.collections.rosters.set(roster._id.toString(), roster);
    await this.saveData();
    return roster;
  }

  async updateRoster(rosterId, updateData) {
    await this.ensureLoaded();
    const roster = this.collections.rosters.get(rosterId.toString());
    if (!roster) {
      throw new Error('Roster not found');
    }
    
    const updatedRoster = {
      ...roster,
      ...updateData,
      updatedAt: new Date()
    };
    
    this.collections.rosters.set(rosterId.toString(), updatedRoster);
    await this.saveData();
    return updatedRoster;
  }

  async archiveRoster(rosterId, archivedBy) {
    await this.ensureLoaded();
    const roster = this.collections.rosters.get(rosterId.toString());
    if (!roster) {
      throw new Error('Roster not found');
    }
    
    const updatedRoster = {
      ...roster,
      isActive: false,
      isArchived: true,
      archivedAt: new Date(),
      archivedBy,
      updatedAt: new Date()
    };
    
    this.collections.rosters.set(rosterId.toString(), updatedRoster);
    await this.saveData();
    return updatedRoster;
  }

  async addMemberToRoster(rosterId, memberId, addedBy) {
    await this.ensureLoaded();
    const roster = this.collections.rosters.get(rosterId.toString());
    if (!roster) {
      throw new Error('Roster not found');
    }
    
    // Check if member is already in roster (convert to strings for comparison)
    // Filter out any null/undefined members first to prevent errors
    const validMembers = roster.members.filter(m => m && m.member != null);
    const existingMember = validMembers.find(m => m.member.toString() === memberId.toString());
    if (existingMember) {
      return roster; // Member already exists
    }
    
    const memberEntry = {
      member: memberId,
      addedAt: new Date(),
      addedBy
    };
    
    // Clean up any null/undefined members and add the new member
    const cleanMembers = roster.members.filter(m => m && m.member != null);
    const updatedRoster = {
      ...roster,
      members: [...cleanMembers, memberEntry],
      updatedAt: new Date()
    };
    
    this.collections.rosters.set(rosterId.toString(), updatedRoster);
    await this.saveData();
    return updatedRoster;
  }

  async removeMemberFromRoster(rosterId, memberId) {
    await this.ensureLoaded();
    const roster = this.collections.rosters.get(rosterId.toString());
    if (!roster) {
      throw new Error('Roster not found');
    }
    
    // Convert both to strings for comparison to handle mixed data types
    const updatedRoster = {
      ...roster,
      members: roster.members.filter(m => m.member.toString() !== memberId.toString()),
      updatedAt: new Date()
    };
    
    this.collections.rosters.set(rosterId.toString(), updatedRoster);
    await this.saveData();
    return updatedRoster;
  }

  // CallSlot operations
  async findCallSlot(query) {
    await this.ensureLoaded();
    for (let [key, callSlot] of this.collections.callSlots.entries()) {
      if (query._id && callSlot._id.toString() === query._id.toString()) {
        return callSlot;
      }
      if (query.campId && callSlot.campId.toString() === query.campId.toString()) {
        return callSlot;
      }
    }
    return null;
  }

  async findCallSlots(query = {}) {
    await this.ensureLoaded();
    let callSlots = Array.from(this.collections.callSlots.values());
    
    if (query.campId) {
      callSlots = callSlots.filter(callSlot => callSlot.campId && callSlot.campId.toString() === query.campId.toString());
    }
    if (query.isAvailable !== undefined) {
      callSlots = callSlots.filter(callSlot => callSlot.isAvailable === query.isAvailable);
    }
    if (query.date) {
      if (query.date.$gte) {
        callSlots = callSlots.filter(callSlot => new Date(callSlot.date) >= new Date(query.date.$gte));
      }
    }
    
    return callSlots;
  }

  async createCallSlot(callSlotData) {
    await this.ensureLoaded();
    const id = generateNumericId('callSlot');
    const callSlot = {
      _id: id,
      ...callSlotData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.collections.callSlots.set(id, callSlot);
    await this.saveData();
    return callSlot;
  }

  async updateCallSlot(id, updates) {
    await this.ensureLoaded();
    const callSlot = this.collections.callSlots.get(parseInt(id));
    if (!callSlot) {
      return null;
    }
    
    const updatedCallSlot = {
      ...callSlot,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.collections.callSlots.set(parseInt(id), updatedCallSlot);
    await this.saveData();
    return updatedCallSlot;
  }

  async deleteCallSlot(id) {
    await this.ensureLoaded();
    const deleted = this.collections.callSlots.delete(parseInt(id));
    if (deleted) {
      await this.saveData();
    }
    return deleted;
  }

  // Task operations
  async findTask(query) {
    await this.ensureLoaded();
    for (let [key, task] of this.collections.tasks.entries()) {
      if (query._id && task._id.toString() === query._id.toString()) {
        return task;
      }
      if (query.campId && task.campId.toString() === query.campId.toString()) {
        return task;
      }
    }
    return null;
  }

  async findTasks(query = {}) {
    await this.ensureLoaded();
    let tasks = Array.from(this.collections.tasks.values()).filter(task => task && task.campId);
    
    if (query.campId) {
      tasks = tasks.filter(task => task.campId && task.campId.toString() === query.campId.toString());
    }
    if (query.assignedTo) {
      tasks = tasks.filter(task => {
        return task.assignedTo && (
          task.assignedTo.includes(query.assignedTo) || 
          task.assignedTo.includes(query.assignedTo.toString()) ||
          task.assignedTo.includes(parseInt(query.assignedTo))
        );
      });
    }
    if (query.status) {
      tasks = tasks.filter(task => task.status === query.status);
    }
    if (query.type) {
      tasks = tasks.filter(task => task.type === query.type);
    }
    if (query['metadata.eventId']) {
      tasks = tasks.filter(task => task.metadata && task.metadata.eventId === query['metadata.eventId']);
    }
    
    return tasks;
  }

  async createTask(taskData) {
    await this.ensureLoaded();
    const id = generateNumericId('task');
    const task = {
      _id: id,
      ...taskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.collections.tasks.set(id, task);
    await this.saveData();
    return task;
  }

  async updateTask(id, updates) {
    await this.ensureLoaded();
    console.log('🔍 [Mock DB] updateTask called:', {
      id: id,
      idType: typeof id,
      parsedId: parseInt(id),
      updates: updates
    });
    
    // Debug: Show available task IDs
    const availableTaskIds = Array.from(this.collections.tasks.keys());
    console.log('🔍 [Mock DB] Available task IDs:', availableTaskIds);
    
    // Try both string and number keys since mock data uses string keys
    let task = this.collections.tasks.get(parseInt(id));
    if (!task) {
      task = this.collections.tasks.get(id.toString());
    }
    
    console.log('🔍 [Mock DB] Task found:', !!task, task ? task.title : 'null');
    
    if (!task) {
      console.log('❌ [Mock DB] Task not found with ID:', id, 'Available IDs:', availableTaskIds);
      return null;
    }
    
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Use the same key format as the original task (string keys from mock data)
    const keyToUse = availableTaskIds.includes(id.toString()) ? id.toString() : parseInt(id);
    this.collections.tasks.set(keyToUse, updatedTask);
    await this.saveData();
    return updatedTask;
  }

  async deleteTask(id) {
    await this.ensureLoaded();
    const deleted = this.collections.tasks.delete(parseInt(id));
    if (deleted) {
      await this.saveData();
    }
    return deleted;
  }

  // Event operations
  async findEvent(query) {
    await this.ensureLoaded();
    if (query._id) {
      return this.collections.events.get(query._id);
    }
    for (let event of this.collections.events.values()) {
      if (event && event.campId && query.campId && event.campId.toString() === query.campId.toString()) {
        return event;
      }
    }
    return null;
  }

  async findEvents(query) {
    await this.ensureLoaded();
    const results = [];
    for (let event of this.collections.events.values()) {
      if (event && event.campId && query.campId && event.campId.toString() === query.campId.toString()) {
        results.push(event);
      }
    }
    return results;
  }

  async createEvent(eventData) {
    await this.ensureLoaded();
    const id = generateNumericId('event').toString();
    const event = {
      _id: id,
      eventName: eventData.eventName,
      description: eventData.description || '',
      campId: eventData.campId,
      createdBy: eventData.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shifts: eventData.shifts.map(shiftData => {
        const shiftId = generateNumericId('shift').toString();
        return {
          _id: shiftId,
          eventId: id,
          title: shiftData.title,
          description: shiftData.description || '',
          date: shiftData.date.toISOString(),
          startTime: shiftData.startTime.toISOString(),
          endTime: shiftData.endTime.toISOString(),
          maxSignUps: shiftData.maxSignUps,
          memberIds: shiftData.memberIds || [],
          createdBy: shiftData.createdBy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      })
    };
    
    this.collections.events.set(id, event);
    await this.saveData();
    return event;
  }

  async updateEvent(id, updateData) {
    await this.ensureLoaded();
    const event = this.collections.events.get(id);
    if (!event) {
      return null;
    }
    
    const updatedEvent = {
      ...event,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    this.collections.events.set(id, updatedEvent);
    await this.saveData();
    return updatedEvent;
  }

  async deleteEvent(id) {
    await this.ensureLoaded();
    const deleted = this.collections.events.delete(id);
    if (deleted) {
      await this.saveData();
    }
    return deleted;
  }

  // Shift operations
  async findShift(query) {
    await this.ensureLoaded();
    if (query._id) {
      // First check in events
      for (let event of this.collections.events.values()) {
        for (let shift of event.shifts) {
          if (shift._id === query._id) {
            return {
              ...shift,
              eventId: event._id
            };
          }
        }
      }
    }
    return null;
  }

  async updateShift(shiftId, updateData) {
    await this.ensureLoaded();
    for (let event of this.collections.events.values()) {
      for (let i = 0; i < event.shifts.length; i++) {
        if (event.shifts[i]._id === shiftId) {
          event.shifts[i] = {
            ...event.shifts[i],
            ...updateData,
            updatedAt: new Date().toISOString()
          };
          event.updatedAt = new Date().toISOString();
          this.collections.events.set(event._id, event);
          await this.saveData();
          return event.shifts[i];
        }
      }
    }
    return null;
  }

  // Invite operations
  async findInvite(query) {
    await this.ensureLoaded();
    
    for (let invite of this.collections.invites.values()) {
      let matches = true;
      
      for (let [key, value] of Object.entries(query)) {
        if (invite[key] !== value) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        return invite;
      }
    }
    
    return null;
  }

  async findInvites(query = {}) {
    await this.ensureLoaded();
    
    const results = [];
    
    for (let invite of this.collections.invites.values()) {
      let matches = true;
      
      for (let [key, value] of Object.entries(query)) {
        if (invite[key] !== value) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        results.push(invite);
      }
    }
    
    return results;
  }

  async createInvite(inviteData) {
    await this.ensureLoaded();
    
    const id = generateNumericId('invite');
    const invite = {
      _id: id,
      ...inviteData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.collections.invites.set(id, invite);
    await this.saveData();
    return invite;
  }

  async updateInviteById(id, updateData) {
    await this.ensureLoaded();
    
    const invite = this.collections.invites.get(parseInt(id));
    if (!invite) {
      return null;
    }
    
    const updatedInvite = {
      ...invite,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    this.collections.invites.set(parseInt(id), updatedInvite);
    await this.saveData();
    return updatedInvite;
  }

  async deleteInvite(id) {
    await this.ensureLoaded();
    
    const invite = this.collections.invites.get(parseInt(id));
    if (!invite) {
      return null;
    }
    
    this.collections.invites.delete(parseInt(id));
    await this.saveData();
    return invite;
  }

  async updateCampById(id, updateData) {
    await this.ensureLoaded();
    
    const camp = this.collections.camps.get(parseInt(id));
    if (!camp) {
      return null;
    }
    
    const updatedCamp = {
      ...camp,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    this.collections.camps.set(parseInt(id), updatedCamp);
    await this.saveData();
    return updatedCamp;
  }


  // Camp Category methods
  async findCampCategory(query) {
    await this.ensureLoaded();
    
    for (let category of this.collections.campCategories.values()) {
      if (query._id && category._id === parseInt(query._id)) {
        return category;
      }
      if (query.name && category.name === query.name) {
        return category;
      }
    }
    return null;
  }

  async findCampCategories(query = {}) {
    await this.ensureLoaded();
    
    let categories = Array.from(this.collections.campCategories.values());
    
    if (query.name) {
      categories = categories.filter(category => 
        category.name.toLowerCase().includes(query.name.toLowerCase())
      );
    }
    
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCampCategory(categoryData) {
    await this.ensureLoaded();
    
    const id = generateNumericId('category');
    const category = {
      _id: id,
      name: categoryData.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.collections.campCategories.set(id, category);
    await this.saveData();
    return category;
  }

  async updateCampCategory(id, updateData) {
    await this.ensureLoaded();
    
    const category = this.collections.campCategories.get(parseInt(id));
    if (!category) {
      return null;
    }
    
    const updatedCategory = {
      ...category,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    this.collections.campCategories.set(parseInt(id), updatedCategory);
    await this.saveData();
    return updatedCategory;
  }

  async deleteCampCategory(id) {
    await this.ensureLoaded();
    
    const category = this.collections.campCategories.get(parseInt(id));
    if (!category) {
      return null;
    }
    
    this.collections.campCategories.delete(parseInt(id));
    await this.saveData();
    return category;
  }

  // Global Perk methods
  async findGlobalPerk(query = {}) {
    await this.ensureLoaded();
    for (let perk of this.collections.globalPerks.values()) {
      if (query._id && perk._id === parseInt(query._id)) {
        return perk;
      }
      if (query.name && perk.name === query.name) {
        return perk;
      }
    }
    return null;
  }

  async findGlobalPerks(query = {}) {
    await this.ensureLoaded();
    let perks = Array.from(this.collections.globalPerks.values());
    if (query.name) {
      perks = perks.filter(p => p.name.toLowerCase().includes(query.name.toLowerCase()));
    }
    return perks.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createGlobalPerk(perkData) {
    await this.ensureLoaded();
    const id = generateNumericId('perk');
    const perk = {
      _id: id,
      name: perkData.name,
      icon: perkData.icon,
      color: perkData.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.collections.globalPerks.set(id, perk);
    await this.saveData();
    return perk;
  }

  async updateGlobalPerk(id, updateData) {
    await this.ensureLoaded();
    const perk = this.collections.globalPerks.get(parseInt(id));
    if (!perk) return null;
    const updatedPerk = {
      ...perk,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    this.collections.globalPerks.set(parseInt(id), updatedPerk);
    await this.saveData();
    return updatedPerk;
  }

  async deleteGlobalPerk(id) {
    await this.ensureLoaded();
    
    // Try both string and integer keys
    let perk = this.collections.globalPerks.get(id.toString());
    if (!perk) {
      perk = this.collections.globalPerks.get(parseInt(id));
    }
    if (!perk) {
      perk = this.collections.globalPerks.get(parseInt(id).toString());
    }
    
    if (!perk) return null;
    
    // Delete using the actual key from the map
    for (let [key, value] of this.collections.globalPerks.entries()) {
      if (value._id === parseInt(id) || value._id.toString() === id.toString()) {
        this.collections.globalPerks.delete(key);
        break;
      }
    }
    
    await this.saveData();
    return perk;
  }

  // ==================== Skills Methods ====================
  
  async findSkills(query = {}) {
    await this.ensureLoaded();
    let skills = Array.from(this.collections.skills.values());
    
    // Filter by isActive (default to only active skills)
    if (query.isActive !== undefined) {
      skills = skills.filter(skill => skill.isActive === query.isActive);
    } else {
      // By default, only return active skills
      skills = skills.filter(skill => skill.isActive !== false);
    }
    
    // Sort alphabetically by name
    skills.sort((a, b) => a.name.localeCompare(b.name));
    
    return skills;
  }
  
  async findSkillById(id) {
    await this.ensureLoaded();
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return this.collections.skills.get(numericId);
  }
  
  async findSkillByName(name) {
    await this.ensureLoaded();
    const skills = Array.from(this.collections.skills.values());
    return skills.find(skill => skill.name.toLowerCase() === name.toLowerCase());
  }
  
  async createSkill(skillData) {
    await this.ensureLoaded();
    
    // Check if skill with same name already exists
    const existing = await this.findSkillByName(skillData.name);
    if (existing) {
      throw new Error('A skill with this name already exists');
    }
    
    const skill = {
      _id: generateNumericId('skill'),
      name: skillData.name,
      description: skillData.description || '',
      isActive: skillData.isActive !== undefined ? skillData.isActive : true,
      createdBy: skillData.createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.collections.skills.set(skill._id, skill);
    await this.saveData();
    
    return skill;
  }
  
  async updateSkill(id, updates) {
    await this.ensureLoaded();
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    const skill = this.collections.skills.get(numericId);
    
    if (!skill) {
      throw new Error('Skill not found');
    }
    
    // If updating name, check for duplicates
    if (updates.name && updates.name !== skill.name) {
      const existing = await this.findSkillByName(updates.name);
      if (existing && existing._id !== numericId) {
        throw new Error('A skill with this name already exists');
      }
    }
    
    // Update skill
    Object.assign(skill, {
      ...updates,
      updatedAt: new Date()
    });
    
    this.collections.skills.set(numericId, skill);
    await this.saveData();
    
    return skill;
  }
  
  async deleteSkill(id) {
    await this.ensureLoaded();
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    const skill = this.collections.skills.get(numericId);
    
    if (!skill) {
      throw new Error('Skill not found');
    }
    
    this.collections.skills.delete(numericId);
    await this.saveData();
    
    return skill;
  }
}

// Singleton instance
const mockDB = new MockDatabase();

module.exports = mockDB;

