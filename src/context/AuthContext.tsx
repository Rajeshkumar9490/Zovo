import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types.js';
import { api, getStoredToken, setStoredToken, removeStoredToken } from '../lib/api.js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  guestQuestionsUsed: number;
  guestUploadsUsed: number;
  maxGuestQuestions: number;
  maxGuestUploads: number;
  canAskQuestion: () => boolean;
  canUploadFile: (count?: number) => boolean;
  recordQuestion: () => void;
  recordUpload: (count?: number) => void;
  authModalOpen: boolean;
  authModalMode: 'login' | 'register';
  authModalReason: string | null;
  openAuthModal: (mode?: 'login' | 'register', reason?: string) => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
  updateProfile: (data: { name?: string; avatar?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
}

const MAX_GUEST_QUESTIONS = 5;
const MAX_GUEST_UPLOADS = 5;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);

  // Guest usage counts persisted in localStorage
  const [guestQuestionsUsed, setGuestQuestionsUsed] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('zovo_guest_questions_used');
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [guestUploadsUsed, setGuestUploadsUsed] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('zovo_guest_uploads_used');
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  // Determine if active user is a guest / demo session
  const isGuest = Boolean(!user || user.email.endsWith('@guest.zovo.ai') || user.email === 'guest@zovo.ai' || user.id === 'demo-user-zovo');

  useEffect(() => {
    async function loadSession() {
      let token: string | null;
      try { token = getStoredToken(); } catch { setIsLoading(false); return; }
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.getMe();
        setUser(data.user);
      } catch (err) {
        removeStoredToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, []);

  const openAuthModal = (mode: 'login' | 'register' = 'login', reason?: string) => {
    setAuthModalMode(mode);
    setAuthModalReason(reason || null);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthModalReason(null);
  };

  const canAskQuestion = (): boolean => {
    return !isGuest || guestQuestionsUsed < MAX_GUEST_QUESTIONS;
  };

  const canUploadFile = (count = 1): boolean => {
    return !isGuest || guestUploadsUsed + count <= MAX_GUEST_UPLOADS;
  };

  const recordQuestion = () => {
    if (!isGuest) return;
    setGuestQuestionsUsed((prev) => {
      const updated = prev + 1;
      try {
        localStorage.setItem('zovo_guest_questions_used', updated.toString());
      } catch {}
      return updated;
    });
  };

  const recordUpload = (count = 1) => {
    if (!isGuest) return;
    setGuestUploadsUsed((prev) => {
      const updated = prev + count;
      try {
        localStorage.setItem('zovo_guest_uploads_used', updated.toString());
      } catch {}
      return updated;
    });
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      setStoredToken(res.token);
      setUser(res.user);
      closeAuthModal();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const res = await api.register(email, password, name);
      setStoredToken(res.token);
      setUser(res.user);
      closeAuthModal();
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async () => {
    setIsLoading(true);
    try {
      const res = await api.demoLogin();
      setStoredToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    removeStoredToken();
    setUser(null);
  };

  const updateProfile = async (data: { name?: string; avatar?: string; currentPassword?: string; newPassword?: string }) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        isGuest,
        guestQuestionsUsed,
        guestUploadsUsed,
        maxGuestQuestions: MAX_GUEST_QUESTIONS,
        maxGuestUploads: MAX_GUEST_UPLOADS,
        canAskQuestion,
        canUploadFile,
        recordQuestion,
        recordUpload,
        authModalOpen,
        authModalMode,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        demoLogin,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
