import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const transportOptions: SMTPTransport.Options = {
  host: "relay.macu.edu",
  port: 25,
  secure: false,
  ignoreTLS: true,
};

const transporter = nodemailer.createTransport(transportOptions);

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
