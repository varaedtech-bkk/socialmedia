import nodemailer from "nodemailer";

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

export function getSmtpFromAddress(): string | undefined {
  return (
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.MAIL_FROM?.trim()
  );
}

export async function sendSmtpMail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }
  const port = Number(process.env.SMTP_PORT || "587");
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!.trim(),
    },
  });

  const from = getSmtpFromAddress();
  if (!from) {
    throw new Error("Set SMTP_FROM or SMTP_USER as the sender address");
  }

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
  });
}
