import cron from "node-cron";
import nodemailer from "nodemailer";
import { storage } from "./storage";

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || "noreply@example.com";
  if (!host || !user || !pass) return null;
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return { transport, from };
}

export function startSchedulers() {
  // Every day at 08:00
  cron.schedule("0 8 * * *", async () => {
    try {
      const pending = await storage.getPendingFollowUps();
      const mail = getTransport();
      if (!mail) return; // skip if mail not configured
      for (const q of pending) {
        try {
          const to = q.client.email;
          const subject = `Relance devis ${q.reference}`;
          const text = `Bonjour ${q.client.name},\n\nJe me permets de revenir vers vous concernant notre devis ${q.reference} (${q.description}). N'hésitez pas à me dire si vous avez des questions.\n\nCordialement,\nVotre équipe`;
          await mail.transport.sendMail({ from: mail.from, to, subject, text });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Mail send failed", { error: (e as Error).message, quoteId: q.id });
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Scheduler error", (e as Error).message);
    }
  });
}

