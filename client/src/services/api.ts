import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { User, Camp, Member, Admin, RegisterData, ApiResponse, PaginatedResponse, CallSlot, Task } from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    const baseURL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5001/api';
    
    console.log('🚀 [DEBUG] API Service initialized with baseURL:', baseURL);
    
    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });

    // Request interceptor to add auth token and normalize paths
    this.api.interceptors.request.use(
      (config) => {
        // Normalize URL path to prevent double /api prefix
        if (config.url) {
          const baseURL = this.api.defaults.baseURL || '';
          // If baseURL ends with /api and url starts with /api, remove the leading /api from url
          if (baseURL.endsWith('/api') && config.url.startsWith('/api/')) {
            config.url = config.url.replace(/^\/api/, '');
            console.log('🔧 [API Interceptor] Normalized path to prevent double /api prefix:', config.url);
          }
          // Also handle case where url starts with /api/ but baseURL doesn't end with /api
          // This shouldn't happen, but handle it gracefully
          if (!baseURL.endsWith('/api') && config.url.startsWith('/api/')) {
            // Keep the /api prefix if baseURL doesn't have it
            // This is fine
          }
        }

        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          
          // Log token info for debugging (only first/last few chars for security)
          console.log('🔑 [API Interceptor] Token present:', 
            `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
          );
          
          // Try to decode JWT to check expiration (without verifying signature)
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            const expiresIn = payload.exp - now;
            
            if (expiresIn < 0) {
              console.warn('⚠️ [API Interceptor] Token appears to be expired!', {
                expired: new Date(payload.exp * 1000).toISOString(),
                now: new Date(now * 1000).toISOString()
              });
            } else if (expiresIn < 300) { // Less than 5 minutes
              console.warn('⚠️ [API Interceptor] Token expires soon:', expiresIn, 'seconds');
            } else {
              console.log('✅ [API Interceptor] Token valid for:', Math.floor(expiresIn / 60), 'minutes');
            }
          } catch (e) {
            console.error('❌ [API Interceptor] Could not decode token:', e);
          }
        } else {
          console.warn('⚠️ [API Interceptor] No token found in localStorage');
        }
        
        console.log('🔄 [API Interceptor] Request:', config.method?.toUpperCase(), config.url);
        if (config.data) {
          console.log('🔄 [API Interceptor] Request Data:', JSON.stringify(config.data, null, 2));
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response) => {
        console.log('✅ [API Interceptor] Response:', response.config.method?.toUpperCase(), response.config.url);
        console.log('✅ [API Interceptor] Response Data:', JSON.stringify(response.data, null, 2));
        return response;
      },
      (error) => {
        console.error('❌ [API Interceptor] Error:', error.response?.status, error.response?.data);
        
        if (error.response?.status === 401 || error.response?.status === 403) {
          const errorMessage = error.response?.data?.message || '';
          console.error('❌ [API Interceptor] Auth error:', errorMessage);
          
          // Only redirect to login if it's specifically a token issue
          // Don't redirect for other 403 errors (like permission denied)
          if (errorMessage.includes('Invalid or expired token') || 
              errorMessage.includes('Access token required') ||
              errorMessage === 'Invalid token') {
            console.warn('⚠️ [API Interceptor] Token invalid, clearing and redirecting to login');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Don't redirect if already on login page
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          } else {
            // For other auth errors, let the component handle them
            console.log('ℹ️ [API Interceptor] Auth error will be handled by component:', errorMessage);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<{ token: string; user: User; isFirstLogin?: boolean }> {
    console.log('🔐 [DEBUG] API Service - Login attempt:', { email, baseURL: this.api.defaults.baseURL });
    try {
      const response: AxiosResponse<{ token: string; user: User; isFirstLogin?: boolean }> = await this.api.post('/auth/login', {
        email,
        password,
      });
      console.log('✅ [DEBUG] API Service - Login successful:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [DEBUG] API Service - Login failed:', error);
      console.error('❌ [DEBUG] Error details:', error.response?.data);
      throw error;
    }
  }

  async register(userData: RegisterData): Promise<{ token: string; user: User; isNewAccount?: boolean }> {
    const response: AxiosResponse<{ token: string; user: User; isNewAccount?: boolean }> = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async getCurrentUser(): Promise<{ user: User }> {
    const response: AxiosResponse<{ user: User }> = await this.api.get('/auth/me');
    return response.data;
  }

  async refreshToken(): Promise<{ token: string }> {
    const response: AxiosResponse<{ token: string }> = await this.api.post('/auth/refresh');
    return response.data;
  }

  // User endpoints
  async getUserProfile(): Promise<{ user: User }> {
    const response: AxiosResponse<{ user: User }> = await this.api.get('/users/profile');
    return response.data;
  }

  async updateUserProfile(userData: Partial<User>): Promise<{ user: User }> {
    console.log('🔄 [API] updateUserProfile called with:', userData);
    console.log('🔄 [API] playaName in request:', userData.playaName);
    const response: AxiosResponse<{ user: User }> = await this.api.put('/users/profile', userData);
    console.log('✅ [API] updateUserProfile response:', response.data);
    console.log('✅ [API] playaName in response:', response.data.user?.playaName);
    return response.data;
  }


  async updatePreferences(preferences: any): Promise<{ preferences: any }> {
    const response: AxiosResponse<{ preferences: any }> = await this.api.put('/users/preferences', preferences);
    return response.data;
  }

  async searchUsers(params: {
    q?: string;
    location?: string;
    skills?: string;
    experience?: string;
  }): Promise<{ users: User[] }> {
    const response: AxiosResponse<{ users: User[] }> = await this.api.get('/users/search', { params });
    return response.data;
  }

  // Camp endpoints
  async getCamps(params?: {
    page?: number;
    limit?: number;
    search?: string;
    location?: string;
    theme?: string;
    size?: string;
    recruiting?: boolean;
  }): Promise<PaginatedResponse<Camp>> {
    const response: AxiosResponse<PaginatedResponse<Camp>> = await this.api.get('/camps', { params });
    return response.data;
  }

  async getCamp(id: string): Promise<{ camp: Camp }> {
    const response: AxiosResponse<{ camp: Camp }> = await this.api.get(`/camps/${id}`);
    return response.data;
  }

  async createCamp(campData: Partial<Camp>): Promise<{ camp: Camp }> {
    const response: AxiosResponse<{ camp: Camp }> = await this.api.post('/camps', campData);
    return response.data;
  }

  async getMyCamp(): Promise<Camp> {
    const response: AxiosResponse<Camp> = await this.api.get('/camps/my-camp');
    return response.data;
  }


  async deleteCamp(id: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/camps/${id}`);
    return response.data;
  }

  async getCampMembers(campId: string): Promise<{ members: Member[] }> {
    const response: AxiosResponse<{ members: Member[] }> = await this.api.get(`/role-management/camp/${campId}/members`);
    return response.data;
  }

  async getCampSignupForm(campId: string): Promise<{ campName: string; signupForm: any }> {
    const response: AxiosResponse<{ campName: string; signupForm: any }> = await this.api.get(`/camps/${campId}/signup-form`);
    return response.data;
  }

  async updateCampSignupForm(campId: string, signupForm: any): Promise<{ signupForm: any }> {
    const response: AxiosResponse<{ signupForm: any }> = await this.api.put(`/camps/${campId}/signup-form`, signupForm);
    return response.data;
  }

  // Member endpoints
  async applyToCamp(campId: string, applicationData: Record<string, any>): Promise<{ member: Member }> {
    const response: AxiosResponse<{ member: Member }> = await this.api.post('/members/apply', {
      campId,
      applicationData,
    });
    return response.data;
  }

  async getMyApplications(): Promise<{ applications: Member[] }> {
    const response: AxiosResponse<{ applications: Member[] }> = await this.api.get('/members/my-applications');
    return response.data;
  }

  async approveMember(memberId: string, status: 'active' | 'rejected', reviewNotes?: string): Promise<{ member: Member }> {
    const response: AxiosResponse<{ member: Member }> = await this.api.put(`/members/${memberId}/approve`, {
      status,
      reviewNotes,
    });
    return response.data;
  }

  async changeMemberRole(memberId: string, newRole: 'member' | 'project-lead' | 'camp-lead', reason?: string): Promise<{ member: Member }> {
    const response: AxiosResponse<{ member: Member }> = await this.api.put(`/members/${memberId}/role`, {
      newRole,
      reason,
    });
    return response.data;
  }

  async updateMemberStatus(memberId: string, status: 'active' | 'inactive' | 'suspended', reason?: string): Promise<{ member: Member }> {
    const response: AxiosResponse<{ member: Member }> = await this.api.put(`/members/${memberId}/status`, {
      status,
      reason,
    });
    return response.data;
  }

  async addMemberContribution(memberId: string, contribution: any): Promise<{ contribution: any }> {
    const response: AxiosResponse<{ contribution: any }> = await this.api.post(`/members/${memberId}/contributions`, contribution);
    return response.data;
  }

  async getMember(memberId: string): Promise<{ member: Member }> {
    const response: AxiosResponse<{ member: Member }> = await this.api.get(`/members/${memberId}`);
    return response.data;
  }

  // Upload endpoints
  async uploadProfilePhoto(file: File): Promise<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    
    const response: AxiosResponse<{ photoUrl: string }> = await this.api.post('/upload/profile-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      transformRequest: [(data) => data], // Don't transform FormData
    });
    return response.data;
  }

  async uploadCampPhotos(files: File[]): Promise<{ photos: string[] }> {
    const formData = new FormData();
    files.forEach(file => formData.append('photos', file));
    const response: AxiosResponse<{ photos: string[] }> = await this.api.post('/upload/camp-photos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async uploadCampPhoto(campId: string, file: File, caption?: string, isPrimary?: boolean): Promise<{ photo: any }> {
    const formData = new FormData();
    formData.append('photo', file);
    if (caption) formData.append('caption', caption);
    if (isPrimary) formData.append('isPrimary', isPrimary.toString());
    
    const response: AxiosResponse<{ photo: any }> = await this.api.post(`/upload/camp-photo/${campId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deletePhoto(publicId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/upload/photo/${publicId}`);
    return response.data;
  }

  // Admin endpoints
  async getAdminDashboard(): Promise<any> {
    const response: AxiosResponse<any> = await this.api.get('/admin/dashboard');
    return response.data;
  }

  async getAdminUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    accountType?: string;
    status?: string;
  }): Promise<PaginatedResponse<User>> {
    const response: AxiosResponse<PaginatedResponse<User>> = await this.api.get('/admin/users', { params });
    return response.data;
  }

  async getAdminCamps(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    recruiting?: boolean;
  }): Promise<PaginatedResponse<Camp>> {
    const response: AxiosResponse<PaginatedResponse<Camp>> = await this.api.get('/admin/camps', { params });
    return response.data;
  }

  async updateUserStatus(userId: string, isActive: boolean): Promise<{ user: User }> {
    const response: AxiosResponse<{ user: User }> = await this.api.put(`/admin/users/${userId}/status`, { isActive });
    return response.data;
  }

  async updateCampStatus(campId: string, status: string): Promise<{ camp: Camp }> {
    const response: AxiosResponse<{ camp: Camp }> = await this.api.put(`/admin/camps/${campId}/status`, { status });
    return response.data;
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<{ user: User }> {
    const response: AxiosResponse<{ user: User }> = await this.api.put(`/admin/users/${userId}`, userData);
    return response.data;
  }

  async updateCamp(campId: string, campData: Partial<Camp>): Promise<{ camp: Camp }> {
    const response: AxiosResponse<{ camp: Camp }> = await this.api.put(`/admin/camps/${campId}`, campData);
    return response.data;
  }

  async uploadAdminCampPhoto(campId: string, formData: FormData): Promise<{ photo: string; camp: Camp }> {
    const response: AxiosResponse<{ photo: string; camp: Camp }> = await this.api.post(`/admin/camps/${campId}/upload-photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async createAdmin(userId: string, role: string, permissions?: any): Promise<{ admin: Admin }> {
    const response: AxiosResponse<{ admin: Admin }> = await this.api.post('/admin/admins', {
      userId,
      role,
      permissions,
    });
    return response.data;
  }

  async getAdmins(): Promise<{ admins: Admin[] }> {
    const response: AxiosResponse<{ admins: Admin[] }> = await this.api.get('/admin/admins');
    return response.data;
  }

  async removeAdmin(adminId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/admin/admins/${adminId}`);
    return response.data;
  }

  // Role Management endpoints
  async getRoleHierarchy(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/role-management/roles/hierarchy');
    return response.data;
  }


  async getRoleChangeRequests(campId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/role-management/camp/${campId}/role-requests`);
    return response.data;
  }

  async updateMemberRole(memberId: string, roleData: { newRole: string; reason: string; campId: string }): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.put(`/role-management/members/${memberId}/role`, roleData);
    return response.data;
  }

  async requestRoleChange(memberId: string, requestData: { requestedRole: string; reason: string }): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post(`/role-management/members/${memberId}/request-role-change`, requestData);
    return response.data;
  }

  // Generic HTTP methods for direct API calls
  // Change email
  async changeEmail(newEmail: string, password: string): Promise<{ user: User }> {
    const response: AxiosResponse<{ user: User }> = await this.api.put('/users/change-email', {
      newEmail,
      password
    });
    return response.data;
  }

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.put('/users/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  }


  // Call Slot methods
  async getCallSlots(campId: string): Promise<CallSlot[]> {
    const response: AxiosResponse<CallSlot[]> = await this.api.get(`/call-slots/camp/${campId}`);
    return response.data;
  }

  async createCallSlot(callSlotData: any): Promise<CallSlot> {
    const response: AxiosResponse<CallSlot> = await this.api.post('/call-slots', callSlotData);
    return response.data;
  }

  async updateCallSlot(id: string, updates: any): Promise<CallSlot> {
    const response: AxiosResponse<CallSlot> = await this.api.put(`/call-slots/${id}`, updates);
    return response.data;
  }

  async deleteCallSlot(id: string): Promise<void> {
    await this.api.delete(`/call-slots/${id}`);
  }

  async getAvailableCallSlots(campId: string): Promise<CallSlot[]> {
    const response: AxiosResponse<CallSlot[]> = await this.api.get(`/call-slots/available/${campId}`);
    return response.data;
  }

  // Task methods
  async getTasks(campId: string): Promise<Task[]> {
    const response: AxiosResponse<Task[]> = await this.api.get(`/tasks/camp/${campId}`);
    return response.data;
  }

  async getTaskByCode(taskIdCode: string): Promise<Task> {
    const response: AxiosResponse<Task> = await this.api.get(`/tasks/code/${taskIdCode}`);
    return response.data;
  }

  async getAssignedTasks(userId: string): Promise<Task[]> {
    const response: AxiosResponse<Task[]> = await this.api.get(`/tasks/assigned/${userId}`);
    return response.data;
  }

  async createTask(taskData: any): Promise<Task> {
    const response: AxiosResponse<Task> = await this.api.post('/tasks', taskData);
    return response.data;
  }

  async updateTask(id: string, updates: any): Promise<Task> {
    const response: AxiosResponse<Task> = await this.api.put(`/tasks/${id}`, updates);
    return response.data;
  }

  async deleteTask(id: string): Promise<void> {
    await this.api.delete(`/tasks/${id}`);
  }

  async assignTask(id: string, assignedTo: string[]): Promise<Task> {
    const response: AxiosResponse<Task> = await this.api.post(`/tasks/${id}/assign`, { assignedTo });
    return response.data;
  }

  async postTaskComment(taskId: string, text: string): Promise<any> {
    const response: AxiosResponse<any> = await this.api.post(`/tasks/${taskId}/comments`, { text });
    return response.data;
  }

  // Invite methods
  async getInviteTemplates(campId: string): Promise<{inviteTemplateEmail: string, inviteTemplateSMS: string}> {
    const response = await this.api.get(`/camps/${campId}/invites/template`);
    return response.data;
  }

  async updateInviteTemplates(campId: string, templates: {inviteTemplateEmail: string, inviteTemplateSMS: string}): Promise<any> {
    const response = await this.api.put(`/camps/${campId}/invites/template`, templates);
    return response.data;
  }

  async sendInvites(inviteData: {recipients: string[], method: 'email' | 'sms', campId: string}): Promise<any> {
    const response = await this.api.post('/invites', inviteData);
    return response.data;
  }

  async getCampInvites(campId: string, status?: string): Promise<any> {
    const url = status ? `/camps/${campId}/invites?status=${status}` : `/camps/${campId}/invites`;
    const response = await this.api.get(url);
    return response.data;
  }

  // Generic HTTP methods
  async get(url: string, config?: any): Promise<any> {
    const response = await this.api.get(url, config);
    return response.data;
  }

  async post(url: string, data?: any, config?: any): Promise<any> {
    const response = await this.api.post(url, data, config);
    return response.data;
  }

  async put(url: string, data?: any, config?: any): Promise<any> {
    console.log('🔄 [API] PUT request to:', url, 'with data:', data);
    const response = await this.api.put(url, data, config);
    console.log('✅ [API] PUT response:', response.data);
    return response.data;
  }

  async patch(url: string, data?: any, config?: any): Promise<any> {
    const response = await this.api.patch(url, data, config);
    return response.data;
  }

  async delete(url: string, config?: any): Promise<any> {
    const response = await this.api.delete(url, config);
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;
