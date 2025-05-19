import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { name = "N/A", email = "N/A", message = "N/A", phone = "N/A" } = await req.json();

  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'precisionwatchdiamond@gmail.com',
      subject: `New Custom Jewelry Request - [${name}]`,
      html: `
      <h2 style="text-transform: uppercase; font-weight: bold; margin-bottom: 16px;">Custom Request Details</h2>
      <p style="margin-bottom: 16px;">
        <strong>Customer Name:</strong><br/>
        ${name}
      </p>
      <p style="margin-bottom: 32px;">
        <strong>Details:</strong><br/>
        ${message}
      </p>
      <h2 style="text-transform: uppercase; font-weight: bold; margin-top: 40px;">Contact</h2>
      <p>
        <strong style="margin-right: 10px">Email:</strong><a href="mailto:${email}">${email}</a><br/>
        <strong style="margin-right: 10px">Phone:</strong><a href="tel:${phone}">${phone}</a>
      </p>
    `
    });

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Email send error:', error);
    return Response.json({ success: false, error });
  }
}