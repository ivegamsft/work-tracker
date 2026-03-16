import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeUserFromToken(token: string): User {
  const [, payload] = token.split('.');

  if (!payload) {
    throw new Error('Invalid token');
  }

  const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;
  const emailPrefix = decodedPayload.email.split('@')[0] || decodedPayload.email;

  return {
    id: decodedPayload.id,
    email: decodedPayload.email,
    name: emailPrefix,
    role: decodedPayload.role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    const user = decodeUserFromToken(response.accessToken);

    localStorage.setItem('token', response.accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    navigate('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
