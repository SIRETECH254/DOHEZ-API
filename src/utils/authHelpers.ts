import jwt from 'jsonwebtoken';
import { IUser } from '../types';

/**
 * Generates an access token and a refresh token for a user.
 * @param user - The user object
 * @returns An object containing the access token and refresh token
 */
export const generateTokens = (user: IUser) => {
  const roleIds = (user.roles as any[]).map((role) => 
    typeof role === 'object' && '_id' in role ? role._id.toString() : role.toString()
  );

  const payload = {
    userId: user._id,
    roleIds,
    userType: 'user',
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_ACCESS_EXPIRY || '15m') as any }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!) as string,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as any }
  );

  return { accessToken, refreshToken };
};

/**
 * Generates a random 6-digit numeric OTP.
 * @returns A 6-digit string
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
