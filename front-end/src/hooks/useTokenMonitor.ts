import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '@/store/authStore';
import { showToast } from '@/utils/toastHelper';

export const useTokenMonitor = (warningThresholdSeconds = 60) => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Initialized in effect to avoid impure Date.now() during render
  const mockExpirationRef = useRef<number>(0);

  const extendSession = () => {
    // Simulate refreshing of JWT token (resets mock timer and alerts success)
    mockExpirationRef.current = Date.now() + 5 * 60 * 1000;
    setShowWarningModal(false);
    setSecondsRemaining(300);
    showToast.success('Sua sessão foi estendida com sucesso por mais 5 minutos.');
  };

  const logoutSession = () => {
    setShowWarningModal(false);
    setSecondsRemaining(null);
    logout();
    showToast.info('Sessão encerrada com segurança.');
    navigate('/login');
  };

  useEffect(() => {
    if (!mockExpirationRef.current) {
      mockExpirationRef.current = Date.now() + 5 * 60 * 1000;
    }

    if (!isAuthenticated || !token) {
      // Defer setState to avoid cascading renders (same pattern as WhatsAppInstanceModal)
      const boot = window.setTimeout(() => {
        setSecondsRemaining(null);
        setShowWarningModal(false);
      }, 0);
      return () => window.clearTimeout(boot);
    }

    const checkInterval = setInterval(() => {
      let expMs = 0;

      // Check if it looks like a real JWT
      if (token.split('.').length === 3) {
        try {
          const decoded = jwtDecode<{ exp?: number }>(token);
          if (decoded.exp) {
            expMs = decoded.exp * 1000;
          }
        } catch {
          // Fallback to mock expiration
          expMs = mockExpirationRef.current;
        }
      } else {
        // Fallback to mock expiration for sandbox tokens
        expMs = mockExpirationRef.current;
      }

      const diffSeconds = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      setSecondsRemaining(diffSeconds);

      if (diffSeconds <= 0) {
        clearInterval(checkInterval);
        logout();
        showToast.error('Sua sessão expirou por inatividade. Faça login novamente.');
        navigate('/login');
      } else if (diffSeconds <= warningThresholdSeconds) {
        setShowWarningModal(true);
      } else {
        setShowWarningModal(false);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [token, isAuthenticated, warningThresholdSeconds, logout, navigate]);

  return {
    secondsRemaining,
    showWarningModal,
    extendSession,
    logoutSession,
  };
};

export default useTokenMonitor;
