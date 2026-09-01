import { useState } from 'react';
import { useUserManagement } from '../context/UserManagementContext';
import { CreateUserModal } from './CreateUserModal';
import { UserProfile } from '../types/user';

export function UserList() {
  const {
    users,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    updateUserProfile,
  } = useUserManagement();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.includes(searchQuery);

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.fullName || '');
    setEditPhone(user.phone || '');
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    await updateUserProfile(editingUser.uid, {
      fullName: editName,
      phone: editPhone,
    });
    setEditingUser(null);
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>إدارة المستخدمين في السنتر (Tenant Users)</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ padding: '0.6rem 1.2rem', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + إضافة مستخدم جديد
        </button>
      </div>

      {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="بحث بالاسم أو البريد الإلكتروني أو الهاتف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
        >
          <option value="ALL">جميع الأدوار</option>
          <option value="institutionOwner">مالك السنتر (Owner)</option>
          <option value="admin">مدير (Admin)</option>
          <option value="student">طالب (Student)</option>
          <option value="parent">ولي أمر (Parent)</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
        >
          <option value="ALL">جميع الحالات</option>
          <option value="ACTIVE">نشط (ACTIVE)</option>
          <option value="SUSPENDED">موقوف (SUSPENDED)</option>
          <option value="ARCHIVED">مؤرشف (ARCHIVED)</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل المستخدمين...</div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>لا يوجد مستخدمين مطابقين لمعايير البحث.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '0.75rem' }}>الاسم</th>
              <th style={{ padding: '0.75rem' }}>البريد الإلكتروني</th>
              <th style={{ padding: '0.75rem' }}>رقم الهاتف</th>
              <th style={{ padding: '0.75rem' }}>الدور</th>
              <th style={{ padding: '0.75rem' }}>الحالة</th>
              <th style={{ padding: '0.75rem' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.uid} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>{u.fullName}</td>
                <td style={{ padding: '0.75rem', direction: 'ltr', textAlign: 'right' }}>{u.email}</td>
                <td style={{ padding: '0.75rem' }}>{u.phone || '-'}</td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', background: '#e3f2fd', color: '#1565c0', fontWeight: 'bold' }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      background: u.status === 'ACTIVE' ? '#e8f5e9' : u.status === 'SUSPENDED' ? '#fff3e0' : '#ffebee',
                      color: u.status === 'ACTIVE' ? '#2e7d32' : u.status === 'SUSPENDED' ? '#e65100' : '#c62828',
                    }}
                  >
                    {u.status}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <button
                    onClick={() => handleOpenEdit(u)}
                    style={{ padding: '0.3rem 0.6rem', marginLeft: '0.5rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    تعديل البيانات
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} />}

      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '400px' }}>
            <h4 style={{ marginTop: 0 }}>تعديل البيانات المسموحة للمستخدم</h4>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.3rem' }}>الاسم بالكامل</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.3rem' }}>رقم الهاتف</label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setEditingUser(null)} style={{ padding: '0.5rem 1rem', background: '#e0e0e0', border: 'none', borderRadius: '4px' }}>
                إلغاء
              </button>
              <button onClick={handleSaveEdit} style={{ padding: '0.5rem 1rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
