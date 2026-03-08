import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { IconUserPlus, IconTrash, IconClock, IconX } from '@tabler/icons';
import {
  selectWorkspaceMembers,
  selectWorkspacePendingInvites,
  selectMembersLoading
} from 'providers/ReduxStore/slices/workspaces';
import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  cancelInviteAction
} from 'providers/ReduxStore/slices/workspaces/actions';
import { selectUser } from 'providers/ReduxStore/slices/auth';
import StyledWrapper from './StyledWrapper';
import { useTranslation } from 'react-i18next';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#10b981', '#06b6d4', '#3b82f6', '#84cc16'
];
const avatarColor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const MembersTab = ({ workspace }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const members = useSelector(selectWorkspaceMembers(workspace.uid));
  const pendingInvites = useSelector(selectWorkspacePendingInvites(workspace.uid));
  const loading = useSelector(selectMembersLoading(workspace.uid));
  const currentUser = useSelector(selectUser);

  const ROLE_LABELS = useMemo(() => ({
    owner: t('WORKSPACE.ROLE_OWNER'),
    editor: t('WORKSPACE.ROLE_EDITOR'),
    viewer: t('WORKSPACE.ROLE_VIEWER')
  }), [t]);

  const currentMember = members.find(
    (m) => m.userId === currentUser?.id || m.user?.email === currentUser?.email
  );
  const isOwner = currentMember?.role === 'owner';

  const formik = useFormik({
    initialValues: { email: '', role: 'viewer' },
    validationSchema: Yup.object({
      email: Yup.string().email(t('WORKSPACE.INVALID_EMAIL')).required(t('WORKSPACE.EMAIL_REQUIRED')),
      role: Yup.string().oneOf(['editor', 'viewer']).required(t('WORKSPACE.ROLE_REQUIRED'))
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        const result = await dispatch(inviteMemberAction(workspace.uid, values.email, values.role));
        if (result?.action === 'added') {
          toast.success(t('WORKSPACE.MEMBER_ADDED', { email: values.email }));
        } else {
          toast.success(t('WORKSPACE.INVITATION_SENT', { email: values.email }));
        }
        resetForm();
      } catch (error) {
        toast.error(error?.message || t('WORKSPACE.INVITE_MEMBER_ERROR'));
      }
    }
  });

  const handleRemoveMember = async (userId, userEmail) => {
    if (!confirm(t('WORKSPACE.REMOVE_MEMBER_CONFIRM', { email: userEmail }))) return;
    try {
      await dispatch(removeMemberAction(workspace.uid, userId));
      toast.success(t('WORKSPACE.MEMBER_REMOVED', { email: userEmail }));
    } catch (error) {
      toast.error(error?.message || t('WORKSPACE.REMOVE_MEMBER_ERROR'));
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await dispatch(updateMemberRoleAction(workspace.uid, userId, newRole));
      toast.success(t('WORKSPACE.ROLE_UPDATED'));
    } catch (error) {
      toast.error(error?.message || t('WORKSPACE.UPDATE_ROLE_ERROR'));
    }
  };

  const handleCancelInvite = async (inviteId, email) => {
    try {
      await dispatch(cancelInviteAction(workspace.uid, inviteId));
      toast.success(t('WORKSPACE.INVITE_CANCELLED', { email }));
    } catch (error) {
      toast.error(error?.message || t('WORKSPACE.CANCEL_INVITE_ERROR'));
    }
  };

  return (
    <StyledWrapper>
      {/* Invite section — owners only */}
      {isOwner && (
        <div className="invite-section">
          <h3 className="section-title">{t('WORKSPACE.INVITE_MEMBER_TITLE')}</h3>
          <form onSubmit={formik.handleSubmit} className="invite-form">
            <div className="invite-fields">
              <input
                type="email"
                name="email"
                placeholder={t('WORKSPACE.EMAIL_PLACEHOLDER')}
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="email-input"
                autoComplete="off"
              />
              <select
                name="role"
                value={formik.values.role}
                onChange={formik.handleChange}
                className="role-select"
              >
                <option value="editor">{t('WORKSPACE.ROLE_EDITOR')}</option>
                <option value="viewer">{t('WORKSPACE.ROLE_VIEWER')}</option>
              </select>
              <button type="submit" className="invite-btn" disabled={formik.isSubmitting || !formik.values.email}>
                <IconUserPlus size={13} strokeWidth={2} />
                <span>{formik.isSubmitting ? t('WORKSPACE.INVITING') : t('WORKSPACE.INVITE')}</span>
              </button>
            </div>
            {formik.touched.email && formik.errors.email && (
              <div className="error-msg">{formik.errors.email}</div>
            )}
          </form>
        </div>
      )}

      {/* Members list */}
      <div className="members-section">
        <h3 className="section-title">
          {t('WORKSPACE.MEMBERS')}
          {members.length > 0 && <span className="count-badge">{members.length}</span>}
        </h3>
        {loading ? (
          <div className="state-msg">{t('WORKSPACE.LOADING_MEMBERS')}</div>
        ) : members.length === 0 ? (
          <div className="state-msg">{t('WORKSPACE.NO_MEMBERS_FOUND')}</div>
        ) : (
          <div className="members-list">
            {members.map((member, index) => {
              const isSelf = member.userId === currentUser?.id;
              const isMemberOwner = member.role === 'owner';
              const displayName = member.user?.name || member.user?.email || 'Unknown';
              const avatarChar = displayName[0].toUpperCase();
              const color = avatarColor(member.userId);

              return (
                <div key={member.userId || index} className="member-row">
                  <div className="member-avatar" style={{ background: color }}>
                    {avatarChar}
                  </div>
                  <div className="member-info">
                    <span className="member-name">
                      {displayName}
                      {isSelf && <span className="you-badge">{t('WORKSPACE.YOU')}</span>}
                    </span>
                    {member.user?.email && member.user?.name && (
                      <span className="member-email">{member.user.email}</span>
                    )}
                  </div>
                  <div className="member-actions">
                    {isOwner && !isSelf && !isMemberOwner ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                        className="role-select-inline"
                      >
                        <option value="editor">{t('WORKSPACE.ROLE_EDITOR')}</option>
                        <option value="viewer">{t('WORKSPACE.ROLE_VIEWER')}</option>
                      </select>
                    ) : (
                      <span className={`role-badge role-${member.role}`}>
                        {ROLE_LABELS[member.role] || member.role}
                      </span>
                    )}
                    {isOwner && !isSelf && !isMemberOwner && (
                      <button
                        className="icon-btn danger"
                        onClick={() => handleRemoveMember(member.userId, member.user?.email)}
                        title={t('WORKSPACE.REMOVE_MEMBER_LABEL')}
                      >
                        <IconTrash size={12} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invites — owners only */}
      {isOwner && pendingInvites.length > 0 && (
        <div className="invites-section">
          <h3 className="section-title">
            <IconClock size={12} strokeWidth={2} style={{ opacity: 0.6 }} />
            {t('WORKSPACE.PENDING_INVITES')}
            <span className="count-badge pending">{pendingInvites.length}</span>
          </h3>
          <div className="invites-list">
            {pendingInvites.map((invite, index) => (
              <div key={invite.id || invite.email || index} className="invite-row">
                <div className="invite-avatar">
                  {invite.email[0].toUpperCase()}
                </div>
                <div className="invite-info">
                  <span className="invite-email">{invite.email}</span>
                  <span className={`role-badge role-${invite.role}`}>
                    {ROLE_LABELS[invite.role] || invite.role}
                  </span>
                </div>
                <button
                  className="icon-btn cancel"
                  onClick={() => handleCancelInvite(invite.id, invite.email)}
                  title={t('WORKSPACE.CANCEL_INVITE_LABEL')}
                >
                  <IconX size={12} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </StyledWrapper>
  );
};

export default MembersTab;
