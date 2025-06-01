import nodemailer from "nodemailer";

const createTransporter = () => {
  return nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
};

export const replaceVariables = (template, variables) => {
  let result = template;
  Object.keys(variables).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, variables[key] || "");
  });
  return result;
};

export const sendEmail = async ({
  to,
  subject,
  body,
  attachments = [],
  trackingId = null,
}) => {
  const transporter = createTransporter();

  let htmlBody = body.replace(/\n/g, "<br>");
  if (trackingId) {
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/tracking/open?id=${trackingId}`;
    htmlBody += `<img src="${trackingUrl}" width="1" height="1" style="display:none" />`;
  }

  const mailOptions = {
    from: `${process.env.GMAIL_USER}`,
    to,
    subject,
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
