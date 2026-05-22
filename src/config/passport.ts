import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import "dotenv/config";
import User from '../models/User';
import Role from '../models/Role';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) {
          return done(new Error("No email found in Google profile"), undefined);
        }

        let user = await User.findOne({ email }).populate('roles');

        if (!user) {
          const customerRole = await Role.findOne({ name: 'customer' });
          
          user = await User.create({
            firstName: profile.name?.givenName || 'Unknown',
            lastName: profile.name?.familyName || 'User',
            email: email.toLowerCase(),
            password: 'google-oauth-user', // Placeholder, as they won't use it
            roles: customerRole ? [customerRole._id] : [],
            phone: 'N/A', // Placeholder, user should update later
            isVerified: true,
            isActive: true
          });
          
          user = await user.populate('roles');
        }

        return done(null, user as any);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);
