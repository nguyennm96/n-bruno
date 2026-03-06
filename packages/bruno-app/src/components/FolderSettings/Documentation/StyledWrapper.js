import styled from 'styled-components';

const StyledWrapper = styled.div`
  .folder-requests-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.text};
    opacity: 0.5;
    margin: 20px 0 10px;
  }

  .folder-request-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .folder-request-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border1};
    border-radius: 6px;
    font-size: 13px;
  }

  .folder-request-name {
    flex: 1;
    color: ${({ theme }) => theme.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder-request-url {
    font-size: 11px;
    color: ${({ theme }) => theme.text};
    opacity: 0.45;
    font-family: var(--font-code, monospace);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
  }

  .folder-empty {
    font-size: 12px;
    font-style: italic;
    opacity: 0.4;
    padding: 8px 0;
  }
`;

export default StyledWrapper;
