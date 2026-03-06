/**
 * Shared method badge used across Documentation components.
 * Renders a coloured uppercase label (GET, POST, GRPC, etc.) for a request item.
 *
 * Props:
 *   item  {object}  request item with .type and .request.method
 */
const getMethodInfo = (item) => {
  if (!item) return { label: '?', cls: '' };
  if (item.type === 'grpc-request') return { label: 'GRPC', cls: 'method-grpc' };
  if (item.type === 'ws-request') return { label: 'WS', cls: 'method-ws' };
  if (item.type === 'graphql-request') return { label: 'GQL', cls: 'method-graphql' };
  const m = (item.request?.method || 'GET').toUpperCase();
  return { label: m.length > 5 ? m.substring(0, 3) : m, cls: `method-${m.toLowerCase()}` };
};

const MethodBadge = ({ item }) => {
  const { label, cls } = getMethodInfo(item);
  return <span className={`method-badge ${cls}`}>{label}</span>;
};

export { getMethodInfo };
export default MethodBadge;
