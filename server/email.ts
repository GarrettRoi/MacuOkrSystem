import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const transportOptions: SMTPTransport.Options = {
  host: "relay.macu.edu",
  port: 25,
  secure: false,
  ignoreTLS: true,
};

const transporter = nodemailer.createTransport(transportOptions);

export async function sendFeedbackNotificationEmail(params: {
  to: string[];
  submitterName: string;
  submitterEmail: string;
  message: string;
  pageUrl: string | null;
}): Promise<void> {
  const { to, submitterName, submitterEmail, message, pageUrl } = params;
  if (!to.length) return;
  const subject = `New feedback from ${submitterName} — MACU OKR`;
  const lines = [
    `${submitterName} (${submitterEmail}) just submitted feedback in the MACU OKR Tracking System.`,
    "",
    pageUrl ? `Page: ${pageUrl}` : null,
    "",
    "Message:",
    message,
    "",
    "— MACU OKR Tracking System",
  ].filter((l) => l !== null) as string[];
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const safePageUrl =
    pageUrl && /^https?:\/\//i.test(pageUrl) ? pageUrl : null;
  await transporter.sendMail({
    from: "itadmsystems@macu.edu",
    to,
    subject,
    text: lines.join("\n"),
    html: `
      <p><strong>${escapeHtml(submitterName)}</strong> (${escapeHtml(submitterEmail)}) just submitted feedback in the MACU OKR Tracking System.</p>
      ${safePageUrl ? `<p><strong>Page:</strong> <a href="${escapeHtml(safePageUrl)}">${escapeHtml(safePageUrl)}</a></p>` : pageUrl ? `<p><strong>Page:</strong> ${escapeHtml(pageUrl)}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      <p>— MACU OKR Tracking System</p>
    `,
  });
}

export async function sendInviteEmail(to: string, staffName: string, loginLink: string): Promise<void> {
  await transporter.sendMail({
    from: "itadmsystems@macu.edu",
    to,
    subject: "Your MACU OKR System Login Link",
    text: [
      `Hello ${staffName},`,
      "",
      "An administrator has generated a secure login link for you to set your password in the MACU OKR Tracking System.",
      "",
      "Click the link below to set your password:",
      loginLink,
      "",
      "This link expires in 48 hours and can only be used once.",
      "",
      "If you did not expect this email, please contact your administrator.",
      "",
      "— MACU IT Admin Systems",
    ].join("\n"),
    html: `
      <p>Hello ${staffName},</p>
      <p>An administrator has generated a secure login link for you to set your password in the MACU OKR Tracking System.</p>
      <p>Click the link below to set your password:</p>
      <p><a href="${loginLink}">${loginLink}</a></p>
      <p>This link expires in 48 hours and can only be used once.</p>
      <p>If you did not expect this email, please contact your administrator.</p>
      <p>— MACU IT Admin Systems</p>
    `,
  });
}
