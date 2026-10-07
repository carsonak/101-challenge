import nodemailer from "nodemailer";
import { logBackend, type AuthMail } from "@challenge/core";
import type { parseServerConfig } from "@challenge/contracts";

/** Minimal injectable SMTP transport; fixtures never need a live mailbox. */
interface MailTransport {
  /** Submit one message privately; reject when delivery cannot be accepted. */
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
  /** Release transport resources. */
  close(): void;
}
/** Private SMTP delivery; local defaults point at Mailpit; diagnostics exclude message content and recipients. */
export function createMailer(
  config: ReturnType<typeof parseServerConfig>,
  suppliedTransport?: MailTransport
) {
  const local = ["127.0.0.1", "localhost", "::1"].includes(config.SMTP_HOST);
  const transport =
    suppliedTransport ??
    nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      ignoreTLS: local && !config.SMTP_SECURE,
      requireTLS: !local && !config.SMTP_SECURE,
      auth: config.SMTP_USER
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  return {
    /** Deliver one private verification/recovery link; caller handles failure safely. */
    async send(mail: AuthMail) {
      const url = new URL("/login", config.APP_ORIGIN);
      url.searchParams.set(
        mail.kind === "verify" ? "verify" : "recover",
        mail.token
      );
      const started = performance.now();
      try {
        await transport.sendMail({
          from: config.SMTP_FROM,
          to: mail.recipient,
          subject:
            mail.kind === "verify"
              ? "Verify your challenge account"
              : "Recover your challenge account",
          text: `${mail.kind === "verify" ? "Verify your email" : "Choose a new password"}: ${url}\nThis link is private and expires. If you did not request it, you can ignore this message.`,
        });
        logBackend("web", "mail_delivered", {
          durationMs: performance.now() - started,
        });
      } catch (error) {
        logBackend(
          "web",
          "mail_failed",
          { durationMs: performance.now() - started },
          error
        );
        throw error;
      }
    },
    /** Close transport resources during shutdown. */
    close() {
      transport.close();
    },
  };
}
