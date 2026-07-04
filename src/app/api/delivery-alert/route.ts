// Location: src/app/api/delivery-alert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const {
      customer_name,
      phone,
      address,
      distance_km,
      trip_date,
      sequence,
      total,
      completed,
    } = await req.json();

    await resend.emails.send({
      from: "Eversweet <onboarding@resend.dev>",
      to: process.env.ADMIN_EMAIL!,
      subject: `✅ Delivered — ${customer_name} (${completed}/${total} done)`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; color: #222; padding: 24px; background: #fff; border-radius: 8px; border: 1px solid #eee;">
          <div style="background: #f0faf4; border: 1px solid #34d97b; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
            <h2 style="color: #1fa855; margin: 0 0 4px;">✅ Delivery Confirmed</h2>
            <p style="color: #2f7d4d; font-size: 14px; margin: 0;">
              The porter just marked <strong>${customer_name}</strong>'s order as delivered.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px; width: 130px;">Customer</td>
              <td style="padding: 10px 0; font-weight: 700; font-size: 15px;">${customer_name}</td>
            </tr>
            ${
              phone
                ? `<tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Phone</td>
              <td style="padding: 10px 0; font-weight: 700; font-size: 15px;">
                <a href="tel:${phone}" style="color: #1976d2; text-decoration: none;">${phone}</a>
              </td>
            </tr>`
                : ""
            }
            ${
              address
                ? `<tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Address</td>
              <td style="padding: 10px 0; font-size: 14px;">${address}</td>
            </tr>`
                : ""
            }
            ${
              distance_km
                ? `<tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Distance (leg)</td>
              <td style="padding: 10px 0; font-size: 14px;">${distance_km} km</td>
            </tr>`
                : ""
            }
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Trip Date</td>
              <td style="padding: 10px 0; font-size: 14px;">${trip_date || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #888; font-size: 14px;">Progress</td>
              <td style="padding: 10px 0; font-weight: 700; font-size: 15px; color: #1fa855;">${completed} of ${total} stops delivered</td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #aaa;">
            Eversweet Admin · Sent automatically from the TVM delivery tracker
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delivery alert email error:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
