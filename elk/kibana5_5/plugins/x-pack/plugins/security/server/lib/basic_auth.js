export function getAuthHeader(username, password) {
  const auth = new Buffer(`${username}:${password}`).toString('base64');
  return {
    authorization: `Basic ${auth}`
  };
}

export function parseAuthHeader(authorization) {
  if (typeof authorization !== 'string') {
    throw new Error('Authorization should be a string');
  }

  const [ authType, token ] = authorization.split(' ');
  if (authType.toLowerCase() !== 'basic') {
    throw new Error('Authorization is not Basic');
  }

  // base64 decode auth header
  const tokenBuffer = new Buffer(token, 'base64');
  const tokenString = tokenBuffer.toString();

  // everything after the first : is the password
  const [ username, ...passwordParts ] = tokenString.split(/:/);
  const password = passwordParts.join(':');

  return { username, password };
}
