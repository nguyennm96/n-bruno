import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IconUser, IconCrown, IconEdit, IconEye } from '@tabler/icons';
import {
  fetchWorkspaceMembers,
  selectMembersByWorkspaceId,
  selectIsLoadingMembers
} from 'providers/ReduxStore/slices/cloudWorkspaces';
import StyledWrapper from './StyledWrapper';

/**
 * Display workspace members (read-only)
 */
const WorkspaceMembers = ({ workspaceId }) => {
  const dispatch = useDispatch();
  const members = useSelector((state) => selectMembersByWorkspaceId(state, workspaceId));
  const isLoading = useSelector(selectIsLoadingMembers);

  useEffect(() => {
    if (workspaceId) {
      dispatch(fetchWorkspaceMembers(workspaceId));
    }
  }, [dispatch, workspaceId]);

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner':
        return <IconCrown size={14} strokeWidth={1.5} className="role-icon owner" />;
      case 'editor':
        return <IconEdit size={14} strokeWidth={1.5} className="role-icon editor" />;
      case 'viewer':
        return <IconEye size={14} strokeWidth={1.5} className="role-icon viewer" />;
      default:
        return <IconUser size={14} strokeWidth={1.5} className="role-icon" />;
    }
  };

  const getRoleLabel = (role) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (isLoading) {
    return (
      <StyledWrapper>
        <div className="loading">Loading members...</div>
      </StyledWrapper>
    );
  }

  if (!members || members.length === 0) {
    return (
      <StyledWrapper>
        <div className="empty">No members</div>
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper>
      <div className="members-list">
        <div className="members-header">
          <span>Members ({members.length})</span>
        </div>

        {members.map((member) => (
          <div key={member.user_id} className="member-item">
            <div className="member-avatar">
              {member.user?.name?.charAt(0).toUpperCase() || <IconUser size={16} strokeWidth={1.5} />}
            </div>

            <div className="member-info">
              <div className="member-name">{member.user?.name || 'Unknown'}</div>
              <div className="member-email">{member.user?.email || member.user_id}</div>
            </div>

            <div className="member-role">
              {getRoleIcon(member.role)}
              <span>{getRoleLabel(member.role)}</span>
            </div>
          </div>
        ))}
      </div>
    </StyledWrapper>
  );
};

export default WorkspaceMembers;
