import styled from 'styled-components';

const StyledWrapper = styled.div`
  .folder-requests-title {
    font-size: ${({ theme }) => theme.font.size.xs};
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
    font-size: ${({ theme }) => theme.font.size.base};
  }

  .folder-request-name {
    flex: 1;
    color: ${({ theme }) => theme.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder-request-url {
    font-size: ${({ theme }) => theme.font.size.xs};
    color: ${({ theme }) => theme.text};
    opacity: 0.45;
    font-family: var(--font-code, monospace);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
  }

  .folder-empty {
    font-size: ${({ theme }) => theme.font.size.sm};
    font-style: italic;
    opacity: 0.4;
    padding: 8px 0;
  }
`;

export default StyledWrapper;
