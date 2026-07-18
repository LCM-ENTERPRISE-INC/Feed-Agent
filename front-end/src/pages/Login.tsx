import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, MessageSquareCode } from 'lucide-react';
import axios from 'axios';
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

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 4;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      const msg = 'O e-mail é obrigatório.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (!isEmailValid) {
      const msg = 'Informe um e-mail válido.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (!password) {
      const msg = 'A senha é obrigatória.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (!isPasswordValid) {
      const msg = 'A senha deve ter ao menos 4 caracteres.';
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
        showToast.success(`Bem-vindo, ${user.name}!`);
        navigate('/dashboard');
      } else {
        setError(res.data?.error || 'Falha na autenticação.');
        showToast.error('Falha na autenticação.');
      }
    } catch (err: unknown) {
      const errorMsg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string } | undefined)?.error || 'Credenciais inválidas ou erro no servidor.'
        : 'Credenciais inválidas ou erro no servidor.';
      setError(errorMsg);
      showToast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-bg">
      <div className="login-screen-inner">
        <aside className="login-brand-pane">
          <div className="login-brand-mark">
            <div className="mark-square">
              <MessageSquareCode size={26} />
            </div>
            <span className="mark-name">Feed-Agent</span>
          </div>
          <h1>Do documento ao disparo, em um fluxo só.</h1>
          <p>
            Conecte o WhatsApp, gere minutas com OCR e IA, e envie para sua base com controle de fila.
          </p>
          <ul className="login-brand-steps">
            <li>
              <span className="step-num">1</span>
              Conecte um aparelho
            </li>
            <li>
              <span className="step-num">2</span>
              Extraia texto e revise a minuta
            </li>
            <li>
              <span className="step-num">3</span>
              Dispare com cadência segura
            </li>
          </ul>
        </aside>

        <div className="login-glass-card">
          <div className="login-card-heading">
            <h2>Entrar</h2>
            <p>Use as credenciais da sua conta administradora.</p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <form onSubmit={handleLogin}>
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
              <span className="floating-label-text">E-mail</span>
              <span
                className={`validation-dot-indicator ${
                  email === ''
                    ? 'validation-dot-empty'
                    : isEmailValid
                      ? 'validation-dot-valid'
                      : 'validation-dot-invalid'
                }`}
              />
            </div>

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
              <span className="floating-label-text">Senha</span>
              <span
                className={`validation-dot-indicator ${
                  password === ''
                    ? 'validation-dot-empty'
                    : isPasswordValid
                      ? 'validation-dot-valid'
                      : 'validation-dot-invalid'
                }`}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              icon={LogIn}
              isLoading={loading}
              style={{ width: '100%', marginTop: 8, height: 48 }}
            >
              Acessar painel
            </Button>
          </form>

          <div className="login-footer-links">
            <span>
              Esqueceu a senha? <Link to="/forgot-password">Recuperar acesso</Link>
            </span>
            <span>
              Ainda não tem conta? <Link to="/register">Criar administrador</Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
