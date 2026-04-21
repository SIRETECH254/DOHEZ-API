import sgMail from "@sendgrid/mail";
import { errorHandler } from "../../middleware/errorHandler";
import { NotificationResponse } from "../../types";

let isSendGridInitialized = false;

// Initialize SendGrid with API Key
const initializeSendGrid = () => {
    if (process.env.SMTP_PASS) {
        sgMail.setApiKey(process.env.SMTP_PASS);
        isSendGridInitialized = true;
    } else {
        console.warn("SendGrid API Key is missing. Email service will not be available.");
    }
};

initializeSendGrid();

// SendGrid requires a verified sender. We'll use SMTP_USER or FROM_EMAIL if available.
const fromEmail = process.env.SMTP_USER || process.env.FROM_EMAIL || "noreply@dohez.com";

/**
 * Sends an email containing a One-Time Password to a user.
 * @param email - Recipient email
 * @param otp - One-Time Password
 * @param name - Recipient name
 */
export const sendOTPEmail = async (email: string, otp: string, name: string = "User"): Promise<NotificationResponse> => {
  if (!email || !otp) {
    throw errorHandler(400, "Email and OTP are required for sending OTP email");
  }

  if (!isSendGridInitialized) {
    console.log(`Email to ${email} NOT successful: SendGrid not initialized`);
    return { success: false, error: "SendGrid not initialized" };
  }

  try {
    const message = `Hello ${name}, your OTP code is ${otp}. It expires soon.`;

    const msg = {
      to: email,
      from: `"DOHEZ" <${fromEmail}>`,
      subject: "Your OTP Code",
      text: message,
      html: `<strong>${message}</strong>`,
    };

    await sgMail.send(msg);
    console.log(`Email to ${email} successful`);
    return { success: true };
  } catch (error: any) {
    const reason = error.message;
    console.log(`Email to ${email} NOT successful: ${reason}`);
    if (error.response) {
      console.error(error.response.body);
    }
    throw errorHandler(500, `Failed to send OTP email: ${reason}`);
  }
};

/**
 * Sends an email with a password reset link to a user.
 * @param email - Recipient email
 * @param resetToken - Password reset token
 * @param name - Recipient name
 */
export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  name: string = "User"
): Promise<NotificationResponse> => {
  if (!email || !resetToken) {
    throw errorHandler(400, "Email and reset token are required for sending password reset email");
  }

  if (!isSendGridInitialized) {
    console.log(`Email to ${email} NOT successful: SendGrid not initialized`);
    return { success: false, error: "SendGrid not initialized" };
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
    const message = `Hello ${name}, reset your password using: ${resetUrl}. This link expires soon.`;

    const msg = {
      to: email,
      from: `"DOHEZ" <${fromEmail}>`,
      subject: "Password Reset",
      text: message,
      html: `<p>Hello ${name},</p><p>Reset your password using: <a href="${resetUrl}">${resetUrl}</a></p><p>This link expires soon.</p>`,
    };

    await sgMail.send(msg);
    console.log(`Email to ${email} successful`);
    return { success: true };
  } catch (error: any) {
    const reason = error.message;
    console.log(`Email to ${email} NOT successful: ${reason}`);
    throw errorHandler(500, `Failed to send password reset email: ${reason}`);
  }
};

/**
 * Sends a welcome email to a newly verified user.
 * @param email - Recipient email
 * @param name - Recipient name
 */
export const sendWelcomeEmail = async (email: string, name: string): Promise<NotificationResponse> => {
  if (!email || !name) {
    throw errorHandler(400, "Email and name are required for sending welcome email");
  }

  if (!isSendGridInitialized) {
    console.log(`Email to ${email} NOT successful: SendGrid not initialized`);
    return { success: false, error: "SendGrid not initialized" };
  }

  try {
    const message = `Welcome ${name}! Your account has been verified successfully.`;

    const msg = {
      to: email,
      from: `"DOHEZ" <${fromEmail}>`,
      subject: "Welcome to Dohez API",
      text: message,
      html: `<strong>${message}</strong>`,
    };

    await sgMail.send(msg);
    console.log(`Email to ${email} successful`);
    return { success: true };
  } catch (error: any) {
    const reason = error.message;
    console.log(`Email to ${email} NOT successful: ${reason}`);
    throw errorHandler(500, `Failed to send welcome email: ${reason}`);
  }
};

/**
 * Sends a generic email message.
 * @param email - Recipient email
 * @param subject - Email subject
 * @param message - Email content
 */
export const sendGenericEmail = async (email: string, subject: string, message: string): Promise<NotificationResponse> => {
  if (!email || !subject || !message) {
    throw errorHandler(400, "Email, subject, and message are required for sending email");
  }

  if (!isSendGridInitialized) {
    console.log(`Email to ${email} NOT successful: SendGrid not initialized`);
    return { success: false, error: "SendGrid not initialized" };
  }

  try {
    const msg = {
      to: email,
      from: `"DOHEZ" <${fromEmail}>`,
      subject,
      text: message,
      html: `<p>${message}</p>`,
    };

    await sgMail.send(msg);
    console.log(`Email to ${email} successful`);
    return { success: true };
  } catch (error: any) {
    const reason = error.message;
    console.log(`Email to ${email} NOT successful: ${reason}`);
    throw errorHandler(500, `Failed to send email: ${reason}`);
  }
};
