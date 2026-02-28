import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email || 'admin1@pharmacy.com', form.password || 'admin123');
      if (user.role !== 'ADMIN') {
        toast.error('Admin access only');
        return;
      }
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24
          }}>💊</div>
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20 }}>AI Pharmacy</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1 }}>ADMIN PANEL</div>
          </div>
        </div>

        <h2 className="login-title">Welcome back</h2>
        <p className="login-sub">Sign in to your admin account</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="admin@pharmacy.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: 24, padding: 14,
          background: 'var(--bg-secondary)',
          borderRadius: 8, fontSize: 12,
          color: 'var(--text-muted)', lineHeight: 1.7
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Demo Credentials:</strong><br />
          Email: admin@pharmacy.com<br />
          Password: admin123
        </div>
      </div>
    </div>
  );
}
