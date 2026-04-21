import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { customer_name, phone, address, slot, total_price } = await req.json()

    await resend.emails.send({
      from: 'Eversweet <onboarding@resend.dev>',
      to: process.env.ADMIN_EMAIL!,
      subject: `📦 Book Porter — ${customer_name} · ${slot}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; color: #222; padding: 24px; background: #fff; border-radius: 8px; border: 1px solid #eee;">
          <h2 style="color: #1976d2; margin-bottom: 4px;">📦 Book Porter Now</h2>
          <p style="color: #888; font-size: 14px; margin-bottom: 24px;">Order is ready for pickup</p>

          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px; width: 120px;">Customer</td>
              <td style="padding: 10px 0; font-weight: 700; font-size: 15px;">${customer_name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Phone</td>
              <td style="padding: 10px 0; font-weight: 700; font-size: 15px;">${phone}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Address</td>
              <td style="padding: 10px 0; font-size: 14px;">${address || 'Not provided'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Slot</td>
              <td style="padding: 10px 0; font-size: 14px;">${slot}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Order Value</td>
              <td style="padding: 10px 0; font-weight: 700; font-size: 15px; color: #b8860b;">₹${total_price}</td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #aaa;">Eversweet Admin · Sent when order marked as Cooked</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Porter email error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
