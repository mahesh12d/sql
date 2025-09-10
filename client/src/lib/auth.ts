export const API_BASE_URL = '/api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
}

export interface ApiResponse<T = any> {
  message?: string;
  token?: string;
  user?: T;
  [key: string]: any;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.message || 'An error occurred');
  }

  return data;
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<ApiResponse> {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async register(credentials: RegisterCredentials): Promise<ApiResponse> {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async getCurrentUser(): Promise<any> {
    return apiRequest('/auth/user');
  },
};

export const problemsApi = {
  async getAll(difficulty?: string): Promise<any[]> {
    const query = difficulty ? `?difficulty=${difficulty}` : '';
    return apiRequest(`/problems${query}`);
  },

  async getById(id: string): Promise<any> {
    return apiRequest(`/problems/${id}`);
  },
};

export const submissionsApi = {
  async create(submission: { problemId: string; query: string }): Promise<any> {
    return apiRequest('/submissions', {
      method: 'POST',
      body: JSON.stringify(submission),
    });
  },

  async getUserSubmissions(userId: string): Promise<any[]> {
    return apiRequest(`/submissions/user/${userId}`);
  },
};

export const leaderboardApi = {
  async get(limit?: number): Promise<any[]> {
    const query = limit ? `?limit=${limit}` : '';
    return apiRequest(`/leaderboard${query}`);
  },
};

export const communityApi = {
  async getPosts(): Promise<any[]> {
    return apiRequest('/community/posts');
  },

  async createPost(post: { content: string; codeSnippet?: string }): Promise<any> {
    return apiRequest('/community/posts', {
      method: 'POST',
      body: JSON.stringify(post),
    });
  },

  async likePost(postId: string): Promise<void> {
    return apiRequest(`/community/posts/${postId}/like`, {
      method: 'POST',
    });
  },

  async unlikePost(postId: string): Promise<void> {
    return apiRequest(`/community/posts/${postId}/like`, {
      method: 'DELETE',
    });
  },

  async getComments(postId: string): Promise<any[]> {
    return apiRequest(`/community/posts/${postId}/comments`);
  },

  async createComment(postId: string, content: string): Promise<any> {
    return apiRequest(`/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};

export const badgesApi = {
  async getUserBadges(userId: string): Promise<any[]> {
    return apiRequest(`/badges/user/${userId}`);
  },
};

export { ApiError };
