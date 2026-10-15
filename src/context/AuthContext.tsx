import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User } from '../types.js';
import { api, getStoredToken, setStoredToken, removeStoredToken } from '../lib/api.js';
import { cacheSession, clearCachedSession, readCachedSession, revalidateSession, SESSION_CHECK_TIMEOUT_MS } from '../lib/session.js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  startupError: string | null;
  retrySession: () => void;
  sessionValidationVersion: number;
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
  const [initialSession] = useState(() => {
    try {
      const token = getStoredToken();
      return { token, user: readCachedSession(token) };
    } catch { return { token: null, user: null }; }
  });
  const [user, setUser] = useState<User | null>(initialSession.user);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(initialSession.token && !initialSession.user));
  const [startupError, setStartupError] = useState<string | null>(null);
  const [sessionRetry, setSessionRetry] = useState(0);
  const [sessionValidationVersion, setSessionValidationVersion] = useState(0);
  const sessionControllerRef = useRef<AbortController | null>(null);
  const presentedSessionRef = useRef(initialSession.user && initialSession.token ? { token: initialSession.token, user: initialSession.user } : null);
  const authVersionRef = useRef(0);
  const mountedRef = useRef(true);
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
    mountedRef.current = true;
    const controller = new AbortController();
    sessionControllerRef.current = controller;
    const version = authVersionRef.current;
    async function loadSession() {
      let token: string | null;
      try { token = getStoredToken(); } catch { setIsLoading(false); return; }
      if (!token) {
        presentedSessionRef.current = null;
        setUser(null);
        setStartupError(null);
        setIsLoading(false);
        return;
      }

      const cachedUser = readCachedSession(token);
      const previewUser = cachedUser || (presentedSessionRef.current?.token === token ? presentedSessionRef.current.user : null);
      presentedSessionRef.current = previewUser ? { token, user: previewUser } : null;
      setUser(previewUser);
      setIsLoading(!previewUser);
      setStartupError(null);
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(SESSION_CHECK_TIMEOUT_MS)]);
      const result = await revalidateSession(async () => (await api.getMe(signal)).user, controller.signal);
      if (controller.signal.aborted || authVersionRef.current !== version) return;
      try {
        if (getStoredToken() !== token) {
          setSessionRetry(previous => previous + 1);
          return;
        }
      } catch {
        setStartupError('Zovo could not access your saved session. Please try again.');
        setIsLoading(false);
        return;
      }

      if (result.status === 'valid') {
        presentedSessionRef.current = { token, user: result.user };
        setUser(result.user);
        cacheSession(token, result.user);
        setSessionValidationVersion(previous => previous + 1);
      } else if (result.status === 'invalid') {
        try { removeStoredToken(); } catch {}
        clearCachedSession();
        presentedSessionRef.current = null;
        setUser(null);
      } else if (result.status === 'unavailable') {
        setStartupError('Zovo could not check your session. Please check your connection and retry.');
      }
      setIsLoading(false);
    }

    void loadSession();
    return () => {
      mountedRef.current = false;
      controller.abort();
      if (sessionControllerRef.current === controller) sessionControllerRef.current = null;
    };
  }, [sessionRetry]);

  const retrySession = () => setSessionRetry(previous => previous + 1);

  const beginAuthChange = () => {
    sessionControllerRef.current?.abort();
    const version = ++authVersionRef.current;
    setStartupError(null);
    setIsLoading(true);
    return version;
  };

  const saveAuthenticatedSession = (token: string, authenticatedUser: User) => {
    setStoredToken(token);
    cacheSession(token, authenticatedUser);
    presentedSessionRef.current = { token, user: authenticatedUser };
    setUser(authenticatedUser);
    setSessionValidationVersion(previous => previous + 1);
  };

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
    const version = beginAuthChange();
    try {
      const res = await api.login(email, password);
      if (!mountedRef.current || authVersionRef.current !== version) return;
      saveAuthenticatedSession(res.token, res.user);
      closeAuthModal();
    } finally {
      if (mountedRef.current && authVersionRef.current === version) setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    const version = beginAuthChange();
    try {
      const res = await api.register(email, password, name);
      if (!mountedRef.current || authVersionRef.current !== version) return;
      saveAuthenticatedSession(res.token, res.user);
      closeAuthModal();
    } finally {
      if (mountedRef.current && authVersionRef.current === version) setIsLoading(false);
    }
  };

  const demoLogin = async () => {
    const version = beginAuthChange();
    try {
      const res = await api.demoLogin();
      if (!mountedRef.current || authVersionRef.current !== version) return;
      saveAuthenticatedSession(res.token, res.user);
    } finally {
      if (mountedRef.current && authVersionRef.current === version) setIsLoading(false);
    }
  };

  const logout = () => {
    sessionControllerRef.current?.abort();
    authVersionRef.current++;
    try { removeStoredToken(); } catch {}
    clearCachedSession();
    presentedSessionRef.current = null;
    setUser(null);
    setStartupError(null);
    setIsLoading(false);
  };

  const updateProfile = async (data: { name?: string; avatar?: string; currentPassword?: string; newPassword?: string }) => {
    const token = getStoredToken();
    const version = authVersionRef.current;
    const res = await api.updateProfile(data);
    if (mountedRef.current && authVersionRef.current === version && getStoredToken() === token) {
      setUser(res.user);
      if (token) {
        presentedSessionRef.current = { token, user: res.user };
        cacheSession(token, res.user);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        startupError,
        retrySession,
        sessionValidationVersion,
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
