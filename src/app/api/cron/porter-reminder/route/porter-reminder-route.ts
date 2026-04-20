import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// This route is called every 30 minutes by Vercel Cron (see vercel.json)
// It checks for slots starting in the next 60 minutes and sends a reminder
// if there are any orders in "prepared" status for those slots

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron and not a random person
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const now = new Date()
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

  // Get today's date string (YYYY-MM-DD)
  const todayStr = now.toISOString().split('T')[0]

  // Fetch all active slots for today
  const { data: slots } = await db
    .from('time_slots')
    .select('*')
    .eq('date', todayStr)
    .eq('is_active', true)

  if (!slots || slots.length === 0) {
    return NextResponse.json({ message: 'No slots today' })
  }

  // Find slots that start within the next hour
  const upcomingSlots = slots.filter((slot) => {
    // Parse slot label time e.g. "5:00 PM – 6:00 PM" → get start time
    const startStr = slot.label.split('–')[0].trim() // "5:00 PM"
    const [timePart, ampm] = startStr.split(' ')
    const [hours, minutes] = timePart.split(':').map(Number)
    let hour24 = hours
    if (ampm === 'PM' && hours !== 12) hour24 += 12
    if (ampm === 'AM' && hours === 12) hour24 = 0

    const slotTime = new Date(now)
    slotTime.setHours(hour24, minutes || 0, 0, 0)

    return slotTime > now && slotTime <= oneHourLater
  })

  if (upcomingSlots.length === 0) {
    return NextResponse.json({ message: 'No slots in next hour' })
  }

  // For each upcoming slot, get orders that are "prepared" (ready to dispatch)
  const reminders: { slot: string; orders: { name: string; phone: string; address: string }[] }[] = []

  for (const slot of upcomingSlots) {
    const { data: orders } = await db
      .from('orders')
      .select('customer_name, phone, address')
      .eq('time_slot_id', slot.id)
      .eq('status', 'prepared')

    if (orders && orders.length > 0) {
      reminders.push({
        slot: `${slot.label}`,
        orders: orders.map((o) => ({
          name: o.customer_name,
          phone: o.phone,
          address: o.address || 'No address provided',
        })),
      })
    }
  }

  if (reminders.length === 0) {
    return NextResponse.json({ message: 'No prepared orders in upcoming slots' })
  }

  // Build the email
  const orderRows = reminders
    .map(
      ({ slot, orders }) => `
      <h3 style="color: #c9a84c; margin-bottom: 8px;">🕐 ${slot}</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #f5f0e8;">
            <th style="padding: 8px; text-align: left; font-size: 13px;">Name</th>
            <th style="padding: 8px; text-align: left; font-size: 13px;">Phone</th>
            <th style="padding: 8px; text-align: left; font-size: 13px;">Address</th>
          </tr>
        </thead>
        <tbody>
          ${orders
            .map(
              (o, i) => `
            <tr style="background: ${i % 2 === 0 ? 'white' : '#faf8f5'};">
              <td style="padding: 8px; font-size: 13px;">${o.name}</td>
              <td style="padding: 8px; font-size: 13px;">${o.phone}</td>
              <td style="padding: 8px; font-size: 13px;">${o.address}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`
    )
    .join('')

  const totalOrders = reminders.reduce((sum, r) => sum + r.orders.length, 0)

  await resend.emails.send({
    from: 'Eversweet <onboarding@resend.dev>',
    to: process.env.ADMIN_EMAIL!,
    subject: `⏰ Book Porter Now — ${totalOrders} order${totalOrders > 1 ? 's' : ''} in ~1 hour`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; color: #333;">
        <h2 style="color: #c9a84c;">⏰ Time to Book Porter</h2>
        <p style="color: #666; margin-bottom: 20px;">
          You have <strong>${totalOrders} order${totalOrders > 1 ? 's' : ''}</strong> marked as 
          <em>Prepared</em> with a delivery slot starting in about 1 hour.
        </p>
        ${orderRows}
        <hr style="border-color: #eee; margin-top: 24px;" />
        <p style="font-size: 12px; color: #999;">
          Eversweet Admin · This reminder was sent automatically
        </p>
      </div>
    `,
  })

  return NextResponse.json({ success: true, reminders_sent: totalOrders })
}
