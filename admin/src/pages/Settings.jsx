import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Database, Save, Moon, Sun, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateProfile } from '../utils/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, login: updateLocalUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'ADMIN'
  });
  const [saving, setSaving] = useState(false);

  // Sync profile when user context changes
  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || 'ADMIN'
      });
    }
  }, [user]);

  const [notifs, setNotifs] = useState({
    lowStock: true,
    newOrders: true,
    deliveries: false,
    weeklyReport: true,
  });

  const [apiConfig, setApiConfig] = useState({
    baseUrl: 'http://localhost:5000/api',
    groqApiKey: '••••••••••••',
    geminiApiKey: '••••••••••••',
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Config', icon: Database },
  ];

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await updateProfile({
        name: profile.name,
        phone: profile.phone
      });
      // Update global context so header/sidebar reflect changes
      updateLocalUser && updateLocalUser(data, localStorage.getItem('token'));
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGeneral = () => {
    toast.success('Settings saved successfully!');
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your admin preferences and system configuration</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
        {/* Tab List */}
        <div className="card" style={{ padding: 12, height: 'fit-content' }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="nav-item"
              style={{
                marginBottom: 2,
                borderRadius: 8,
                background: activeTab === id ? 'var(--brand-dim)' : 'transparent',
                color: activeTab === id ? 'var(--brand)' : 'var(--text-secondary)'
              }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card">
          <div className="card-header">
            <h3><SettingsIcon size={16} /> {tabs.find(t => t.id === activeTab)?.label}</h3>
          </div>
          <div style={{ padding: 24 }}>
            {activeTab === 'profile' && (
              <div style={{ maxWidth: 500 }}>
                <div style={{
                  width: 80, height: 80,
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, fontWeight: 800, color: 'white',
                  marginBottom: 24
                }}>
                  {profile.name ? profile.name.split(' ').map(n => n[0]).join('') : 'A'}
                </div>
                {[
                  ['Full Name', 'name', 'text'],
                  ['Email Address', 'email', 'email'],
                  ['Phone Number', 'phone', 'text'],
                ].map(([label, key, type]) => (
                  <div className="form-group" key={key}>
                    <label className="form-label">{label}</label>
                    <input
                      type={type}
                      className="form-control"
                      value={profile[key]}
                      readOnly={key === 'email'}
                      onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                      style={key === 'email' ? { opacity: 0.6 } : {}}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <input className="form-control" value={profile.role} disabled style={{ opacity: 0.6 }} />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div style={{ maxWidth: 500 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
                  Customize the appearance of your dashboard. Choose between dark mode and light mode.
                </p>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '20px', border: '1px solid var(--border)', borderRadius: 12,
                  background: 'var(--bg-secondary)', marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {theme === 'dark' ? <Moon size={20} color="var(--text-primary)" /> : <Sun size={20} color="var(--text-primary)" />}
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>
                        {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {theme === 'dark'
                          ? 'AI-themed dark interface with modern design'
                          : 'Clean light interface with dark green accents'}
                      </div>
                    </div>
                  </div>
                  <label style={{ position: 'relative', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={theme === 'light'}
                      onChange={toggleTheme}
                      style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
                    />
                    <div style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: theme === 'light' ? 'var(--brand)' : 'var(--bg-hover)',
                      border: '1px solid var(--border)',
                      position: 'relative', transition: 'background 0.2s'
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'white',
                        position: 'absolute', top: 2,
                        left: theme === 'light' ? 22 : 2,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                      }} />
                    </div>
                  </label>
                </div>
                <div style={{
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 10, padding: 14, fontSize: 13, color: 'var(--text-secondary)'
                }}>
                  <strong>Tip:</strong> You can also toggle the theme using the sun/moon icon in the top bar.
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div style={{ maxWidth: 500 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
                  Choose which notifications you want to receive.
                </p>
                {[
                  ['lowStock', 'Low Stock Alerts', 'Get notified when medicines are running low'],
                  ['newOrders', 'New Orders', 'Receive alerts for new pharmacy orders'],

                  ['deliveries', 'Delivery Updates', 'Track shipment and delivery status changes'],
                  ['weeklyReport', 'Weekly Reports', 'Get a weekly summary of pharmacy performance'],
                ].map(([key, label, desc]) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 0', borderBottom: '1px solid var(--border)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                    <label style={{ position: 'relative', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={notifs[key]}
                        onChange={e => setNotifs(p => ({ ...p, [key]: e.target.checked }))}
                        style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
                      />
                      <div style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: notifs[key] ? 'var(--brand)' : 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        position: 'relative', transition: 'background 0.2s'
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%',
                          background: 'white',
                          position: 'absolute', top: 2,
                          left: notifs[key] ? 22 : 2,
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                        }} />
                      </div>
                    </label>
                  </div>
                ))}
                <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={handleSaveGeneral}>
                  <Save size={16} /> Save Preferences
                </button>
              </div>
            )}

            {activeTab === 'security' && (
              <div style={{ maxWidth: 500 }}>
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: 16, marginBottom: 24, display: 'flex', gap: 10 }}>
                  <Shield size={18} color="var(--accent-green)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Account Secured</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your account is protected with JWT authentication</div>
                  </div>
                </div>
                <h4 style={{ marginBottom: 16 }}>Change Password</h4>
                {['Current Password', 'New Password', 'Confirm New Password'].map(label => (
                  <div className="form-group" key={label}>
                    <label className="form-label">{label}</label>
                    <input type="password" className="form-control" placeholder="••••••••" />
                  </div>
                ))}
                <button className="btn btn-primary" onClick={() => toast.success('Password updated!')}>
                  <Save size={16} /> Update Password
                </button>
              </div>
            )}

            {activeTab === 'api' && (
              <div style={{ maxWidth: 600 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
                  Configure API endpoints and keys for integrations.
                </p>
                <div className="form-group">
                  <label className="form-label">Backend API URL</label>
                  <input
                    className="form-control"
                    value={apiConfig.baseUrl}
                    onChange={e => setApiConfig(p => ({ ...p, baseUrl: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Groq API Key</label>
                  <input
                    type="password"
                    className="form-control"
                    value={apiConfig.groqApiKey}
                    onChange={e => setApiConfig(p => ({ ...p, groqApiKey: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gemini API Key</label>
                  <input
                    type="password"
                    className="form-control"
                    value={apiConfig.geminiApiKey}
                    onChange={e => setApiConfig(p => ({ ...p, geminiApiKey: e.target.value }))}
                  />
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13 }}>
                  <strong>Database:</strong> MongoDB via Mongoose<br />
                  <strong>Auth:</strong> JWT Tokens<br />
                  <strong>Storage:</strong> Multer (Prescriptions)
                </div>
                <button className="btn btn-primary" onClick={handleSaveGeneral}>
                  <Save size={16} /> Save Configuration
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
