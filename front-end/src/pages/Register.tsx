import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { showToast } from '@/utils/toastHelper';
import { getPasswordStrength } from '@/utils/passwordStrength';
import apiClient from '@/services/apiClient';
import '@/styles/login.css';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Real-time validations
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordStrength = getPasswordStrength(password);
  const doPasswordsMatch = password !== '' && password === confirmPassword;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      const msg = 'O nome completo é obrigatório.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (!isEmailValid) {
      const msg = 'Por favor, insira um e-mail corporativo válido.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (passwordStrength.score < 3) {
      const msg = 'Sua senha deve ser ao menos de nível Médio para segurança.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (!doPasswordsMatch) {
      const msg = 'As senhas inseridas não coincidem.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.post('/auth/register', { name, email, password });
      if (res.data?.success) {
        showToast.success('Administrador cadastrado com sucesso! Prossiga com o login.');
        navigate('/login');
      } else {
        const msg = res.data?.error || 'Falha ao registrar.';
        setError(msg);
        showToast.error(msg);
      }
    } catch (err: unknown) {
      const errorMsg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string } | undefined)?.error || 'Erro ao criar nova credencial administrativa.'
        : 'Erro ao criar nova credencial administrativa.';
      setError(errorMsg);
      showToast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-bg">
      <div className="login-screen-inner" style={{ gridTemplateColumns: '1fr', placeContent: 'center', padding: 24 }}>
      <div className="login-glass-card" style={{ maxWidth: 460, margin: '0 auto' }}>
        <div className="login-card-heading">
          <h2>Criar administrador</h2>
          <p>Cadastre a conta que gerencia contatos, minutas e disparos.</p>
        </div>

        {/* Error Notification */}
        {error && <Alert variant="error">{error}</Alert>}

        {/* Register Form */}
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Full Name */}
          <div className="floating-input-group">
            <input
              type="text"
              id="reg-name"
              placeholder=" "
              className="floating-input-box"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="name"
            />
            <User size={18} className="floating-input-icon" />
            <span className="floating-label-text">Nome Completo</span>
            <span className={`validation-dot-indicator ${name.trim() !== '' ? 'validation-dot-valid' : 'validation-dot-empty'}`} />
          </div>

          {/* Corporate Email */}
          <div className="floating-input-group">
            <input
              type="email"
              id="reg-email"
              placeholder=" "
              className="floating-input-box"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
            <Mail size={18} className="floating-input-icon" />
            <span className="floating-label-text">E-mail Corporativo</span>
            <span className={`validation-dot-indicator ${
              email === '' ? 'validation-dot-empty' : (isEmailValid ? 'validation-dot-valid' : 'validation-dot-invalid')
            }`} />
          </div>

          {/* Secure Password */}
          <div className="floating-input-group" style={{ marginBottom: '8px' }}>
            <input
              type="password"
              id="reg-password"
              placeholder=" "
              className="floating-input-box"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
            <Lock size={18} className="floating-input-icon" />
            <span className="floating-label-text">Nova Senha Secreta</span>
            <span className={`validation-dot-indicator ${
              password === '' ? 'validation-dot-empty' : (passwordStrength.score >= 3 ? 'validation-dot-valid' : 'validation-dot-invalid')
            }`} />
          </div>

          {/* Password Strength Visual Meter */}
          {password && (
            <div style={{ padding: '0 4px', marginBottom: '14px', animation: 'fade-in 0.25s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Força da Senha:</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: passwordStrength.color }}>
                  {passwordStrength.text}
                </span>
              </div>
              {/* Strength bar block cells */}
              <div style={{ display: 'flex', gap: '4px', height: '5px', width: '100%' }}>
                {[1, 2, 3, 4, 5].map((level) => {
                  const isActive = level <= passwordStrength.score;
                  return (
                    <div
                      key={level}
                      style={{
                        flex: 1,
                        borderRadius: '2px',
                        backgroundColor: isActive ? passwordStrength.color : 'rgba(255, 255, 255, 0.05)',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span>Requisitos: 6+ chars, letras A-Z, a-z, números e símbolos</span>
              </div>
            </div>
          )}

          {/* Password Confirmation */}
          <div className="floating-input-group">
            <input
              type="password"
              id="reg-confirm"
              placeholder=" "
              className="floating-input-box"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
            <Lock size={18} className="floating-input-icon" />
            <span className="floating-label-text">Confirmar Senha Secreta</span>
            <span className={`validation-dot-indicator ${
              confirmPassword === '' ? 'validation-dot-empty' : (doPasswordsMatch ? 'validation-dot-valid' : 'validation-dot-invalid')
            }`} />
          </div>

          {/* Passwords Match Feedback Status */}
          {confirmPassword && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              color: doPasswordsMatch ? 'var(--success)' : 'var(--error)',
              padding: '0 4px 10px 4px',
              animation: 'fade-in 0.25s ease-out',
            }}>
              {doPasswordsMatch ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>As senhas coincidem perfeitamente.</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} />
                  <span>As senhas digitadas ainda não coincidem.</span>
                </>
              )}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            icon={UserPlus}
            isLoading={loading}
            style={{ width: '100%', marginTop: '10px', height: '48px', fontSize: '0.95rem' }}
          >
            Cadastrar Novo Administrador
          </Button>
        </form>

        <div className="login-footer-links">
          <span>
            Já tem conta? <Link to="/login">Entrar</Link>
          </span>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Register;
