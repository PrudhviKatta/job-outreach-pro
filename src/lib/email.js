// src/lib/email.js
import nodemailer from "nodemailer";
import crypto from "crypto";

// Encryption utilities
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32); // 32 bytes key
const ALGORITHM = "aes-256-cbc";

export const encryptPassword = (password) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
};

export const decryptPassword = (encryptedPassword) => {
  const parts = encryptedPassword.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = parts[1];
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

const createTransporter = (senderEmail, appPassword) => {
  // Determine email service based on sender email domain
  let service = "gmail"; // default
  if (
    senderEmail.includes("@outlook.") ||
    senderEmail.includes("@hotmail.") ||
    senderEmail.includes("@live.")
  ) {
    service = "outlook";
  } else if (senderEmail.includes("@yahoo.")) {
    service = "yahoo";
  }

  return nodemailer.createTransport({
    service,
    auth: {
      user: senderEmail,
      pass: appPassword,
    },
    secure: true,
  });
};

// Test SMTP connection with user credentials
export const testSMTPConnection = async (senderEmail, appPassword) => {
  try {
    const transporter = createTransporter(senderEmail, appPassword);
    await transporter.verify();
    return { success: true, message: "SMTP connection verified successfully!" };
  } catch (error) {
    console.error("SMTP test error:", error);
    return {
      success: false,
      error: error.message || "Failed to connect to email server",
    };
  }
};

export const replaceVariables = (template, variables) => {
  let result = template;
  Object.keys(variables).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, variables[key] || "");
  });
  return result;
};

// Simple markdown to HTML converter for email templates
const markdownToHtml = (markdown) => {
  if (!markdown) return "";

  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.*)\*/gim, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]*)\]\(([^)]*)\)/gim, '<a href="$2">$1</a>')
    // Line breaks
    .replace(/\n/gim, "<br>")
    // Bullet points
    .replace(/^- (.*$)/gim, "<li>$1</li>")
    // Wrap consecutive <li> tags in <ul>
    .replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>")
    .replace(/<\/ul>\s*<ul>/gim, "");

  return html;
};

// Helper function to convert HTML/Markdown to plain text for fallback
const toPlainText = (content) => {
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^- /gm, "• ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
};

export const sendEmail = async ({
  to,
  subject,
  body,
  attachments = [],
  trackingId = null,
  senderEmail,
  appPassword,
}) => {
  const transporter = createTransporter(senderEmail, appPassword);

  // Convert markdown to HTML
  let htmlBody = markdownToHtml(body);

  // Add tracking pixel if trackingId is provided
  if (trackingId) {
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/tracking/open?id=${trackingId}`;
    htmlBody += `<img src="${trackingUrl}" width="1" height="1" style="display:none" />`;
  }

  // Generate plain text version for better email client compatibility
  const textBody = toPlainText(body);

  const mailOptions = {
    from: senderEmail,
    to,
    subject,
    text: textBody,
    html: htmlBody,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error.message };
  }
};

export const sendBulkEmails = async (emails, delayMs = 3000) => {
  const results = [];

  for (let i = 0; i < emails.length; i++) {
    const result = await sendEmail(emails[i]);
    results.push(result);

    if (i < emails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
};
