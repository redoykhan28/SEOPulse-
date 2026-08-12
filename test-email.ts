import { Resend } from 'resend';
import * as dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  try {
    const data = await resend.emails.send({
      from: 'SEOPulse Alerts <onboarding@resend.dev>',
      to: 'redoykhan.rk14@gmail.com', // Assuming this is the email
      subject: 'Test Email',
      text: 'This is a test',
    });
    console.log('Success:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}
test();
