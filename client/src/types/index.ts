export interface User {
  _id: number;
  email: string;
  accountType: 'personal' | 'camp' | 'admin';
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  city?: string;
  yearsBurned?: number;
  previousCamps?: string;
  bio?: string;
  playaName?: string;
  profilePhoto?: string;
  photos?: string[];
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
  skills?: string[];
  interests?: string[];
  burningManExperience?: 'first-timer' | '1-2-years' | '3-5-years' | '5+ years' | 'veteran';
  hasTicket?: boolean;
  hasVehiclePass?: boolean;
  arrivalDate?: string | Date;
  departureDate?: string | Date;
  interestedInEAP?: boolean;
  interestedInStrike?: boolean;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  campId?: string; // MongoDB ObjectId reference to Camp
  campName?: string;
  campBio?: string;
  campPhotos?: string[];
  campSocialMedia?: SocialMediaLink[];
  campLocation?: {
    city?: string;
    state?: string;
    country?: string;
  };
  campTheme?: string;
  campSize?: 'small' | 'medium' | 'large' | 'mega';
  campYearFounded?: number;
  campWebsite?: string;
  campEmail?: string;
  urlSlug?: string; // URL slug for camp or personal profile
  isActive: boolean;
  isVerified: boolean;
  lastLogin?: string;
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'private';
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface SocialMediaLink {
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'website' | 'youtube' | 'tiktok';
  url: string;
}

export interface Camp {
  _id: number;
  owner: number | User;
  name: string;
  slug: string;
  description: string;
  bio?: string;
  theme?: string;
  yearFounded?: number;
  campSize: 'small' | 'medium' | 'large' | 'mega';
  maxMembers: number;
  location: {
    city?: string;
    state?: string;
    country: string;
    playaLocation?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  photos: CampPhoto[];
  videos?: CampVideo[];
  socialMedia: SocialMediaLink[];
  contactEmail: string;
  website?: string;
  phone?: string;
  offerings: string[];
  customOfferings?: string[];
  requirements: {
    minAge: number;
    dues: {
      amount?: number;
      currency: string;
      description?: string;
    };
    workShifts: {
      required: boolean;
      hours?: number;
      description?: string;
    };
    skills?: string[];
    experience: 'any' | 'first-timer-friendly' | 'experienced-preferred' | 'veterans-only';
  };
  status: 'active' | 'inactive' | 'suspended' | 'archived';
  isRecruiting: boolean;
  isPublic: boolean;
  stats: {
    totalMembers: number;
    totalApplications: number;
    acceptanceRate: number;
  };
  settings: {
    allowMemberInvites: boolean;
    requireApproval: boolean;
    autoApprove: boolean;
    notifications: {
      newApplications: boolean;
      memberUpdates: boolean;
      messages: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface CampPhoto {
  url: string;
  caption?: string;
  isPrimary: boolean;
}

export interface CampVideo {
  url: string;
  platform: 'youtube' | 'vimeo' | 'direct';
  caption?: string;
}


export interface Member {
  _id: number;
  camp: number | Camp;
  user: number | User;
  role: 'member' | 'project-lead' | 'camp-lead';
  status: 'pending' | 'active' | 'inactive' | 'suspended' | 'rejected';
  applicationData: Record<string, any>;
  appliedAt: string;
  reviewedAt?: string;
  reviewedBy?: string | User;
  reviewNotes?: string;
  nickname?: string;
  bio?: string;
  playaName?: string;
  skills?: string[];
  interests?: string[];
  duesPaid?: boolean;
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  contactPreferences: {
    email: boolean;
    phone: boolean;
    text: boolean;
  };
  projects: Project[];
  contributions: Contribution[];
  roleHistory: RoleChange[];
  attendance: {
    confirmed: boolean;
    arrivalDate?: string;
    departureDate?: string;
    transportation?: 'driving' | 'flying' | 'bus' | 'other';
    vehicleInfo?: string;
    needs?: string[];
  };
  dues: {
    amount?: number;
    currency: string;
    paid: boolean;
    paidAt?: string;
    paymentMethod?: string;
    notes?: string;
  };
  workShifts: WorkShift[];
  notes: MemberNote[];
  settings: {
    notifications: {
      announcements: boolean;
      messages: boolean;
      reminders: boolean;
    };
    privacy: {
      showContactInfo: boolean;
      showContributions: boolean;
    };
  };
  // Roster-specific overrides (for roster view only, doesn't affect user account)
  overrides?: {
    playaName?: string;
    yearsBurned?: number;
    skills?: string[];
    hasTicket?: boolean;
    hasVehiclePass?: boolean;
    interestedInEAP?: boolean;
    interestedInStrike?: boolean;
    arrivalDate?: string | Date;
    departureDate?: string | Date;
    city?: string;
    state?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  isLead: boolean;
}

export interface Contribution {
  type: 'work-shift' | 'resource' | 'skill' | 'financial' | 'other';
  title: string;
  description?: string;
  hours?: number;
  value?: number;
  currency?: string;
  date: string;
  status: 'pending' | 'completed' | 'verified' | 'disputed';
  verifiedBy?: string | User;
  verifiedAt?: string;
  notes?: string;
}

export interface RoleChange {
  fromRole?: 'member' | 'project-lead' | 'camp-lead';
  toRole: 'member' | 'project-lead' | 'camp-lead';
  changedBy: string | User;
  reason?: string;
  effectiveDate: string;
  approvedBy?: string | User;
  status: 'pending' | 'approved' | 'rejected';
}

export interface WorkShift {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  required: boolean;
  completed: boolean;
  completedAt?: string;
  verifiedBy?: string | User;
}

export interface MemberNote {
  content: string;
  addedBy: string | User;
  addedAt: string;
  isPrivate: boolean;
}

export interface Admin {
  _id: number;
  user: number | User;
  role: 'super-admin' | 'moderator' | 'support';
  permissions: {
    userManagement: boolean;
    campManagement: boolean;
    systemSettings: boolean;
    analytics: boolean;
    support: boolean;
  };
  isActive: boolean;
  createdBy?: string | User;
  lastLogin?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ isFirstLogin?: boolean }>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

export interface RegisterData {
  email: string;
  password: string;
  accountType: 'personal' | 'camp';
  firstName?: string;
  lastName?: string;
  campName?: string;
}

export interface CallSlot {
  _id: string;
  campId: string;
  startTime: string;
  endTime: string;
  date: string;
  isAvailable: boolean;
  maxParticipants: number;
  currentParticipants: number;
  participants: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  _id?: string;
  user: User;
  text: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  campId: string;
  title: string;
  description: string;
  assignedTo: string[] | User[];  // Can be IDs or populated User objects
  watchers?: string[] | User[];   // Can be IDs or populated User objects
  comments?: TaskComment[];
  dueDate?: string;
  status: 'open' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  createdBy: string | User;  // Can be ID or populated User object
  updatedAt: string;
  completedAt?: string;
  completedBy?: string | User;  // Can be ID or populated User object
  type?: string;
  metadata?: {
    eventId?: string;
    shiftId?: string;
    eventName?: string;
    shiftTitle?: string;
  };
}

export interface ApiResponse<T = any> {
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalPages: number;
  currentPage: number;
  total: number;
}

// Volunteer Shifts Data Models
export interface Event {
  _id: string;
  eventName: string;
  campId: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number; // User ID who created the event
  shifts: Shift[];
}

export interface Shift {
  _id: string;
  eventId: string;
  title: string;
  description: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  maxSignUps: number;
  memberIds: number[]; // Array of user IDs who signed up
  createdAt: Date;
  updatedAt: Date;
  createdBy: number; // User ID who created the shift
}

export interface ShiftSignUp {
  _id: string;
  shiftId: string;
  memberId: number;
  signedUpAt: Date;
  status: 'confirmed' | 'cancelled';
}
