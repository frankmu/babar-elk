export function getCalculateExpires(server) {
  const ttl = server.config().get('xpack.security.sessionTimeout');
  return () => ttl && Date.now() + ttl;
}
