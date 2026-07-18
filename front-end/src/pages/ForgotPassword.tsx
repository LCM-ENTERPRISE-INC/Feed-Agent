import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Key, ArrowLeft, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { showToast } from '@/utils/toastHelper';
import { getPasswordStrength } from '@/utils/passwordStrength';
import '@/styles/login.css';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Cool-down timers for spam prevention
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        window.clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    cooldownTimerRef.current = window.setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestToken = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const msg = 'Insira um e-mail corporativo válido.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      showToast.success(`Código enviado com sucesso para ${email}!`);
      setStage('reset');
      startCooldown();
    }, 1500);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (token.length !== 6) {
      const msg = 'O código de verificação deve conter exatamente 6 números.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    const strength = getPasswordStrength(newPassword);
    if (strength.score < 3) {
      const msg = 'Para sua segurança, digite uma nova senha de complexidade Média ou superior.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    if (newPassword !== confirmPassword) {
      const msg = 'As senhas inseridas não coincidem.';
      setError(msg);
      showToast.error(msg);
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      showToast.success('Sua senha secreta foi redefinida com sucesso!');
      navigate('/login');
    }, 1500);
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    setError('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      showToast.success('Novo código enviado com sucesso!');
      startCooldown();
    }, 1200);
  };

  // Computations
  const passwordStrength = getPasswordStrength(newPassword);
  const doPasswordsMatch = newPassword !== '' && newPassword === confirmPassword;

  return (
    <div className="login-screen-bg">
      <div className="login-screen-inner" style={{ gridTemplateColumns: '1fr', placeContent: 'center', padding: 24 }}>
      <div className="login-glass-card" style={{ maxWidth: 440, margin: '0 auto' }}>
        
        {/* Stage 1: Request Recovery */}
        {stage === 'request' && (
          <>
            <div className="login-card-heading">
              <h2>Recuperar senha</h2>
              <p>
                Fluxo demonstrativo no frontend — o backend ainda não expõe endpoint de reset.
              </p>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            <form onSubmit={handleRequestToken} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="floating-input-group">
                <input
                  type="email"
                  id="forgot-email"
                  placeholder=" "
                  className="floating-input-box"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <Mail size={18} className="floating-input-icon" />
                <span className="floating-label-text">E-mail Corporativo</span>
                <span className={`validation-dot-indicator ${
                  email === '' ? 'validation-dot-empty' : (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'validation-dot-valid' : 'validation-dot-invalid')
                }`} />
              </div>

              <Button
                type="submit"
                variant="primary"
                icon={Key}
                isLoading={loading}
                style={{ width: '100%', marginTop: '10px', height: '48px', fontSize: '0.95rem' }}
              >
                Enviar Código de Segurança
              </Button>
            </form>
          </>
        )}

        {/* Stage 2: Verification and Reset */}
        {stage === 'reset' && (
          <>
            <div className="login-card-heading">
              <h2>Redefinir senha</h2>
              <p>Demonstração de UI — sem endpoint de reset no backend.</p>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              
              {/* verification Code input */}
              <div className="floating-input-group">
                <input
                  type="text"
                  id="reset-token"
                  placeholder=" "
                  maxLength={6}
                  className="floating-input-box"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))} // numbers only
                  disabled={loading}
                />
                <Key size={18} className="floating-input-icon" />
                <span className="floating-label-text">Código (6 dígitos)</span>
                <span className={`validation-dot-indicator ${
                  token === '' ? 'validation-dot-empty' : (token.length === 6 ? 'validation-dot-valid' : 'validation-dot-invalid')
                }`} />
              </div>

              {/* New Password */}
              <div className="floating-input-group" style={{ marginBottom: '8px' }}>
                <input
                  type="password"
                  id="reset-new-password"
                  placeholder=" "
                  className="floating-input-box"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
                <Lock size={18} className="floating-input-icon" />
                <span className="floating-label-text">Nova Senha</span>
                <span className={`validation-dot-indicator ${
                  newPassword === '' ? 'validation-dot-empty' : (passwordStrength.score >= 3 ? 'validation-dot-valid' : 'validation-dot-invalid')
                }`} />
              </div>

              {/* Password Strength Visual Meter */}
              {newPassword && (
                <div style={{ padding: '0 4px', marginBottom: '14px', animation: 'fade-in 0.25s ease-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Força da Senha:</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: passwordStrength.color }}>
                      {passwordStrength.text}
                    </span>
                  </div>
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
                </div>
              )}

              {/* Password Confirmation */}
              <div className="floating-input-group">
                <input
                  type="password"
                  id="reset-confirm-password"
                  placeholder=" "
                  className="floating-input-box"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
                <Lock size={18} className="floating-input-icon" />
                <span className="floating-label-text">Confirmar Senha</span>
                <span className={`validation-dot-indicator ${
                  confirmPassword === '' ? 'validation-dot-empty' : (doPasswordsMatch ? 'validation-dot-valid' : 'validation-dot-invalid')
                }`} />
              </div>

              {/* Confirmation validation status */}
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
                  <CheckCircle2 size={14} />
                  <span>{doPasswordsMatch ? 'As senhas coincidem.' : 'As senhas não coincidem.'}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                icon={ShieldCheck}
                isLoading={loading}
                style={{ width: '100%', marginTop: '10px', height: '48px', fontSize: '0.95rem' }}
              >
                Salvar Nova Senha Secreta
              </Button>

              {/* Resend Token Option with integrated countdown */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    color: cooldown > 0 ? 'var(--text-muted)' : 'var(--primary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    transition: 'color 0.2s',
                  }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  <span>
                    {cooldown > 0 ? `Reenviar código em (${cooldown}s)` : 'Reenviar código de segurança'}
                  </span>
                </button>
              </div>
            </form>
          </>
        )}

        <div className="login-footer-links" style={{ borderTop: '1px solid var(--border)', paddingTop: 16, width: '100%' }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={14} />
            Voltar ao login
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
