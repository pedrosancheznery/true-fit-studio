import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY!,
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  return await mg.messages.create(process.env.MAILGUN_DOMAIN!, {
    from: process.env.FROM_EMAIL!,
    to: [to],
    subject,
    html,
  });
};