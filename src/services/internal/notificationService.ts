import { 
  sendOTPEmail, 
  sendPasswordResetEmail, 
  sendWelcomeEmail,
  sendEmailWithAttachment
} from "../external/emailService";
import { 
  sendOTPSMS, 
  sendPasswordResetSMS, 
  sendWelcomeSMS 
} from "../external/smsService";
import { MultiChannelNotificationResponse } from "../../types";

/**
 * Sends a receipt notification via email with PDF attachment.
 * @param email - Recipient email
 * @param name - Recipient name
 * @param pdfUrl - URL of the receipt PDF
 * @param receiptNumber - Receipt identifier
 */
export const sendReceiptNotification = async (
  email: string,
  name: string,
  pdfUrl: string,
  receiptNumber: string
): Promise<void> => {
  try {
    const subject = `Receipt for Your Payment - ${receiptNumber}`;
    const html = `
      <p>Hello ${name},</p>
      <p>Thank you for your payment. Please find your receipt attached to this email.</p>
      <p>Receipt Number: <strong>${receiptNumber}</strong></p>
      <p>Best regards,<br/>The DOHEZ Team</p>
    `;
    await sendEmailWithAttachment(email, subject, html, pdfUrl, `receipt-${receiptNumber}.pdf`);
  } catch (error) {
    console.error("Error in sendReceiptNotification:", error);
  }
};

/**
 * Sends a ticket notification via email with PDF attachment.
 * @param email - Recipient email
 * @param name - Recipient name
 * @param pdfUrl - URL of the ticket PDF
 * @param ticketNumber - Ticket identifier
 * @param eventName - Name of the event
 */
export const sendTicketNotification = async (
  email: string,
  name: string,
  pdfUrl: string,
  ticketNumber: string,
  eventName: string
): Promise<void> => {
  try {
    const subject = `Your Ticket for ${eventName} - ${ticketNumber}`;
    const html = `
      <p>Hello ${name},</p>
      <p>Your ticket for <strong>${eventName}</strong> has been successfully booked!</p>
      <p>Please find your ticket attached. You will need to present it at the entrance.</p>
      <p>Ticket Number: <strong>${ticketNumber}</strong></p>
      <p>Enjoy the event!<br/>The DOHEZ Team</p>
    `;
    await sendEmailWithAttachment(email, subject, html, pdfUrl, `ticket-${ticketNumber}.pdf`);
  } catch (error) {
    console.error("Error in sendTicketNotification:", error);
  }
};

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
