export function authCookieOptions(location) {
  const hostname = location.hostname;
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
  const options = {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: local ? 'lax' : 'none',
    secure: !local
  };
  if (!local) {
    options.domain = hostname.substring(hostname.lastIndexOf('.', hostname.lastIndexOf('.') - 1) + 1);
  }
  return options;
}
