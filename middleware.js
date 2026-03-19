const BASIC_AUTH_USER = process.env.PULSE_ADMIN_USER;
const BASIC_AUTH_PASS = process.env.PULSE_ADMIN_PASS;

export function middleware(req) {
  const url = new URL(req.url);

  if (!url.pathname.startsWith('/admin/tidbits')) {
    return;
  }

  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="828 Weather Pulse"' },
    });
  }

  const [, base64] = auth.split(' ');
  const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');

  if (user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) {
    return;
  }

  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="828 Weather Pulse"' },
  });
}

export const config = {
  matcher: [
    '/admin/tidbits',
    '/admin/tidbits/:path*'
  ],
};
