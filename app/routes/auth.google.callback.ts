import { authenticator } from '~/auth.server';
import { SocialsProvider } from 'remix-auth-socials';

export const loader = ({ request }: { request: Request }) => {
  return authenticator.authenticate(SocialsProvider.GOOGLE, request, {
    successRedirect: "/",
    failureRedirect: "/error",
  });
};