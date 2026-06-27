import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, MessageSquareCode, Sparkles } from 'lucide-react';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { useAuthStore } from '@/store/authStore';
import { showToast } from '@/utils/toastHelper';
import apiClient from '@/services/apiClient';
import '@/styles/login.css';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Real-time validations
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 4;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      const msg = 'O e-mail corporativo é obrigatório.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (!isEmailValid) {
      const msg = 'Por favor, insira um formato de e-mail corporativo válido.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (!password) {
      const msg = 'A senha de acesso é obrigatória.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (!isPasswordValid) {
      const msg = 'A senha deve conter ao menos 4 caracteres.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.post('/auth/login', { email, password });
      if (res.data?.success) {
        const { token, user } = res.data.data;
        login(token, { id: String(user.id), name: user.name, email: user.email });
        showToast.success(`Bem-vindo de volta, ${user.name}!`);
        navigate('/dashboard');
      } else {
        setError(res.data?.error || 'Falha na autenticação.');
        showToast.error('Falha na autenticação.');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Credenciais inválidas ou erro no servidor.';
      setError(errorMsg);
      showToast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-bg">
      <div className="login-glass-card">
        {/* Brand Banner Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <MessageSquareCode size={30} style={{ color: 'white' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: 'white' }}>
              Portal Feed-Agent
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              Insira suas credenciais corporativas salvas
            </p>
          </div>
        </div>

        {/* Error Feedback Display */}
        {error && <Alert variant="error">{error}</Alert>}

        {/* Interactive Floating Label Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Email Floating Input */}
          <div className="floating-input-group">
            <input
              type="email"
              id="login-email"
              placeholder=" "
              className="floating-input-box"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
            <Mail size={18} className="floating-input-icon" />
            <span className="floating-label-text">E-mail Corporativo</span>
            
            {/* Visual validity dot indicator */}
            <span className={`validation-dot-indicator ${
              email === '' ? 'validation-dot-empty' : (isEmailValid ? 'validation-dot-valid' : 'validation-dot-invalid')
            }`} />
          </div>

          {/* Password Floating Input */}
          <div className="floating-input-group">
            <input
              type="password"
              id="login-password"
              placeholder=" "
              className="floating-input-box"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
            <Lock size={18} className="floating-input-icon" />
            <span className="floating-label-text">Senha Secreta</span>
            
            {/* Visual validity dot indicator */}
            <span className={`validation-dot-indicator ${
              password === '' ? 'validation-dot-empty' : (isPasswordValid ? 'validation-dot-valid' : 'validation-dot-invalid')
            }`} />
          </div>

          <Button
            type="submit"
            variant="primary"
            icon={LogIn}
            isLoading={loading}
            style={{ width: '100%', marginTop: '14px', height: '48px', fontSize: '0.95rem' }}
          >
            Acessar Painel Central
          </Button>
        </form>

        {/* Bottom utility footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', color: 'var(--text-muted)' }}>
            <Sparkles size={14} style={{ color: 'var(--primary)' }} />
            <span>Esqueceu sua senha?{' '}
              <Link to="/forgot-password" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                Recuperar Acesso
              </Link>
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            Novo por aqui?{' '}
            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              Criar Administrador
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
