// Database adapter that can work with MongoDB or mock database
const mockDB = require('./mockDatabase');

// Simple password hashing for mock database
const bcrypt = require('bcryptjs');

class DatabaseAdapter {
  constructor() {
    this.useMongoDB = !!process.env.MONGODB_URI;
    this.mockDB = mockDB;
  }

  // User operations
  async findUser(query) {
    if (this.useMongoDB) {
      const User = require('../models/User');
      return await User.findOne(query);
    } else {
      return await this.mockDB.findUser(query);
    }
  }

  async findUserById(id) {
    if (this.useMongoDB) {
      const User = require('../models/User');
      return await User.findById(id);
    } else {
      return await this.mockDB.findUserById(id);
    }
  }

  async findUsers(query = {}) {
    if (this.useMongoDB) {
      const User = require('../models/User');
      return await User.find(query);
    } else {
      return await this.mockDB.findUsers(query);
    }
  }

  async createUser(userData) {
    if (this.useMongoDB) {
      const User = require('../models/User');
      const user = new User(userData);
      return await user.save();
    } else {
      // Hash password for mock database
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 12);
      }
      return await this.mockDB.createUser(userData);
    }
  }

  async updateUser(email, updateData) {
    if (this.useMongoDB) {
      const User = require('../models/User');
      return await User.findOneAndUpdate({ email }, updateData, { new: true });
    } else {
      return await this.mockDB.updateUser(email, updateData);
    }
  }

  async updateUserById(id, updateData) {
    if (this.useMongoDB) {
      const User = require('../models/User');
      return await User.findByIdAndUpdate(id, updateData, { new: true });
    } else {
      return await this.mockDB.updateUserById(id, updateData);
    }
  }

  // Camp operations
  async findCamp(query, options = {}) {
    if (this.useMongoDB) {
      const Camp = require('../models/Camp');
      let campQuery = Camp.findOne(query);
      
      // Support populate option
      if (options.populate) {
        campQuery = campQuery.populate(options.populate);
      }
      
      return await campQuery;
    } else {
      // For mock DB, manually populate owner if requested
      const camp = await this.mockDB.findCamp(query);
      if (camp && options.populate === 'owner' && camp.owner) {
        const owner = await this.mockDB.findUser({ _id: camp.owner });
        if (owner) {
          camp.owner = owner;
        }
      }
      return camp;
    }
  }

  async findCamps(query = {}) {
    if (this.useMongoDB) {
      const Camp = require('../models/Camp');
      return await Camp.find(query);
    } else {
      return await this.mockDB.findCamps(query);
    }
  }

  async createCamp(campData) {
    if (this.useMongoDB) {
      const Camp = require('../models/Camp');
      const camp = new Camp(campData);
      return await camp.save();
    } else {
      return await this.mockDB.createCamp(campData);
    }
  }

  async updateCamp(query, updateData) {
    if (this.useMongoDB) {
      const Camp = require('../models/Camp');
      return await Camp.findOneAndUpdate(query, updateData, { new: true });
    } else {
      return await this.mockDB.updateCamp(query, updateData);
    }
  }

  async updateCampById(id, updateData) {
    if (this.useMongoDB) {
      const Camp = require('../models/Camp');
      return await Camp.findByIdAndUpdate(id, updateData, { new: true });
    } else {
      return await this.mockDB.updateCampById(id, updateData);
    }
  }

  async findRosters(query = {}) {
    if (this.useMongoDB) {
      const Roster = require('../models/Roster');
      return await Roster.find(query);
    } else {
      return await this.mockDB.findRosters(query);
    }
  }

  async deleteCamp(campId) {
    if (this.useMongoDB) {
      const Camp = require('../models/Camp');
      return await Camp.findByIdAndDelete(campId);
    } else {
      return await this.mockDB.deleteCamp(campId);
    }
  }

  async findAllCamps(query, options = {}) {
    if (this.useMongoDB) {
      const Camp = require('../models/Camp');
      return await Camp.find(query)
        .populate('owner', 'campName email')
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 10)
        .skip(options.skip || 0);
    } else {
      return await this.mockDB.findAllCamps(query, options);
    }
  }

  async countCamps(query) {
    if (this.useMongoDB) {
      const Camp = require('../models/Camp');
      return await Camp.countDocuments(query);
    } else {
      return await this.mockDB.countCamps(query);
    }
  }

  async findManyMembers(query, options = {}) {
    if (this.useMongoDB) {
      const Member = require('../models/Member');
      return await Member.find(query)
        .populate('user', 'firstName lastName email profilePhoto accountType playaName')
        .sort(options.sort || { createdAt: -1 });
    } else {
      return await this.mockDB.findAllMembers(query, options);
    }
  }

  async deleteManyMembers(query) {
    if (this.useMongoDB) {
      const Member = require('../models/Member');
      return await Member.deleteMany(query);
    } else {
      return await this.mockDB.deleteManyMembers(query);
    }
  }

  // Member operations
  async findMember(query) {
    if (this.useMongoDB) {
      const Member = require('../models/Member');
      return await Member.findOne(query);
    } else {
      return await this.mockDB.findMember(query);
    }
  }

  async findMembers(query) {
    if (this.useMongoDB) {
      const Member = require('../models/Member');
      return await Member.find(query);
    } else {
      return await this.mockDB.findMembers(query);
    }
  }

  async createMember(memberData) {
    if (this.useMongoDB) {
      const Member = require('../models/Member');
      const member = new Member(memberData);
      return await member.save();
    } else {
      return await this.mockDB.createMember(memberData);
    }
  }

  async updateMember(memberId, updateData) {
    if (this.useMongoDB) {
      const Member = require('../models/Member');
      return await Member.findByIdAndUpdate(memberId, updateData, { new: true });
    } else {
      return await this.mockDB.updateMember(memberId, updateData);
    }
  }

  async deleteMembers(query) {
    if (this.useMongoDB) {
      const Member = require('../models/Member');
      return await Member.deleteMany(query);
    } else {
      return await this.mockDB.deleteMembers(query);
    }
  }

  // MemberApplication operations
  async findMemberApplication(query) {
    if (this.useMongoDB) {
      const MemberApplication = require('../models/MemberApplication');
      return await MemberApplication.findOne(query);
    } else {
      return await this.mockDB.findMemberApplication(query);
    }
  }

  async findMemberApplications(query) {
    if (this.useMongoDB) {
      const MemberApplication = require('../models/MemberApplication');
      return await MemberApplication.find(query).sort({ appliedAt: -1 });
    } else {
      return await this.mockDB.findMemberApplications(query);
    }
  }

  async createMemberApplication(applicationData) {
    if (this.useMongoDB) {
      const MemberApplication = require('../models/MemberApplication');
      const application = new MemberApplication(applicationData);
      return await application.save();
    } else {
      return await this.mockDB.createMemberApplication(applicationData);
    }
  }

  async updateMemberApplication(applicationId, updateData) {
    if (this.useMongoDB) {
      const MemberApplication = require('../models/MemberApplication');
      return await MemberApplication.findByIdAndUpdate(applicationId, updateData, { new: true });
    } else {
      return await this.mockDB.updateMemberApplication(applicationId, updateData);
    }
  }

  // Password comparison
  async comparePassword(user, candidatePassword) {
    if (this.useMongoDB) {
      return await user.comparePassword(candidatePassword);
    } else {
      return await bcrypt.compare(candidatePassword, user.password);
    }
  }

  // Roster operations
  async findRoster(query) {
    if (this.useMongoDB) {
      const Roster = require('../models/Roster');
      return await Roster.findOne(query);
    } else {
      return await this.mockDB.findRoster(query);
    }
  }

  async findAllRosters(query = {}) {
    if (this.useMongoDB) {
      const Roster = require('../models/Roster');
      return await Roster.find(query);
    } else {
      return await this.mockDB.findAllRosters(query);
    }
  }

  async findActiveRoster(query) {
    if (this.useMongoDB) {
      // Ensure models are loaded
      const Roster = require('../models/Roster');
      const Member = require('../models/Member');
      const User = require('../models/User');
      
      return await Roster.findOne({ ...query, isActive: true, isArchived: false })
        .populate({
          path: 'members.member',
          populate: { 
            path: 'user',
            select: '-password' // Exclude password from user data
          }
        });
    } else {
      return await this.mockDB.findActiveRoster(query);
    }
  }

  async createRoster(rosterData) {
    if (this.useMongoDB) {
      const Roster = require('../models/Roster');
      const roster = new Roster(rosterData);
      return await roster.save();
    } else {
      return await this.mockDB.createRoster(rosterData);
    }
  }

  async updateRoster(rosterId, updateData) {
    if (this.useMongoDB) {
      const Roster = require('../models/Roster');
      return await Roster.findByIdAndUpdate(rosterId, updateData, { new: true });
    } else {
      return await this.mockDB.updateRoster(rosterId, updateData);
    }
  }

  async archiveRoster(rosterId, archivedBy) {
    if (this.useMongoDB) {
      const Roster = require('../models/Roster');
      return await Roster.findByIdAndUpdate(
        rosterId,
        { 
          isActive: false, 
          isArchived: true, 
          archivedAt: new Date(),
          archivedBy 
        },
        { new: true }
      );
    } else {
      return await this.mockDB.archiveRoster(rosterId, archivedBy);
    }
  }

  async addMemberToRoster(rosterId, memberId, addedBy) {
    if (this.useMongoDB) {
      const Roster = require('../models/Roster');
      return await Roster.findByIdAndUpdate(
        rosterId,
        { 
          $addToSet: { 
            members: { 
              member: memberId, 
              addedAt: new Date(), 
              addedBy,
              duesStatus: 'Unpaid'
            } 
          } 
        },
        { new: true }
      );
    } else {
      return await this.mockDB.addMemberToRoster(rosterId, memberId, addedBy);
    }
  }

  async removeMemberFromRoster(rosterId, memberId) {
    if (this.useMongoDB) {
      const Roster = require('../models/Roster');
      return await Roster.findByIdAndUpdate(
        rosterId,
        { 
          $pull: { 
            members: { member: memberId } 
          } 
        },
        { new: true }
      );
    } else {
      return await this.mockDB.removeMemberFromRoster(rosterId, memberId);
    }
  }

  async removeMemberFromRoster(rosterId, memberId) {
    if (this.useMongoDB) {
      const Roster = require('../models/Roster');
      return await Roster.findByIdAndUpdate(
        rosterId,
        { $pull: { members: { member: memberId } } },
        { new: true }
      );
    } else {
      return await this.mockDB.removeMemberFromRoster(rosterId, memberId);
    }
  }

  // Admin operations
  async findAdmin(query) {
    if (this.useMongoDB) {
      const Admin = require('../models/Admin');
      return await Admin.findOne(query);
    } else {
      return await this.mockDB.findAdmin(query);
    }
  }

  async findAdmins(query = {}) {
    if (this.useMongoDB) {
      const Admin = require('../models/Admin');
      return await Admin.find(query);
    } else {
      return await this.mockDB.findAdmins(query);
    }
  }

  async createAdmin(adminData) {
    if (this.useMongoDB) {
      const Admin = require('../models/Admin');
      const admin = new Admin(adminData);
      return await admin.save();
    } else {
      return await this.mockDB.createAdmin(adminData);
    }
  }

  async updateAdmin(query, updates) {
    if (this.useMongoDB) {
      const Admin = require('../models/Admin');
      return await Admin.findOneAndUpdate(query, updates, { new: true });
    } else {
      return await this.mockDB.updateAdmin(query, updates);
    }
  }

  async deleteAdmin(query) {
    if (this.useMongoDB) {
      const Admin = require('../models/Admin');
      return await Admin.findOneAndDelete(query);
    } else {
      return await this.mockDB.deleteAdmin(query);
    }
  }

  // CallSlot operations
  async findCallSlot(query) {
    if (this.useMongoDB) {
      const CallSlot = require('../models/CallSlot');
      return await CallSlot.findOne(query);
    } else {
      return await this.mockDB.findCallSlot(query);
    }
  }

  async findCallSlots(query = {}) {
    if (this.useMongoDB) {
      const CallSlot = require('../models/CallSlot');
      return await CallSlot.find(query);
    } else {
      return await this.mockDB.findCallSlots(query);
    }
  }

  async createCallSlot(callSlotData) {
    if (this.useMongoDB) {
      const CallSlot = require('../models/CallSlot');
      const callSlot = new CallSlot(callSlotData);
      return await callSlot.save();
    } else {
      return await this.mockDB.createCallSlot(callSlotData);
    }
  }

  async updateCallSlot(id, updates) {
    if (this.useMongoDB) {
      const CallSlot = require('../models/CallSlot');
      return await CallSlot.findByIdAndUpdate(id, updates, { new: true });
    } else {
      return await this.mockDB.updateCallSlot(id, updates);
    }
  }

  async deleteCallSlot(id) {
    if (this.useMongoDB) {
      const CallSlot = require('../models/CallSlot');
      return await CallSlot.findByIdAndDelete(id);
    } else {
      return await this.mockDB.deleteCallSlot(id);
    }
  }

  // Task operations
  async findTask(query) {
    if (this.useMongoDB) {
      const Task = require('../models/Task');
      return await Task.findOne(query);
    } else {
      return await this.mockDB.findTask(query);
    }
  }

  async findTasks(query = {}) {
    if (this.useMongoDB) {
      const Task = require('../models/Task');
      return await Task.find(query);
    } else {
      return await this.mockDB.findTasks(query);
    }
  }

  async createTask(taskData) {
    if (this.useMongoDB) {
      const Task = require('../models/Task');
      const task = new Task(taskData);
      return await task.save();
    } else {
      return await this.mockDB.createTask(taskData);
    }
  }

  async updateTask(id, updates) {
    if (this.useMongoDB) {
      const Task = require('../models/Task');
      return await Task.findByIdAndUpdate(id, updates, { new: true });
    } else {
      return await this.mockDB.updateTask(id, updates);
    }
  }

  async deleteTask(id) {
    if (this.useMongoDB) {
      const Task = require('../models/Task');
      return await Task.findByIdAndDelete(id);
    } else {
      return await this.mockDB.deleteTask(id);
    }
  }

  // Event operations
  async findEvents(query) {
    if (this.useMongoDB) {
      const Event = require('../models/Event');
      return await Event.find(query).populate('createdBy', 'firstName lastName email').populate('campId', 'name');
    } else {
      return await this.mockDB.findEvents(query);
    }
  }

  async findEvent(query) {
    if (this.useMongoDB) {
      const Event = require('../models/Event');
      return await Event.findOne(query).populate('createdBy', 'firstName lastName email').populate('campId', 'name');
    } else {
      return await this.mockDB.findEvent(query);
    }
  }

  async createEvent(eventData) {
    if (this.useMongoDB) {
      const Event = require('../models/Event');
      return await Event.create(eventData);
    } else {
      return await this.mockDB.createEvent(eventData);
    }
  }

  async updateEvent(id, updates) {
    if (this.useMongoDB) {
      const Event = require('../models/Event');
      return await Event.findByIdAndUpdate(id, updates, { new: true });
    } else {
      return await this.mockDB.updateEvent(id, updates);
    }
  }

  async deleteEvent(id) {
    if (this.useMongoDB) {
      const Event = require('../models/Event');
      return await Event.findByIdAndDelete(id);
    } else {
      return await this.mockDB.deleteEvent(id);
    }
  }


  // Invite operations
  async findInvite(query) {
    if (this.useMongoDB) {
      const Invite = require('../models/Invite');
      return await Invite.findOne(query);
    } else {
      return await this.mockDB.findInvite(query);
    }
  }

  async findInvites(query = {}) {
    if (this.useMongoDB) {
      const Invite = require('../models/Invite');
      return await Invite.find(query).populate('senderId', 'firstName lastName email').lean();
    } else {
      return await this.mockDB.findInvites(query);
    }
  }

  async createInvite(inviteData) {
    if (this.useMongoDB) {
      const Invite = require('../models/Invite');
      const invite = new Invite(inviteData);
      return await invite.save();
    } else {
      return await this.mockDB.createInvite(inviteData);
    }
  }

  async updateInviteById(id, updateData) {
    if (this.useMongoDB) {
      const Invite = require('../models/Invite');
      return await Invite.findByIdAndUpdate(id, updateData, { new: true });
    } else {
      return await this.mockDB.updateInviteById(id, updateData);
    }
  }

  async deleteInvite(id) {
    if (this.useMongoDB) {
      const Invite = require('../models/Invite');
      return await Invite.findByIdAndDelete(id);
    } else {
      return await this.mockDB.deleteInvite(id);
    }
  }

  async updateCampById(id, updateData) {
    if (this.useMongoDB) {
      const Camp = require('../models/Camp');
      return await Camp.findByIdAndUpdate(id, updateData, { new: true });
    } else {
      return await this.mockDB.updateCampById(id, updateData);
    }
  }

  // Set database mode

  // FAQ operations
  async findFAQs(query = {}) {
    if (this.useMongoDB) {
      const FAQ = require('../models/FAQ');
      return await FAQ.find(query).sort({ category: 1, order: 1 });
    } else {
      return await this.mockDB.findFAQs(query);
    }
  }

  async findFAQById(id) {
    if (this.useMongoDB) {
      const FAQ = require('../models/FAQ');
      return await FAQ.findById(id);
    } else {
      return await this.mockDB.findFAQById(id);
    }
  }

  async createFAQ(faqData) {
    if (this.useMongoDB) {
      const FAQ = require('../models/FAQ');
      const faq = new FAQ(faqData);
      return await faq.save();
    } else {
      return await this.mockDB.createFAQ(faqData);
    }
  }

  async updateFAQ(id, updateData) {
    if (this.useMongoDB) {
      const FAQ = require('../models/FAQ');
      return await FAQ.findByIdAndUpdate(id, updateData, { new: true });
    } else {
      return await this.mockDB.updateFAQ(id, updateData);
    }
  }

  async deleteFAQ(id) {
    if (this.useMongoDB) {
      const FAQ = require('../models/FAQ');
      return await FAQ.findByIdAndDelete(id);
    } else {
      return await this.mockDB.deleteFAQ(id);
    }
  }

  // Camp Category operations
  async findCampCategory(query) {
    if (this.useMongoDB) {
      const CampCategory = require('../models/CampCategory');
      return await CampCategory.findOne(query);
    } else {
      return await this.mockDB.findCampCategory(query);
    }
  }

  async findCampCategories(query = {}) {
    if (this.useMongoDB) {
      const CampCategory = require('../models/CampCategory');
      return await CampCategory.find(query);
    } else {
      return await this.mockDB.findCampCategories(query);
    }
  }

  async createCampCategory(categoryData) {
    if (this.useMongoDB) {
      const CampCategory = require('../models/CampCategory');
      const category = new CampCategory(categoryData);
      return await category.save();
    } else {
      return await this.mockDB.createCampCategory(categoryData);
    }
  }

  async updateCampCategory(id, updateData) {
    if (this.useMongoDB) {
      const CampCategory = require('../models/CampCategory');
      return await CampCategory.findByIdAndUpdate(id, updateData, { new: true });
    } else {
      return await this.mockDB.updateCampCategory(id, updateData);
    }
  }

  async deleteCampCategory(id) {
    if (this.useMongoDB) {
      const CampCategory = require('../models/CampCategory');
      return await CampCategory.findByIdAndDelete(id);
    } else {
      return await this.mockDB.deleteCampCategory(id);
    }
  }

  // GlobalPerk operations
  async findGlobalPerk(query = {}) {
    if (this.useMongoDB) {
      const GlobalPerk = require('../models/GlobalPerk');
      return await GlobalPerk.findOne(query);
    } else {
      return await this.mockDB.findGlobalPerk(query);
    }
  }

  async findGlobalPerks(query = {}) {
    if (this.useMongoDB) {
      const GlobalPerk = require('../models/GlobalPerk');
      return await GlobalPerk.find(query).sort({ name: 1 });
    } else {
      return await this.mockDB.findGlobalPerks(query);
    }
  }

  async createGlobalPerk(perkData) {
    if (this.useMongoDB) {
      const GlobalPerk = require('../models/GlobalPerk');
      const perk = new GlobalPerk(perkData);
      return await perk.save();
    } else {
      return await this.mockDB.createGlobalPerk(perkData);
    }
  }

  async updateGlobalPerk(id, updateData) {
    if (this.useMongoDB) {
      const GlobalPerk = require('../models/GlobalPerk');
      return await GlobalPerk.findByIdAndUpdate(id, updateData, { new: true });
    } else {
      return await this.mockDB.updateGlobalPerk(id, updateData);
    }
  }

  async deleteGlobalPerk(id) {
    if (this.useMongoDB) {
      const GlobalPerk = require('../models/GlobalPerk');
      return await GlobalPerk.findByIdAndDelete(id);
    } else {
      return await this.mockDB.deleteGlobalPerk(id);
    }
  }

  setMongoDBMode(useMongoDB) {
    this.useMongoDB = useMongoDB;
  }

  // ==================== Skills Methods ====================
  
  async findSkills(query = {}) {
    if (this.useMongoDB) {
      const Skill = require('../models/Skill');
      return await Skill.find(query).sort({ name: 1 });
    } else {
      return await this.mockDB.findSkills(query);
    }
  }

  async findSkillById(id) {
    if (this.useMongoDB) {
      const Skill = require('../models/Skill');
      return await Skill.findById(id);
    } else {
      return await this.mockDB.findSkillById(id);
    }
  }

  async findSkillByName(name) {
    if (this.useMongoDB) {
      const Skill = require('../models/Skill');
      return await Skill.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    } else {
      return await this.mockDB.findSkillByName(name);
    }
  }

  async createSkill(skillData) {
    if (this.useMongoDB) {
      const Skill = require('../models/Skill');
      const skill = new Skill(skillData);
      return await skill.save();
    } else {
      return await this.mockDB.createSkill(skillData);
    }
  }

  async updateSkill(id, updateData) {
    if (this.useMongoDB) {
      const Skill = require('../models/Skill');
      return await Skill.findByIdAndUpdate(id, updateData, { new: true });
    } else {
      return await this.mockDB.updateSkill(id, updateData);
    }
  }

  async deleteSkill(id) {
    if (this.useMongoDB) {
      const Skill = require('../models/Skill');
      return await Skill.findByIdAndDelete(id);
    } else {
      return await this.mockDB.deleteSkill(id);
    }
  }
}

// Singleton instance
const db = new DatabaseAdapter();

module.exports = db;
