import { Authenticator } from 'remix-auth';
import { GoogleStrategy, SocialsProvider } from "remix-auth-socials";
import { GoogleProfile } from 'remix-auth-google';
import { sessionStorage } from './session.server';

// Create an instance of the authenticator
// It will take session storage as an input parameter and creates the user session on successful authentication
export const authenticator = new Authenticator<GoogleProfile>(sessionStorage);

// callback function that will be invoked upon successful authentication from social provider
async function handleSocialAuthCallback({ profile }: { profile: any }) {
  // create user in your db here
  // profile object contains all the user data like image, displayName, id
  return profile;
}

// Configuring Google Strategy
authenticator.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    scope: ["openid email profile"],
    callbackURL: `http://localhost:5173/auth/${SocialsProvider.GOOGLE}/callback`,
  },
  handleSocialAuthCallback
));