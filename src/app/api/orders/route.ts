import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customer_name,
      phone,
      address,
      dob,
      notes,
      box_size_id,
      flavours,
      time_slot_id,
      payment_method,
      total_price,
    } = body

    // ── Validation ──────────────────────────────────────────────
    if (!customer_name || !phone || !box_size_id || !time_slot_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone, box size, or time slot' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    // ── Check slot is not full ───────────────────────────────────
    const { data: slot, error: slotErr } = await db
      .from('time_slots')
      .select('max_orders, current_orders, label, date, is_active')
      .eq('id', time_slot_id)
      .single()

    if (slotErr || !slot) {
      return NextResponse.json({ error: 'Invalid time slot' }, { status: 400 })
    }

    if (!slot.is_active || slot.current_orders >= slot.max_orders) {
      return NextResponse.json(
        { error: 'This time slot is full. Please choose another.' },
        { status: 409 }
      )
    }

    // ── Get box details ──────────────────────────────────────────
    const { data: box } = await db
      .from('box_sizes')
      .select('label, count, price')
      .eq('id', box_size_id)
      .single()

    // ── Save order ───────────────────────────────────────────────
    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        customer_name,
        phone,
        address: address || null,
        dob: dob || null,
        notes: notes || null,
        box_size_id,
        flavours,
        time_slot_id,
        payment_method,
        total_price,
        status: 'pending',
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('Order insert error:', orderErr)
      return NextResponse.json({ error: 'Failed to save order' }, { status: 500 })
    }

    // ── Increment slot count ─────────────────────────────────────
    await db
      .from('time_slots')
      .update({ current_orders: slot.current_orders + 1 })
      .eq('id', time_slot_id)

    // ── Build flavour list for email ─────────────────────────────
    const flavourLines = Object.entries(flavours as Record<string, number>)
      .map(([id, qty]) => `  • ${id}: ${qty}`)
      .join('\n')

    // ── Send email notification ──────────────────────────────────
    try {
      await resend.emails.send({
        // Before adding a domain in Resend, use: onboarding@resend.dev
        // After adding your domain, change to: orders@yourdomain.com
        from: 'Eversweet Orders <onboarding@resend.dev>',
        to: process.env.ADMIN_EMAIL!,
        subject: `🍡 New Order — ${customer_name} (₹${total_price})`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; color: #333;">
            <h2 style="color: #c9a84c;">🍡 New Eversweet Order</h2>
            <hr style="border-color: #eee;" />

            <h3 style="margin-bottom: 4px;">Customer</h3>
            <p><strong>Name:</strong> ${customer_name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Address:</strong> ${address || '—'}</p>
            <p><strong>DOB:</strong> ${dob || '—'}</p>

            <h3 style="margin-bottom: 4px; margin-top: 16px;">Order</h3>
            <p><strong>Box:</strong> ${box?.label || box_size_id} (${box?.count} pieces)</p>
            <p><strong>Total:</strong> ₹${total_price}</p>
            <p><strong>Payment:</strong> ${payment_method}</p>

            <h3 style="margin-bottom: 4px; margin-top: 16px;">Flavours</h3>
            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${flavourLines}</pre>

            <h3 style="margin-bottom: 4px; margin-top: 16px;">Delivery Slot</h3>
            <p>${slot.label} — ${new Date(slot.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

            ${notes ? `<h3 style="margin-bottom: 4px; margin-top: 16px;">Notes</h3><p>${notes}</p>` : ''}

            <hr style="border-color: #eee; margin-top: 24px;" />
            <p style="font-size: 12px; color: #999;">Order ID: ${order.id}</p>
          </div>
        `,
      })
    } catch (emailErr) {
      // Don't fail the order if email fails — just log it
      console.error('Email send failed:', emailErr)
    }

    return NextResponse.json({ success: true, order_id: order.id })
  } catch (err) {
    console.error('Order API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
