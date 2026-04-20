'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, BoxSize, TimeSlot, Order } from '@/lib/types'

type Tab = 'orders' | 'products' | 'slots' | 'boxes'

// ── Tiny UI helpers ────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.65rem', color: '#8a7060', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </p>
  )
}

function Input({
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        background: '#2d1a12',
        border: '1px solid rgba(201,168,76,0.2)',
        color: '#f5ede0',
        padding: '10px 12px',
        borderRadius: 4,
        fontSize: '0.85rem',
        marginBottom: 8,
        outline: 'none',
        fontFamily: 'DM Sans, sans-serif',
      }}
    />
  )
}

function ActionBtn({
  children,
  onClick,
  danger = false,
  small = false,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '4px 10px' : '10px 16px',
        borderRadius: 3,
        border: '1px solid',
        borderColor: danger ? 'rgba(192,64,64,0.4)' : 'rgba(201,168,76,0.3)',
        background: 'transparent',
        color: danger ? '#c04040' : '#c9a84c',
        fontSize: small ? '0.68rem' : '0.75rem',
        cursor: 'pointer',
        letterSpacing: '0.08em',
        transition: 'all 0.2s',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {children}
    </button>
  )
}

// ── Admin page ─────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [tab, setTab] = useState<Tab>('orders')

  // Data
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [boxes, setBoxes] = useState<BoxSize[]>([])

  // New product form
  const [np, setNp] = useState({
    name: '', description: '', price: '', is_premium: false, image_url: '',
  })
  // New slot form
  const [ns, setNs] = useState({ label: '', date: '', max_orders: '10' })
  // New box form
  const [nb, setNb] = useState({ label: '', count: '', price: '' })

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // ── Load all data ──────────────────────────────────────────────
  const load = useCallback(async () => {
    const [{ data: o }, { data: p }, { data: s }, { data: b }] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('time_slots').select('*').order('date').order('label'),
      supabase.from('box_sizes').select('*').order('sort_order'),
    ])
    if (o) setOrders(o as Order[])
    if (p) setProducts(p as Product[])
    if (s) setSlots(s as TimeSlot[])
    if (b) setBoxes(b as BoxSize[])
  }, [])

  useEffect(() => {
    if (authed) load()
  }, [authed, load])

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  // ── Login ──────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#160c08',
          padding: 24,
        }}
      >
        <div style={{ width: '100%', maxWidth: 320 }}>
          <p
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: '2rem',
              color: '#c9a84c',
              marginBottom: 4,
              fontWeight: 300,
            }}
          >
            Eversweet
          </p>
          <p style={{ fontSize: '0.75rem', color: '#7a6050', marginBottom: 24 }}>
            Admin Panel
          </p>
          <Input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={setPw}
          />
          {pwError && (
            <p style={{ fontSize: '0.75rem', color: '#c04040', marginBottom: 8 }}>
              Wrong password
            </p>
          )}
          <button
            className="btn-gold"
            style={{ width: '100%' }}
            onClick={() => {
              if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
                setAuthed(true)
                setPwError(false)
              } else {
                setPwError(true)
              }
            }}
          >
            Enter
          </button>
        </div>
      </main>
    )
  }

  // ── Dashboard ──────────────────────────────────────────────────
  return (
    <main
      style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: '24px 16px 80px',
        background: '#160c08',
        minHeight: '100vh',
        color: '#f5ede0',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid rgba(201,168,76,0.15)',
        }}
      >
        <div>
          <p
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: '1.6rem',
              color: '#c9a84c',
              fontWeight: 300,
            }}
          >
            Eversweet Admin
          </p>
          <p style={{ fontSize: '0.7rem', color: '#7a6050' }}>
            {orders.filter((o) => o.status === 'pending').length} pending orders
          </p>
        </div>
        <button
          onClick={load}
          style={{
            background: 'transparent',
            border: '1px solid rgba(201,168,76,0.2)',
            color: '#c9a84c',
            padding: '6px 12px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: '0.72rem',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Flash message */}
      {msg && (
        <div
          style={{
            background: 'rgba(74,138,90,0.15)',
            border: '1px solid rgba(74,138,90,0.3)',
            color: '#4a8a5a',
            padding: '10px 14px',
            borderRadius: 4,
            fontSize: '0.8rem',
            marginBottom: 16,
          }}
        >
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto' }}>
        {(['orders', 'products', 'slots', 'boxes'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 14px',
              borderRadius: 3,
              border: '1px solid',
              borderColor: tab === t ? '#c9a84c' : 'rgba(201,168,76,0.2)',
              background: tab === t ? '#c9a84c' : 'transparent',
              color: tab === t ? '#160c08' : '#c9a84c',
              cursor: 'pointer',
              fontSize: '0.75rem',
              textTransform: 'capitalize',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {t}
            {t === 'orders' && orders.length > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: tab === t ? '#160c08' : '#c9a84c',
                  color: tab === t ? '#c9a84c' : '#160c08',
                  borderRadius: 10,
                  padding: '0 5px',
                  fontSize: '0.65rem',
                }}
              >
                {orders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ORDERS TAB ──────────────────────────────────────────── */}
      {tab === 'orders' && (
        <div>
          <Label>Recent Orders ({orders.length})</Label>
          {orders.length === 0 ? (
            <p style={{ color: '#7a6050', fontSize: '0.85rem', padding: 20, textAlign: 'center' }}>
              No orders yet
            </p>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                style={{
                  background: '#24120c',
                  border: '1px solid rgba(201,168,76,0.1)',
                  borderRadius: 6,
                  padding: '12px 14px',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <p style={{ fontSize: '0.87rem', fontWeight: 500 }}>{o.customer_name}</p>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      padding: '2px 7px',
                      borderRadius: 3,
                      background:
                        o.status === 'confirmed'
                          ? 'rgba(74,138,90,0.15)'
                          : 'rgba(201,168,76,0.12)',
                      color: o.status === 'confirmed' ? '#4a8a5a' : '#c9a84c',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {o.status}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#8a7060', marginBottom: 2 }}>
                  {o.phone} · ₹{o.total_price} · {o.payment_method}
                </p>
                <p style={{ fontSize: '0.7rem', color: '#5a4030', marginBottom: 8 }}>
                  {new Date(o.created_at).toLocaleString('en-IN')}
                </p>
                {o.address && (
                  <p style={{ fontSize: '0.72rem', color: '#7a6050', marginBottom: 6 }}>
                    📍 {o.address}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  {o.status !== 'confirmed' && (
                    <ActionBtn
                      small
                      onClick={async () => {
                        await supabase
                          .from('orders')
                          .update({ status: 'confirmed' })
                          .eq('id', o.id)
                        load()
                        flash('Order confirmed ✓')
                      }}
                    >
                      Confirm
                    </ActionBtn>
                  )}
                  {o.status !== 'cancelled' && (
                    <ActionBtn
                      small
                      danger
                      onClick={async () => {
                        await supabase
                          .from('orders')
                          .update({ status: 'cancelled' })
                          .eq('id', o.id)
                        load()
                        flash('Order cancelled')
                      }}
                    >
                      Cancel
                    </ActionBtn>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── PRODUCTS TAB ────────────────────────────────────────── */}
      {tab === 'products' && (
        <div>
          <Label>Products ({products.length})</Label>

          {products.map((prod) => (
            <div
              key={prod.id}
              style={{
                background: '#24120c',
                border: '1px solid rgba(201,168,76,0.1)',
                borderRadius: 6,
                padding: '10px 14px',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {prod.image_url && (
                <img
                  src={prod.image_url}
                  alt={prod.name}
                  style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{prod.name}</p>
                <p style={{ fontSize: '0.7rem', color: '#8a7060' }}>
                  ₹{prod.price} · {prod.is_premium ? 'Premium' : 'Regular'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <ActionBtn
                  small
                  onClick={async () => {
                    await supabase
                      .from('products')
                      .update({ is_available: !prod.is_available })
                      .eq('id', prod.id)
                    load()
                    flash(`${prod.name} ${prod.is_available ? 'hidden' : 'shown'}`)
                  }}
                >
                  {prod.is_available ? 'Hide' : 'Show'}
                </ActionBtn>
                <ActionBtn
                  small
                  danger
                  onClick={async () => {
                    if (!confirm(`Delete ${prod.name}?`)) return
                    await supabase.from('products').delete().eq('id', prod.id)
                    load()
                    flash(`${prod.name} deleted`)
                  }}
                >
                  Delete
                </ActionBtn>
              </div>
            </div>
          ))}

          {/* Add product form */}
          <div
            style={{
              background: '#24120c',
              border: '1px solid rgba(201,168,76,0.15)',
              borderRadius: 6,
              padding: 16,
              marginTop: 16,
            }}
          >
            <Label>Add New Product</Label>
            <Input
              placeholder="Product Name *"
              value={np.name}
              onChange={(v) => setNp((p) => ({ ...p, name: v }))}
            />
            <Input
              placeholder="Description"
              value={np.description}
              onChange={(v) => setNp((p) => ({ ...p, description: v }))}
            />
            <Input
              placeholder="Price (₹) *"
              type="number"
              value={np.price}
              onChange={(v) => setNp((p) => ({ ...p, price: v }))}
            />
            <Input
              placeholder="Image URL (from Supabase Storage or external)"
              value={np.image_url}
              onChange={(v) => setNp((p) => ({ ...p, image_url: v }))}
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.8rem',
                marginBottom: 12,
                cursor: 'pointer',
                color: '#c8b89a',
              }}
            >
              <input
                type="checkbox"
                checked={np.is_premium}
                onChange={(e) => setNp((p) => ({ ...p, is_premium: e.target.checked }))}
                style={{ width: 'auto', accentColor: '#c9a84c' }}
              />
              Mark as Premium
            </label>
            <button
              className="btn-gold"
              disabled={saving || !np.name || !np.price}
              onClick={async () => {
                setSaving(true)
                await supabase.from('products').insert({
                  name: np.name,
                  description: np.description,
                  price: Number(np.price),
                  is_premium: np.is_premium,
                  image_url: np.image_url || null,
                  sort_order: products.length + 1,
                })
                setNp({ name: '', description: '', price: '', is_premium: false, image_url: '' })
                await load()
                setSaving(false)
                flash(`${np.name} added ✓`)
              }}
            >
              {saving ? 'Adding…' : 'Add Product'}
            </button>
          </div>
        </div>
      )}

      {/* ── SLOTS TAB ───────────────────────────────────────────── */}
      {tab === 'slots' && (
        <div>
          <Label>Time Slots ({slots.length})</Label>

          {slots.map((s) => (
            <div
              key={s.id}
              style={{
                background: '#24120c',
                border: '1px solid rgba(201,168,76,0.1)',
                borderRadius: 6,
                padding: '10px 14px',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: '0.7rem', color: '#8a7060' }}>
                  {new Date(s.date).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {' · '}
                  {s.current_orders}/{s.max_orders} orders
                  {' · '}
                  <span style={{ color: s.is_active ? '#4a8a5a' : '#c04040' }}>
                    {s.is_active ? 'Active' : 'Disabled'}
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <ActionBtn
                  small
                  onClick={async () => {
                    await supabase
                      .from('time_slots')
                      .update({ is_active: !s.is_active })
                      .eq('id', s.id)
                    load()
                  }}
                >
                  {s.is_active ? 'Disable' : 'Enable'}
                </ActionBtn>
                <ActionBtn
                  small
                  danger
                  onClick={async () => {
                    if (!confirm('Delete this slot?')) return
                    await supabase.from('time_slots').delete().eq('id', s.id)
                    load()
                    flash('Slot deleted')
                  }}
                >
                  Delete
                </ActionBtn>
              </div>
            </div>
          ))}

          {/* Add slot form */}
          <div
            style={{
              background: '#24120c',
              border: '1px solid rgba(201,168,76,0.15)',
              borderRadius: 6,
              padding: 16,
              marginTop: 16,
            }}
          >
            <Label>Add New Time Slot</Label>
            <Input
              placeholder="Label (e.g. 5:00 PM – 6:00 PM) *"
              value={ns.label}
              onChange={(v) => setNs((s) => ({ ...s, label: v }))}
            />
            <Input
              type="date"
              placeholder="Date *"
              value={ns.date}
              onChange={(v) => setNs((s) => ({ ...s, date: v }))}
            />
            <Input
              type="number"
              placeholder="Max orders (default 10)"
              value={ns.max_orders}
              onChange={(v) => setNs((s) => ({ ...s, max_orders: v }))}
            />
            <button
              className="btn-gold"
              disabled={saving || !ns.label || !ns.date}
              onClick={async () => {
                setSaving(true)
                await supabase.from('time_slots').insert({
                  label: ns.label,
                  date: ns.date,
                  max_orders: Number(ns.max_orders) || 10,
                  current_orders: 0,
                  is_active: true,
                })
                setNs({ label: '', date: '', max_orders: '10' })
                await load()
                setSaving(false)
                flash('Slot added ✓')
              }}
            >
              {saving ? 'Adding…' : 'Add Slot'}
            </button>
          </div>
        </div>
      )}

      {/* ── BOXES TAB ───────────────────────────────────────────── */}
      {tab === 'boxes' && (
        <div>
          <Label>Box Sizes ({boxes.length})</Label>

          {boxes.map((box) => (
            <div
              key={box.id}
              style={{
                background: '#24120c',
                border: '1px solid rgba(201,168,76,0.1)',
                borderRadius: 6,
                padding: '10px 14px',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{box.label}</p>
                <p style={{ fontSize: '0.7rem', color: '#8a7060' }}>
                  {box.count} pieces · ₹{box.price} ·{' '}
                  <span style={{ color: box.is_active ? '#4a8a5a' : '#c04040' }}>
                    {box.is_active ? 'Active' : 'Hidden'}
                  </span>
                </p>
              </div>
              <ActionBtn
                small
                onClick={async () => {
                  await supabase
                    .from('box_sizes')
                    .update({ is_active: !box.is_active })
                    .eq('id', box.id)
                  load()
                }}
              >
                {box.is_active ? 'Hide' : 'Show'}
              </ActionBtn>
            </div>
          ))}

          {/* Add box form */}
          <div
            style={{
              background: '#24120c',
              border: '1px solid rgba(201,168,76,0.15)',
              borderRadius: 6,
              padding: 16,
              marginTop: 16,
            }}
          >
            <Label>Add New Box Size</Label>
            <Input
              placeholder="Label (e.g. Box of 20) *"
              value={nb.label}
              onChange={(v) => setNb((b) => ({ ...b, label: v }))}
            />
            <Input
              type="number"
              placeholder="Number of pieces *"
              value={nb.count}
              onChange={(v) => setNb((b) => ({ ...b, count: v }))}
            />
            <Input
              type="number"
              placeholder="Price (₹) *"
              value={nb.price}
              onChange={(v) => setNb((b) => ({ ...b, price: v }))}
            />
            <button
              className="btn-gold"
              disabled={saving || !nb.label || !nb.count || !nb.price}
              onClick={async () => {
                setSaving(true)
                await supabase.from('box_sizes').insert({
                  label: nb.label,
                  count: Number(nb.count),
                  price: Number(nb.price),
                  is_active: true,
                  sort_order: boxes.length + 1,
                })
                setNb({ label: '', count: '', price: '' })
                await load()
                setSaving(false)
                flash('Box size added ✓')
              }}
            >
              {saving ? 'Adding…' : 'Add Box Size'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
