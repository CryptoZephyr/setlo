import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { db } from "./supabase";

export type Email = { to: string; subject: string; text: string; kind: "invite" | "payout" | "setup" };

export interface EmailSender {
  send(msg: Email): Promise<void>;
}

class GmailSender implements EmailSender {
  private transport: Transporter | undefined;

  async send(msg: Email) {
    this.transport ??= nodemailer.createTransport({
      service: "gmail",
      auth: { user: env().GMAIL_USER, pass: env().GMAIL_APP_PASSWORD },
    });
    await this.transport.sendMail({ from: `Setlo <${env().GMAIL_USER}>`, to: msg.to, subject: msg.subject, text: msg.text });
  }
}

let sender: EmailSender = new GmailSender();

/** Swap the transport (e.g. Resend once a custom domain exists, or a stub in tests). */
export function setEmailSender(s: EmailSender) {
  sender = s;
}

/** Best effort: email failures are logged, never thrown, because invite links remain the primary path. */
export async function sendEmail(msg: Email, ref: Record<string, unknown> = {}): Promise<boolean> {
  let error: string | null = null;
  try {
    await sender.send(msg);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await db().from("email_log").insert({ to_email: msg.to, kind: msg.kind, subject: msg.subject, error, ref });
  return error === null;
}

export function inviteEmail(to: string, role: "supplier" | "client", title: string, link: string): Email {
  const ask =
    role === "supplier"
      ? "You've been invited to accept a booking slot"
      : "You've been invited to review and fund a booking package";
  return {
    kind: "invite",
    to,
    subject: `Setlo: ${title}`,
    text: `${ask} for "${title}".\n\nOpen your invite: ${link}\n\nSign in with this email address (${to}).\nIf this landed in spam, please mark it as not spam.\n`,
  };
}

export function payoutEmail(to: string, amount: string, link: string): Email {
  return {
    kind: "payout",
    to,
    subject: `Setlo: ${amount} USDG paid out`,
    text: `${amount} USDG has been paid to your Setlo payout account.\n\nTransaction: ${link}\n`,
  };
}

export function setupEmail(to: string, role: "supplier" | "client", title: string, link: string): Email {
  const ask =
    role === "supplier"
      ? "An agency wants to add you as a supplier"
      : "An agency is preparing a booking for you";
  return {
    kind: "setup",
    to,
    subject: `Setlo: set up your account for ${title}`,
    text: `${ask} for "${title}".\n\nSet up your Setlo account so payments can reach you: ${link}\n\nSign in with this email address (${to}). Nothing is booked or paid yet.\nIf this landed in spam, please mark it as not spam.\n`,
  };
}
