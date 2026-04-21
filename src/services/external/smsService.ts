import AfricasTalking from "africastalking";
import { errorHandler } from "../../middleware/errorHandler";
import { NotificationResponse } from "../../types";

let africasTalking: any = null;
let sms: any = null;

const initializeSMS = () => {
  if (
    process.env.AFRICAS_TALKING_API_KEY &&
    process.env.AFRICAS_TALKING_USERNAME &&
    process.env.AFRICAS_TALKING_API_KEY !== "your-africastalking-api-key" &&
    process.env.AFRICAS_TALKING_USERNAME !== "your-africastalking-username"
  ) {
    africasTalking = new (AfricasTalking as any)({
      apiKey: process.env.AFRICAS_TALKING_API_KEY,
      username: process.env.AFRICAS_TALKING_USERNAME
    });

    sms = africasTalking.SMS;
  } else {
    console.warn("Africa's Talking SMS service not initialized: Invalid or missing credentials. SMS service will not be available.");
  }
};

initializeSMS();

/**
 * Standardizes phone numbers for API compatibility (e.g., +2547XXXXXXXX).
 * @param phone - Raw phone number string
 * @returns Formatted phone number
 */
const formatPhoneNumber = (phone: string): string => {
  let cleanNumber = phone.replace(/[\s\-\+]/g, "");

  if (cleanNumber.startsWith("0")) {
    cleanNumber = "254" + cleanNumber.substring(1);
  }

  if (!cleanNumber.startsWith("254")) {
    cleanNumber = "254" + cleanNumber;
  }

  return "+" + cleanNumber;
};

/**
 * Sends an SMS containing a One-Time Password to a user.
 * @param phone - Recipient phone number
 * @param otp - One-Time Password
 * @param name - Recipient name
 */
export const sendOTPSMS = async (phone: string, otp: string, name: string = "User"): Promise<NotificationResponse> => {
  if (!phone || !otp) {
    throw errorHandler(400, "Phone number and OTP are required for sending SMS");
  }

  if (!sms) {
    console.log(`SMS to ${phone} NOT successful: SMS service not initialized`);
    return { success: false, error: "SMS service not initialized" };
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const message = `Hello ${name}, your OTP code is ${otp}. It expires soon.`;

    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      console.log(`SMS to ${phone} successful`);
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    const reason = result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status";
    console.log(`SMS to ${phone} NOT successful: ${reason}`);
    return {
      success: false,
      error: reason
    };
  } catch (error: any) {
    console.log(`SMS to ${phone} NOT successful: ${error.message}`);
    throw errorHandler(500, `Failed to send OTP SMS: ${error.message}`);
  }
};

/**
 * Sends an SMS with a password reset link to a user.
 * @param phone - Recipient phone number
 * @param resetToken - Password reset token
 * @param name - Recipient name
 */
export const sendPasswordResetSMS = async (
  phone: string,
  resetToken: string,
  name: string = "User"
): Promise<NotificationResponse> => {
  if (!sms) {
    console.log(`SMS to ${phone} NOT successful: SMS service not initialized`);
    return { success: false, error: "SMS service not initialized" };
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
    const message = `Hello ${name}, reset your password using: ${resetUrl}. This link expires soon.`;

    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      console.log(`SMS to ${phone} successful`);
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    const reason = result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status";
    console.log(`SMS to ${phone} NOT successful: ${reason}`);
    return {
      success: false,
      error: reason
    };
  } catch (error: any) {
    console.log(`SMS to ${phone} NOT successful: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a welcome SMS to a newly verified user.
 * @param phone - Recipient phone number
 * @param name - Recipient name
 */
export const sendWelcomeSMS = async (phone: string, name: string): Promise<NotificationResponse> => {
  if (!sms) {
    console.log(`SMS to ${phone} NOT successful: SMS service not initialized`);
    return { success: false, error: "SMS service not initialized" };
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const message = `Welcome ${name}! Your account has been verified successfully.`;

    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      console.log(`SMS to ${phone} successful`);
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    const reason = result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status";
    console.log(`SMS to ${phone} NOT successful: ${reason}`);
    return {
      success: false,
      error: reason
    };
  } catch (error: any) {
    console.log(`SMS to ${phone} NOT successful: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a generic SMS message.
 * @param phone - Recipient phone number
 * @param message - SMS content
 */
export const sendGenericSMS = async (phone: string, message: string): Promise<NotificationResponse> => {
  if (!phone || !message) {
    throw errorHandler(400, "Phone number and message are required for sending SMS");
  }

  if (!sms) {
    console.log(`SMS to ${phone} NOT successful: SMS service not initialized`);
    return { success: false, error: "SMS service not initialized" };
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      console.log(`SMS to ${phone} successful`);
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    const reason = result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status";
    console.log(`SMS to ${phone} NOT successful: ${reason}`);
    return {
      success: false,
      error: reason
    };
  } catch (error: any) {
    console.log(`SMS to ${phone} NOT successful: ${error.message}`);
    throw errorHandler(500, `Failed to send SMS: ${error.message}`);
  }
};
