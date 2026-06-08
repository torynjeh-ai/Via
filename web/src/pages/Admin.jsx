import React, { useEffect, useState } from 'react';
import { getAdminStats, getAdminUsers, getAdminLocations, updateAdminUser, getAdminGroups, getAdminFinancials } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import styles from './Admin.module.css';

const TABS = ['Overview', 'Users', 'Groups', 'Locations'];

function GroupAdminCard({ group: g }) {
  const [expanded, setExpanded] = React.useState(false);
  const statusColor = g.status === 'active' ? 'var(--success)' : g.status === 'forming' ? '#ca8a04' : 'var(--text-muted)';
  const statusBg = g.status === 'active' ? 'rgba(22,163,74,0.1)' : g.status === 'forming' ? 'rgba(234,179,8,0.1)' : 'var(--bg-hover)';

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 18px', marginBottom: 10, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Created by {g.creator_name} ({g.creator_phone}) · {formatDate(g.created_at)}
            {g.contribution_amount && ` · ${Number(g.contribution_amount).toLocaleString()} XAF ${g.cycle || ''}`}
          </div>
        </div>
        <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600, background: statusBg, color: statusColor }}>{g.status}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.member_count}/{g.max_members || '∞'} members</span>
        {g.total_contributed && <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{Number(g.total_contributed).toLocaleString()} XAF</span>}
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && g.members?.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Members & Invitation Chain</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-sub)' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-sub)' }}>Phone</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-sub)' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-sub)' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-sub)' }}>Invited By</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-sub)' }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {g.members.map(m => (
                  <tr key={m.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: m.role === 'admin' ? 600 : 400 }}>{m.name}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>{m.phone}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: m.role === 'admin' ? 'rgba(108,99,255,0.15)' : 'var(--bg-hover)', color: m.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {m.role}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                        background: m.status === 'approved' ? 'rgba(22,163,74,0.1)' : m.status === 'forfeited' ? 'rgba(220,38,38,0.1)' : 'rgba(234,179,8,0.1)',
                        color: m.status === 'approved' ? 'var(--success)' : m.status === 'forfeited' ? 'var(--danger)' : '#ca8a04' }}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 12 }}>
                      {m.invited_by_name
                        ? <span>{m.invited_by_name} <span style={{ color: 'var(--text-muted)' }}>({m.invited_by_phone})</span></span>
                        : <span style={{ color: 'var(--text-muted)' }}>Direct / Admin</span>
                      }
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(m.joined_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'superadmin';
  const TABS = isSuperAdmin
    ? ['Overview', 'Users', 'Groups', 'Financials', 'Locations']
    : ['Overview', 'Users', 'Locations'];

  const [tab, setTab]           = useState('Overview');
  const [stats, setStats]       = useState(null);
  const [users, setUsers]       = useState([]);
  const [groups, setGroups]     = useState([]);
  const [financials, setFinancials] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    loadAll();
  }, [isSuperAdmin]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const baseRequests = [getAdminStats(), getAdminUsers(), getAdminLocations()];
      const superRequests = isSuperAdmin ? [getAdminGroups(), getAdminFinancials()] : [];
      const [statsRes, usersRes, locRes, ...superRes] = await Promise.all([...baseRequests, ...superRequests]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setLocations(locRes.data);
      if (isSuperAdmin) {
        setGroups(superRes[0]?.data || []);
        setFinancials(superRes[1]?.data || null);
      }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600,
            background: isSuperAdmin ? 'rgba(108,99,255,0.15)' : 'rgba(22,163,74,0.1)',
            color: isSuperAdmin ? 'var(--primary)' : 'var(--success)' }}>
            {isSuperAdmin ? '⭐ Super Admin' : '🛡 Admin'}
          </span>
        </div>
      </div>
      <p style={{ color: 'var(--text-sub)', fontSize: 14, marginBottom: 20 }}>
        {isSuperAdmin ? 'Full platform access — users, groups, financials, and role management' : 'Platform oversight — users and statistics (read-only)'}
      </p>

      {msg && <div className={styles.msg}>{msg}</div>}

      {/* Tab bar */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'Overview'   && '📊 '}
            {t === 'Users'      && '👥 '}
            {t === 'Groups'     && '🏘️ '}
            {t === 'Financials' && '💰 '}
            {t === 'Locations'  && '📍 '}
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
                      {isSuperAdmin && <th>Actions</th>}
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
                          {isSuperAdmin ? (
                            <select
                              className={styles.roleSelect}
                              value={u.role}
                              onChange={e => handleRoleChange(u, e.target.value)}
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                              <option value="superadmin">superadmin</option>
                            </select>
                          ) : (
                            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-hover)', color: 'var(--text-sub)' }}>{u.role}</span>
                          )}
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
                        {isSuperAdmin && (
                          <td>
                            <button
                              className={`${styles.actionBtn} ${u.is_active ? styles.deactivate : styles.activate}`}
                              onClick={() => handleToggleActive(u)}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        )}
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

          {/* ── GROUPS ── */}
          {tab === 'Groups' && (
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 16 }}>
                {groups.length} group{groups.length !== 1 ? 's' : ''} on the platform
              </p>
              {groups.map(g => (
                <GroupAdminCard key={g.id} group={g} />
              ))}
              {groups.length === 0 && <div className={styles.empty}>No groups found</div>}
            </div>
          )}

          {/* ── FINANCIALS (superadmin only) ── */}
          {tab === 'Financials' && financials && (
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 20 }}>Platform financial overview — superadmin only</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[
                  { icon: '💰', label: 'Total TC in Wallets', value: `${Number(financials.wallet?.total_tc || 0).toFixed(4)} TC`, sub: `${financials.wallet?.users_with_balance || 0} users` },
                  { icon: '💸', label: 'Penalty Fees to Platform', value: `${Number(financials.penalties?.total_platform_fees || 0).toLocaleString()} XAF`, sub: `${financials.penalties?.distributions || 0} distributions` },
                  { icon: '⬇️', label: 'Pending Withdrawals', value: `${Number(financials.pending_withdrawals?.pending_xaf || 0).toLocaleString()} XAF`, sub: `${financials.pending_withdrawals?.pending_count || 0} requests` },
                  { icon: '⬆️', label: 'Total Top-Ups', value: `${Number(financials.top_ups?.total_topup_xaf || 0).toLocaleString()} XAF`, sub: `${financials.top_ups?.total_topups || 0} transactions` },
                ].map(c => (
                  <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{c.value}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.sub}</div>
                  </div>
                ))}
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
