import React, { useEffect, useState } from 'react';
import { getAdminStats, getAdminUsers, getAdminLocations, updateAdminUser } from '../api/admin';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import styles from './Admin.module.css';

const TABS = ['Overview', 'Users', 'Locations'];

export default function Admin() {
  const [tab, setTab]           = useState('Overview');
  const [stats, setStats]       = useState(null);
  const [users, setUsers]       = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, locRes] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminLocations(),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setLocations(locRes.data);
    } catch (err) {
      setMsg(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await updateAdminUser(user.id, { is_active: !user.is_active });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
      setMsg(`${user.name} ${!user.is_active ? 'activated' : 'deactivated'}`);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message || 'Failed to update user');
    }
  };

  const handleRoleChange = async (user, newRole) => {
    try {
      await updateAdminUser(user.id, { role: newRole });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
      setMsg(`${user.name}'s role updated to ${newRole}`);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message || 'Failed to update role');
    }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search) ||
    u.city?.toLowerCase().includes(search.toLowerCase()) ||
    u.country?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>⚙️ Admin Panel</h1>
        <p>Platform management and user oversight</p>
      </div>

      {msg && <div className={styles.msg}>{msg}</div>}

      {/* Tab bar */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'Overview' && '📊 '}
            {t === 'Users' && '👥 '}
            {t === 'Locations' && '📍 '}
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === 'Overview' && stats && (
            <div className={styles.overview}>
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statNum}>{stats.users.total}</div>
                  <div className={styles.statLabel}>Total Users</div>
                  <div className={styles.statSub}>
                    {stats.users.verified} phone verified · {stats.users.identity_verified} identity verified
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNum}>{stats.users.location_enabled}</div>
                  <div className={styles.statLabel}>Location Enabled</div>
                  <div className={styles.statSub}>
                    {stats.users.total > 0
                      ? Math.round((stats.users.location_enabled / stats.users.total) * 100)
                      : 0}% of users
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNum}>{stats.groups.total}</div>
                  <div className={styles.statLabel}>Total Groups</div>
                  <div className={styles.statSub}>
                    {stats.groups.active} active · {stats.groups.forming} forming · {stats.groups.reforming} re-forming
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNum}>{Number(stats.contributions.total_xaf || 0).toLocaleString()}</div>
                  <div className={styles.statLabel}>Total Contributions (XAF)</div>
                  <div className={styles.statSub}>{stats.contributions.total} transactions</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNum}>{stats.pending_registrations}</div>
                  <div className={styles.statLabel}>Pending Registrations</div>
                  <div className={styles.statSub}>Awaiting OTP verification</div>
                </div>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'Users' && (
            <div>
              <input
                className={styles.search}
                placeholder="Search by name, phone, city, country..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Phone ✓</th>
                      <th>Identity ✓</th>
                      <th>Location</th>
                      <th>Groups</th>
                      <th>TC Balance</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(u => (
                      <tr key={u.id} className={!u.is_active ? styles.inactive : ''}>
                        <td>
                          <div className={styles.userCell}>
                            <div className={styles.userAvatar}>{u.name?.[0]?.toUpperCase()}</div>
                            <span>{u.name}</span>
                          </div>
                        </td>
                        <td className={styles.mono}>{u.phone}</td>
                        <td>
                          <select
                            className={styles.roleSelect}
                            value={u.role}
                            onChange={e => handleRoleChange(u, e.target.value)}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                            <option value="superadmin">superadmin</option>
                          </select>
                        </td>
                        <td>
                          <span className={u.is_verified ? styles.yes : styles.no}>
                            {u.is_verified ? '✓' : '✗'}
                          </span>
                        </td>
                        <td>
                          <span className={u.profile_complete ? styles.yes : styles.no}>
                            {u.profile_complete ? '✓' : '✗'}
                          </span>
                        </td>
                        <td>
                          {u.city || u.country
                            ? <span className={styles.location}>{[u.city, u.country].filter(Boolean).join(', ')}</span>
                            : <span className={styles.noLocation}>—</span>
                          }
                        </td>
                        <td className={styles.center}>{u.group_count}</td>
                        <td className={styles.mono}>{Number(u.tc_balance || 0).toFixed(2)} TC</td>
                        <td className={styles.date}>{formatDate(u.created_at)}</td>
                        <td>
                          <button
                            className={`${styles.actionBtn} ${u.is_active ? styles.deactivate : styles.activate}`}
                            onClick={() => handleToggleActive(u)}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className={styles.empty}>No users found</div>
                )}
              </div>
            </div>
          )}

          {/* ── LOCATIONS ── */}
          {tab === 'Locations' && (
            <div>
              <p className={styles.locationNote}>
                {locations.length} user{locations.length !== 1 ? 's' : ''} with location data
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Phone</th>
                      <th>City</th>
                      <th>Country</th>
                      <th>Coordinates</th>
                      <th>Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className={styles.userCell}>
                            <div className={styles.userAvatar}>{u.name?.[0]?.toUpperCase()}</div>
                            <span>{u.name}</span>
                          </div>
                        </td>
                        <td className={styles.mono}>{u.phone}</td>
                        <td>{u.city || '—'}</td>
                        <td>{u.country || '—'}</td>
                        <td className={styles.mono}>
                          {u.latitude && u.longitude
                            ? `${Number(u.latitude).toFixed(4)}, ${Number(u.longitude).toFixed(4)}`
                            : '—'
                          }
                        </td>
                        <td className={styles.date}>
                          {u.last_location_at
                            ? formatDateTime(u.last_location_at)
                            : '—'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {locations.length === 0 && (
                  <div className={styles.empty}>No location data yet. Users need to enable location in their browser.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
