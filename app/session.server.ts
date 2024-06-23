import { createCookieSessionStorage } from '@vercel/remix';

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'learning-on-session',
    sameSite: 'lax',
    path: '/',
    httpOnly: true,
    secrets: [process.env.GOOGLE_CLIENT_SECRET!],
    secure: process.env.NODE_ENV === 'production',
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;
