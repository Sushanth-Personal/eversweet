import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const {
      customer_name,
      phone,
      address,
      batch_label,
      delivery_date,
      box_label,
      flavour_summary,
      total_price,
    } = await req.json();

    await resend.emails.send({
      from: "Eversweet <onboarding@resend.dev>",
      to: "sushanthp.calicut@gmail.com",
      subject: `📲 Payment Claimed — ${customer_name} · ₹${total_price}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; color: #222; padding: 24px; background: #fff; border-radius: 8px; border: 1px solid #eee;">
          
          <div style="background: #fff8e6; border: 1px solid #f5c842; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
            <h2 style="color: #b8860b; margin: 0 0 4px;">📲 Payment Screenshot Sent</h2>
            <p style="color: #92640a; font-size: 14px; margin: 0;">
              <strong>${customer_name}</strong> just tapped "Send Payment Screenshot" on WhatsApp.<br/>
              Check WhatsApp and confirm payment before cooking.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px; width: 130px;">Customer</td>
              <td style="padding: 10px 0; font-weight: 700; font-size: 15px;">${customer_name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Phone</td>
              <td style="padding: 10px 0; font-weight: 700; font-size: 15px;">
                <a href="tel:${phone}" style="color: #1976d2; text-decoration: none;">${phone}</a>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Address</td>
              <td style="padding: 10px 0; font-size: 14px;">${address || "Not provided"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Batch</td>
              <td style="padding: 10px 0; font-size: 14px;">${batch_label} · ${delivery_date}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Box</td>
              <td style="padding: 10px 0; font-size: 14px;">${box_label}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Flavours</td>
              <td style="padding: 10px 0; font-size: 14px;">${flavour_summary || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Amount</td>
              <td style="padding: 10px 0; font-weight: 700; font-size: 18px; color: #b8860b;">₹${total_price}</td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />

          <div style="background: #f5f5f5; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #555;">
            ⚠️ <strong>Action needed:</strong> Check WhatsApp for the payment screenshot from ${customer_name}. 
            Confirm payment before marking the order as confirmed in the admin panel.
          </div>

          <p style="font-size: 12px; color: #aaa; margin-top: 20px;">
            Eversweet Admin · Triggered when customer taps "Send Payment Screenshot on WhatsApp"
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Payment alert email error:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
