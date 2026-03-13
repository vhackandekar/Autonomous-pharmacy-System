import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Save, Moon, Sun, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getProfile, updateProfile, changePassword } from '../utils/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'ADMIN'
  });
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Sync profile when user context changes or on mount to get latest from DB
  useEffect(() => {
    const fetchLatestProfile = async () => {
      try {
        const { data } = await getProfile();
        const userData = data.user || data;
        setProfile({
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          role: userData.role || 'ADMIN'
        });
        // Also update local user context if different
        updateUser && updateUser(userData, localStorage.getItem('token'));
      } catch (err) {
        console.error('Failed to sync profile with DB:', err);
      }
    };

    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || 'ADMIN'
      });
      fetchLatestProfile();
    }
  }, [user, updateUser]);

  const [notifs, setNotifs] = useState({
    lowStock: user?.refillAlerts ?? true,
    newOrders: user?.orderUpdates ?? true,
    deliveries: false,
    weeklyReport: true,
  });

  // Sync notifs when user loads
  useEffect(() => {
    if (user) {
      setNotifs(prev => ({
        ...prev,
        lowStock: user.refillAlerts ?? true,
        newOrders: user.orderUpdates ?? true,
      }));
    }
  }, [user]);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const handleSaveProfile = async () => {
    // Validation
    if (!profile.name.trim()) return toast.error('Full name is required');
    if (profile.phone && profile.phone.trim().length < 10) return toast.error('Valid phone number required');

    setSaving(true);
    try {
      const { data } = await updateProfile({
        name: profile.name.trim(),
        phone: profile.phone ? profile.phone.trim() : ''
      });
      const userData = data.user || data;
      // Update global context so header/sidebar reflect changes
      updateUser && updateUser(userData, localStorage.getItem('token'));
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!security.currentPassword || !security.newPassword || !security.confirmPassword) {
      return toast.error('Please fill in all password fields');
    }
    if (security.newPassword !== security.confirmPassword) {
      return toast.error('New passwords do not match');
    }

    setUpdatingPassword(true);
    try {
      await changePassword({
        currentPassword: security.currentPassword,
        newPassword: security.newPassword
      });
      toast.success('Clinical credentials updated successfully!');
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Credential update failed');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      const { data } = await updateProfile({
        refillAlerts: notifs.lowStock,
        orderUpdates: notifs.newOrders,
        theme: theme
      });
      const userData = data.user || data;
      updateUser && updateUser(userData, localStorage.getItem('token'));
      toast.success('Settings saved successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                  <div style={{
                    width: 80, height: 80,
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32, fontWeight: 800, color: 'white'
                  }}>
                    {profile.name ? profile.name.split(' ').map(n => n[0]).join('') : 'A'}
                  </div>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{profile.name}</h3>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: 'rgba(34,197,94,0.1)',
                      color: 'var(--brand)',
                      fontSize: 12,
                      fontWeight: 700
                    }}>
                      <Shield size={12} />
                      Verified Manager
                    </div>
                  </div>
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
                <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={handleSaveGeneral} disabled={saving}>
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            )}

            {activeTab === 'security' && (
              <div style={{ maxWidth: 500 }}>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 32,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: 48, height: 48,
                    background: 'white',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <Shield size={24} color="var(--brand)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Account Integrity Verified</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.8 }}>Your administrative session is protected by clinical-grade JWT encryption.</div>
                  </div>
                </div>

                <div style={{ marginBottom: 32 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 20 }}>Credential Rotation</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Current Clinical Password</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="••••••••"
                        value={security.currentPassword}
                        onChange={e => setSecurity(s => ({ ...s, currentPassword: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">New Hardened Password</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="••••••••"
                        value={security.newPassword}
                        onChange={e => setSecurity(s => ({ ...s, newPassword: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="••••••••"
                        value={security.confirmPassword}
                        onChange={e => setSecurity(s => ({ ...s, confirmPassword: e.target.value }))}
                      />
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}
                    onClick={handleUpdatePassword}
                    disabled={updatingPassword}
                  >
                    <Save size={16} /> {updatingPassword ? 'Rotating Credentials...' : 'Update Clinical Password'}
                  </button>
                </div>

                <div style={{
                  padding: 20,
                  background: 'var(--bg-secondary)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  fontSize: 12
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Session Audit Information:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, color: 'var(--text-muted)' }}>
                    <span>Identity Status:</span>
                    <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{user?.isVerified ? 'VERIFIED' : 'PENDING'}</span>
                    <span>JWT Protocol:</span>
                    <span>RS256 (Clinical Grade)</span>
                    <span>Last Rotation:</span>
                    <span>{new Date(user?.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
