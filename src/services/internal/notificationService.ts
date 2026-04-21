import { 
  sendOTPEmail, 
  sendPasswordResetEmail, 
  sendWelcomeEmail 
} from "../external/emailService";
import { 
  sendOTPSMS, 
  sendPasswordResetSMS, 
  sendWelcomeSMS 
} from "../external/smsService";
import { MultiChannelNotificationResponse } from "../../types";

/**
 * Sends an OTP notification via both email and SMS.
 * @param email - User's email address
 * @param phone - User's phone number
 * @param otp - One-Time Password
 * @param name - User's name
 */
export const sendOTPNotification = async (
  email: string, 
  phone: string, 
  otp: string, 
  name: string = "User"
): Promise<MultiChannelNotificationResponse> => {
  const results: MultiChannelNotificationResponse = {
    email: null,
    sms: null
  };

  try {
    if (email) {
      results.email = await sendOTPEmail(email, otp, name);
    }
    
    if (phone) {
      results.sms = await sendOTPSMS(phone, otp, name);
    }

    return results;
  } catch (error: any) {
    console.error("Error in sendOTPNotification:", error);
    return { success: false, error: error.message, ...results };
  }
};

/**
 * Sends a password reset notification via both email and SMS.
 * @param email - User's email address
 * @param phone - User's phone number
 * @param resetToken - Password reset token
 * @param name - User's name
 */
export const sendPasswordResetNotification = async (
  email: string, 
  phone: string, 
  resetToken: string, 
  name: string = "User"
): Promise<MultiChannelNotificationResponse> => {
  const results: MultiChannelNotificationResponse = {
    email: null,
    sms: null
  };

  try {
    if (email) {
      results.email = await sendPasswordResetEmail(email, resetToken, name);
    }
    
    if (phone) {
      results.sms = await sendPasswordResetSMS(phone, resetToken, name);
    }

    return results;
  } catch (error: any) {
    console.error("Error in sendPasswordResetNotification:", error);
    return { success: false, error: error.message, ...results };
  }
};

/**
 * Sends a welcome notification via both email and SMS.
 * @param email - User's email address
 * @param phone - User's phone number
 * @param name - User's name
 */
export const sendWelcomeNotification = async (
  email: string, 
  phone: string, 
  name: string
): Promise<MultiChannelNotificationResponse> => {
  const results: MultiChannelNotificationResponse = {
    email: null,
    sms: null
  };

  try {
    if (email) {
      results.email = await sendWelcomeEmail(email, name);
    }
    
    if (phone) {
      results.sms = await sendWelcomeSMS(phone, name);
    }

    return results;
  } catch (error: any) {
    console.error("Error in sendWelcomeNotification:", error);
    return { success: false, error: error.message, ...results };
  }
};
