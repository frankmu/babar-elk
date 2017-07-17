export function onChangePassword(request, username, password, calculateExpires, reply) {
  return () => {
    const currentUser = request.auth.credentials.username;
    if (username === currentUser) {
      request.cookieAuth.set({
        username,
        password,
        expires: calculateExpires()
      });
    }

    return reply().code(204);
  };
}