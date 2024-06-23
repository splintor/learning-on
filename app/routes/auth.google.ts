import { authenticator } from '~/auth.server';
import { SocialsProvider } from 'remix-auth-socials';

export const action = async ({ request }: { request: Request }) =>
  authenticator.authenticate(SocialsProvider.GOOGLE, request, {
    successRedirect: '/',
    failureRedirect: '/error',
  });
