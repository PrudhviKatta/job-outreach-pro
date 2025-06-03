import nodemailer from "nodemailer";

const createTransporter = () => {
  return nodemailer.createTransport({
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
}) => {
  const transporter = createTransporter();

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
    from: `${process.env.GMAIL_USER}`,
    to,
    subject,
    text: textBody, // Plain text fallback
    html: htmlBody, // Rich HTML content
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
