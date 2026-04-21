'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, BoxSize, TimeSlot, Order } from '@/lib/types'

type Tab = 'orders' | 'dispatched' | 'dashboard' | 'products' | 'slots' | 'boxes'

// ── Status flow ────────────────────────────────────────────────────
const STATUS_FLOW = ['pending', 'confirmed', 'prepared', 'porter_booked', 'dispatched'] as const
const STATUS_LABELS: Record<string, string> = {
  pending:       'Pending',
  confirmed:     'Confirmed',
  prepared:      'Prepared',
  porter_booked: 'Porter Booked',
  dispatched:    'Dispatched',
  cancelled:     'Cancelled',
}
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:       { bg: 'rgba(201,168,76,0.15)',  text: '#e8c97a' },
  confirmed:     { bg: 'rgba(74,138,90,0.15)',   text: '#6abf7a' },
  prepared:      { bg: 'rgba(100,149,237,0.15)', text: '#7aabf0' },
  porter_booked: { bg: 'rgba(200,100,220,0.15)', text: '#d47ae8' },
  dispatched:    { bg: 'rgba(74,138,90,0.2)',    text: '#7acf8a' },
  cancelled:     { bg: 'rgba(220,80,80,0.15)',   text: '#e07070' },
}

function nextStatus(current: string): string | null {
  const idx = STATUS_FLOW.indexOf(current as typeof STATUS_FLOW[number])
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

// ── Design tokens ──────────────────────────────────────────────────
const C = {
  bg:      '#120a06',
  surface: '#1e1008',
  card:    '#271408',
  border:  'rgba(201,168,76,0.2)',
  gold:    '#e8c97a',
  goldDim: '#c9a84c',
  cream:   '#f0e4d0',
  muted:   '#a08060',
  dim:     '#705040',
  red:     '#e07070',
  green:   '#6abf7a',
  blue:    '#7aabf0',
}

const BASE_TEXT: React.CSSProperties = {
  fontFamily: 'DM Sans, sans-serif',
  color: C.cream,
}

// ── Copy button ────────────────────────────────────────────────────
function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy} style={{
      padding: '5px 12px',
      borderRadius: 4,
      border: `1px solid ${copied ? 'rgba(106,191,122,0.6)' : 'rgba(201,168,76,0.5)'}`,
      background: copied ? 'rgba(74,138,90,0.2)' : 'rgba(201,168,76,0.1)',
      color: copied ? C.green : C.gold,
      fontSize: '0.75rem',
      fontWeight: 500,
      cursor: 'pointer',
      letterSpacing: '0.04em',
      transition: 'all 0.2s',
      fontFamily: 'DM Sans, sans-serif',
      whiteSpace: 'nowrap' as const,
    }}>
      {copied ? `✓ Copied` : `Copy ${label}`}
    </button>
  )
}

// ── Input ──────────────────────────────────────────────────────────
function Input({ placeholder, value, onChange, type = 'text' }: {
  placeholder: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <input type={type} placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        background: '#1e1008',
        border: `1px solid ${C.border}`,
        color: C.cream,
        padding: '11px 14px',
        borderRadius: 5,
        fontSize: '0.9rem',
        marginBottom: 10,
        outline: 'none',
        fontFamily: 'DM Sans, sans-serif',
      }}
    />
  )
}

// ── Button ─────────────────────────────────────────────────────────
function Btn({ children, onClick, danger = false, primary = false, disabled = false, full = false }: {
  children: React.ReactNode; onClick: () => void
  danger?: boolean; primary?: boolean; disabled?: boolean; full?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '6px 14px',
      borderRadius: 4,
      border: '1px solid',
      borderColor: danger ? 'rgba(220,80,80,0.5)' : primary ? C.gold : C.border,
      background: primary ? 'rgba(201,168,76,0.15)' : danger ? 'rgba(220,80,80,0.08)' : 'transparent',
      color: danger ? C.red : primary ? C.gold : C.muted,
      fontSize: '0.8rem',
      fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'all 0.2s',
      fontFamily: 'DM Sans, sans-serif',
      whiteSpace: 'nowrap' as const,
      width: full ? '100%' : 'auto',
    }}>
      {children}
    </button>
  )
}

// ── Stat card ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: '16px 18px',
    }}>
      <p style={{ fontSize: '0.7rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: '1.6rem', fontFamily: 'Cormorant Garamond, serif', color: color || C.gold, fontWeight: 400, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '0.72rem', color: C.dim, marginTop: 5 }}>{sub}</p>}
    </div>
  )
}

// ── Order card ─────────────────────────────────────────────────────
function OrderCard({ order, isRepeat, slotLabel, productMap, onStatusChange, onCancel }: {
  order: Order; isRepeat: boolean; slotLabel: string
  productMap: Record<string, string>
  onStatusChange: (id: string, status: string) => Promise<void>
  onCancel: (id: string) => Promise<void>
}) {
  const [updating, setUpdating] = useState(false)
  const next = nextStatus(order.status)
  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending

  // Build readable flavour list using product names
  const flavourList = order.flavours
    ? Object.entries(order.flavours as Record<string, number>)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => `${productMap[id] || 'Unknown'} ×${q}`)
        .join(', ')
    : ''

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${order.status === 'porter_booked' ? 'rgba(200,100,220,0.4)' : C.border}`,
      borderRadius: 8,
      padding: '14px 16px',
      marginBottom: 10,
    }}>

      {/* Name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: '1rem', fontWeight: 600, color: C.cream }}>{order.customer_name}</span>
        <CopyBtn value={order.customer_name} label="Name" />
        {isRepeat && (
          <span style={{
            fontSize: '0.65rem', padding: '2px 8px', borderRadius: 10,
            background: 'rgba(100,149,237,0.15)', color: C.blue, letterSpacing: '0.08em',
          }}>
            🔄 REPEAT
          </span>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: '0.7rem', padding: '3px 9px', borderRadius: 4,
          background: sc.bg, color: sc.text, letterSpacing: '0.08em',
          textTransform: 'uppercase' as const, fontWeight: 600,
        }}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Phone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '0.88rem', color: C.cream }}>📞 {order.phone}</span>
        <CopyBtn value={order.phone} label="Phone" />
      </div>

      {/* Address */}
      {order.address && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: '0.85rem', color: C.muted, flex: 1 }}>📍 {order.address}</span>
          <CopyBtn value={order.address} label="Address" />
        </div>
      )}

      {/* Slot + price */}
      <p style={{ fontSize: '0.82rem', color: C.muted, marginBottom: 4 }}>
        🕐 {slotLabel} · <span style={{ color: C.gold }}>₹{order.total_price}</span> · {order.payment_method}
      </p>

      {/* Flavours — readable names */}
      {flavourList && (
        <p style={{ fontSize: '0.8rem', color: C.dim, marginBottom: 4 }}>
          🍡 {flavourList}
        </p>
      )}

      {/* Notes */}
      {order.notes && (
        <p style={{ fontSize: '0.8rem', color: '#7a9060', fontStyle: 'italic' as const, marginBottom: 4 }}>
          💬 {order.notes}
        </p>
      )}

      <p style={{ fontSize: '0.72rem', color: C.dim, marginBottom: 10 }}>
        {new Date(order.created_at).toLocaleString('en-IN')}
        {order.dob ? ` · DOB: ${order.dob}` : ''}
      </p>

      {/* Action buttons */}
      {order.status !== 'dispatched' && order.status !== 'cancelled' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {next && (
            <button
              disabled={updating}
              onClick={async () => {
                setUpdating(true)
                await onStatusChange(order.id, next)
                setUpdating(false)
              }}
              style={{
                padding: '7px 16px',
                borderRadius: 4,
                border: `1px solid ${C.gold}`,
                background: 'rgba(201,168,76,0.15)',
                color: C.gold,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: updating ? 'not-allowed' : 'pointer',
                opacity: updating ? 0.5 : 1,
                transition: 'all 0.2s',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {updating ? '…' : `→ ${STATUS_LABELS[next]}`}
            </button>
          )}
          <Btn danger disabled={updating} onClick={async () => {
            if (!confirm(`Cancel order for ${order.customer_name}?`)) return
            setUpdating(true)
            await onCancel(order.id)
            setUpdating(false)
          }}>
            Cancel
          </Btn>
        </div>
      )}
    </div>
  )
}

// ── Expense type ───────────────────────────────────────────────────
type Expense = {
  id: string
  description: string
  amount: number
  category: string
  date: string
  created_at: string
}

// ── Main ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [tab, setTab] = useState<Tab>('orders')

  const [orders, setOrders] = useState<Order[]>([])
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [boxes, setBoxes] = useState<BoxSize[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [repeatPhones, setRepeatPhones] = useState<Set<string>>(new Set())

  // Product map: id → name (for flavour display)
  const productMap: Record<string, string> = {}
  products.forEach((p) => { productMap[p.id] = p.name })

  // Forms
  const [np, setNp] = useState({ name: '', description: '', price: '', is_premium: false, image_url: '' })
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [ep, setEp] = useState({ name: '', description: '', price: '', is_premium: false, image_url: '' })
  const [ns, setNs] = useState({ label: '', date: '', max_orders: '10' })
  const [nb, setNb] = useState({ label: '', count: '', price: '' })
  const [ne, setNe] = useState({ description: '', amount: '', category: 'ingredient', date: new Date().toISOString().split('T')[0] })

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Dashboard filter
  const [dashPeriod, setDashPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week')

  // ── Load ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const [{ data: o }, { data: s }, { data: p }, { data: b }, { data: ex }] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('time_slots').select('*').order('date').order('label'),
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('box_sizes').select('*').order('sort_order'),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
    ])
    if (o) {
      setOrders(o as Order[])
      const counts: Record<string, number> = {}
      ;(o as Order[]).forEach((ord) => { counts[ord.phone] = (counts[ord.phone] || 0) + 1 })
      setRepeatPhones(new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([ph]) => ph)))
    }
    if (s) setSlots(s as TimeSlot[])
    if (p) setProducts(p as Product[])
    if (b) setBoxes(b as BoxSize[])
    if (ex) setExpenses(ex as Expense[])
  }, [])

  useEffect(() => { if (authed) load() }, [authed, load])

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  function getSlotLabel(slotId: string) {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return '—'
    return `${slot.label} · ${new Date(slot.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
  }

  async function handleStatusChange(id: string, status: string) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    if (error) { flash('Error updating status: ' + error.message); return }
    await load()
    flash(`Marked as ${STATUS_LABELS[status]} ✓`)
  }

  async function handleCancel(id: string) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
    await load(); flash('Order cancelled')
  }

  const activeOrders = orders.filter((o) => o.status !== 'dispatched' && o.status !== 'cancelled')
  const dispatchedOrders = orders.filter((o) => o.status === 'dispatched')
  const pendingCount = orders.filter((o) => o.status === 'pending').length

  // ── Dashboard calculations ───────────────────────────────────────
  function filterByPeriod(items: { created_at: string }[]) {
    const now = new Date()
    return items.filter((item) => {
      const d = new Date(item.created_at)
      if (dashPeriod === 'today') return d.toDateString() === now.toDateString()
      if (dashPeriod === 'week') return (now.getTime() - d.getTime()) < 7 * 86400000
      if (dashPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      return true
    })
  }

  function filterExpensesByPeriod(items: Expense[]) {
    const now = new Date()
    return items.filter((item) => {
      const d = new Date(item.date)
      if (dashPeriod === 'today') return d.toDateString() === now.toDateString()
      if (dashPeriod === 'week') return (now.getTime() - d.getTime()) < 7 * 86400000
      if (dashPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      return true
    })
  }

  const paidOrders = filterByPeriod(
    orders.filter((o) => o.status !== 'cancelled' && o.status !== 'pending')
  ) as Order[]

  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_price || 0), 0)
  const totalExpenses = filterExpensesByPeriod(expenses).reduce((sum, e) => sum + (e.amount || 0), 0)
  const profit = totalRevenue - totalExpenses

  // Top flavours
  const flavourCounts: Record<string, number> = {}
  paidOrders.forEach((o) => {
    if (!o.flavours) return
    Object.entries(o.flavours as Record<string, number>).forEach(([id, qty]) => {
      const name = productMap[id] || id
      flavourCounts[name] = (flavourCounts[name] || 0) + qty
    })
  })
  const topFlavours = Object.entries(flavourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)

  // Revenue by box size
  const boxRevenue: Record<string, { count: number; revenue: number }> = {}
  paidOrders.forEach((o) => {
    const box = boxes.find((b) => b.id === o.box_size_id)
    const label = box?.label || 'Unknown'
    if (!boxRevenue[label]) boxRevenue[label] = { count: 0, revenue: 0 }
    boxRevenue[label].count++
    boxRevenue[label].revenue += o.total_price || 0
  })

  // ── Login ──────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', color: C.gold, marginBottom: 4, fontWeight: 300 }}>Eversweet</p>
          <p style={{ fontSize: '0.85rem', color: C.muted, marginBottom: 24 }}>Admin Panel</p>
          <Input type="password" placeholder="Password" value={pw} onChange={setPw} />
          {pwError && <p style={{ fontSize: '0.82rem', color: C.red, marginBottom: 8 }}>Wrong password</p>}
          <button className="btn-gold" style={{ width: '100%' }}
            onClick={() => {
              if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) { setAuthed(true); setPwError(false) }
              else setPwError(true)
            }}>
            Enter
          </button>
        </div>
      </main>
    )
  }

  // ── Dashboard ──────────────────────────────────────────────────
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 80px', background: C.bg, minHeight: '100vh', ...BASE_TEXT }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        <div>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', color: C.gold, fontWeight: 300 }}>Eversweet Admin</p>
          <p style={{ fontSize: '0.82rem', color: pendingCount > 0 ? C.gold : C.muted }}>
            {pendingCount > 0 ? `${pendingCount} new order${pendingCount > 1 ? 's' : ''} waiting` : 'All caught up ✓'}
          </p>
        </div>
        <button onClick={load} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.gold, padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Status legend */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto' as const, paddingBottom: 4 }}>
        {STATUS_FLOW.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', padding: '3px 7px', borderRadius: 3, background: STATUS_COLORS[s].bg, color: STATUS_COLORS[s].text, fontWeight: 600 }}>
              {STATUS_LABELS[s]}
            </span>
            {i < STATUS_FLOW.length - 1 && <span style={{ color: C.dim, fontSize: '0.7rem' }}>→</span>}
          </div>
        ))}
      </div>

      {/* Flash */}
      {msg && (
        <div style={{ background: 'rgba(74,138,90,0.15)', border: '1px solid rgba(74,138,90,0.4)', color: C.green, padding: '10px 14px', borderRadius: 5, fontSize: '0.85rem', marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto' as const, paddingBottom: 4 }}>
        {([
          { id: 'orders',     label: `Orders (${activeOrders.length})` },
          { id: 'dispatched', label: `Dispatched (${dispatchedOrders.length})` },
          { id: 'dashboard',  label: '📊 Dashboard' },
          { id: 'products',   label: 'Products' },
          { id: 'slots',      label: 'Slots' },
          { id: 'boxes',      label: 'Boxes' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 16px', borderRadius: 4, border: '1px solid',
            borderColor: tab === t.id ? C.gold : C.border,
            background: tab === t.id ? C.gold : 'transparent',
            color: tab === t.id ? C.bg : C.muted,
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: tab === t.id ? 600 : 400,
            letterSpacing: '0.04em', whiteSpace: 'nowrap' as const,
            fontFamily: 'DM Sans, sans-serif',
          }}>
            {t.label}
            {t.id === 'orders' && pendingCount > 0 && (
              <span style={{ marginLeft: 6, background: '#c04040', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: '0.65rem' }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ACTIVE ORDERS ────────────────────────────────────────── */}
      {tab === 'orders' && (
        <div>
          {activeOrders.length === 0 ? (
            <p style={{ color: C.muted, fontSize: '0.9rem', textAlign: 'center', padding: 48 }}>No active orders</p>
          ) : (
            activeOrders.map((o) => (
              <OrderCard key={o.id} order={o} isRepeat={repeatPhones.has(o.phone)}
                slotLabel={getSlotLabel(o.time_slot_id)} productMap={productMap}
                onStatusChange={handleStatusChange} onCancel={handleCancel} />
            ))
          )}
        </div>
      )}

      {/* ── DISPATCHED ───────────────────────────────────────────── */}
      {tab === 'dispatched' && (
        <div>
          <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 14 }}>
            Dispatched Orders ({dispatchedOrders.length})
          </p>
          {dispatchedOrders.length === 0 ? (
            <p style={{ color: C.muted, fontSize: '0.9rem', textAlign: 'center', padding: 48 }}>No dispatched orders yet</p>
          ) : (
            dispatchedOrders.map((o) => (
              <div key={o.id} style={{ background: C.surface, border: `1px solid rgba(74,138,90,0.15)`, borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{o.customer_name}</p>
                      {repeatPhones.has(o.phone) && <span style={{ fontSize: '0.65rem', color: C.blue }}>🔄</span>}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: C.muted }}>{o.phone} · <span style={{ color: C.gold }}>₹{o.total_price}</span></p>
                    {o.address && <p style={{ fontSize: '0.78rem', color: C.dim }}>📍 {o.address}</p>}
                    <p style={{ fontSize: '0.72rem', color: C.dim, marginTop: 3 }}>{getSlotLabel(o.time_slot_id)}</p>
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 3, background: 'rgba(74,138,90,0.15)', color: C.green }}>✓ Done</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── DASHBOARD ────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div>
          {/* Period selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {(['today', 'week', 'month', 'all'] as const).map((p) => (
              <button key={p} onClick={() => setDashPeriod(p)} style={{
                padding: '7px 14px', borderRadius: 4, border: '1px solid',
                borderColor: dashPeriod === p ? C.gold : C.border,
                background: dashPeriod === p ? 'rgba(201,168,76,0.15)' : 'transparent',
                color: dashPeriod === p ? C.gold : C.muted,
                fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                textTransform: 'capitalize' as const,
              }}>
                {p === 'all' ? 'All Time' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Today'}
              </button>
            ))}
          </div>

          {/* Key stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <StatCard label="Revenue" value={`₹${totalRevenue.toLocaleString()}`} sub={`${paidOrders.length} orders`} color={C.gold} />
            <StatCard label="Expenses" value={`₹${totalExpenses.toLocaleString()}`} sub={`${filterExpensesByPeriod(expenses).length} entries`} color={C.red} />
            <StatCard label="Profit" value={`₹${profit.toLocaleString()}`} sub={profit >= 0 ? 'Net positive' : 'Net negative'} color={profit >= 0 ? C.green : C.red} />
            <StatCard label="Avg Order" value={paidOrders.length > 0 ? `₹${Math.round(totalRevenue / paidOrders.length)}` : '—'} sub="per order" color={C.blue} />
          </div>

          {/* Top flavours */}
          {topFlavours.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
              <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 14 }}>
                Top Flavours
              </p>
              {topFlavours.map(([name, count], i) => {
                const max = topFlavours[0][1]
                return (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.85rem', color: i === 0 ? C.gold : C.cream }}>{name}</span>
                      <span style={{ fontSize: '0.82rem', color: C.muted }}>{count} pieces</span>
                    </div>
                    <div style={{ height: 4, background: C.surface, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: i === 0 ? C.gold : C.goldDim, borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Box size breakdown */}
          {Object.keys(boxRevenue).length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
              <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 14 }}>
                Sales by Box Size
              </p>
              {Object.entries(boxRevenue).sort(([, a], [, b]) => b.revenue - a.revenue).map(([label, data]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: '0.85rem' }}>{label}</span>
                  <div style={{ textAlign: 'right' as const }}>
                    <p style={{ fontSize: '0.85rem', color: C.gold }}>₹{data.revenue.toLocaleString()}</p>
                    <p style={{ fontSize: '0.7rem', color: C.muted }}>{data.count} order{data.count > 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Repeat customers count */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
            <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Customers</p>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <p style={{ fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif', color: C.gold }}>{new Set(paidOrders.map((o) => o.phone)).size}</p>
                <p style={{ fontSize: '0.72rem', color: C.muted }}>Unique customers</p>
              </div>
              <div>
                <p style={{ fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif', color: C.blue }}>{repeatPhones.size}</p>
                <p style={{ fontSize: '0.72rem', color: C.muted }}>Repeat customers</p>
              </div>
            </div>
          </div>

          {/* Expenses log */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
            <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 14 }}>
              Expense Log
            </p>
            {filterExpensesByPeriod(expenses).length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: C.dim, textAlign: 'center', padding: '16px 0' }}>No expenses recorded</p>
            ) : (
              filterExpensesByPeriod(expenses).map((e) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid rgba(201,168,76,0.08)` }}>
                  <div>
                    <p style={{ fontSize: '0.85rem' }}>{e.description}</p>
                    <p style={{ fontSize: '0.7rem', color: C.dim }}>{e.category} · {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.9rem', color: C.red }}>₹{e.amount}</span>
                    <button onClick={async () => {
                      await supabase.from('expenses').delete().eq('id', e.id)
                      load()
                    }} style={{ background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                  </div>
                </div>
              ))
            )}

            {/* Add expense */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <p style={{ fontSize: '0.72rem', color: C.muted, marginBottom: 10 }}>Add Expense</p>
              <Input placeholder="Description (e.g. Mango pulp 2kg) *" value={ne.description} onChange={(v) => setNe((e) => ({ ...e, description: v }))} />
              <Input placeholder="Amount ₹ *" type="number" value={ne.amount} onChange={(v) => setNe((e) => ({ ...e, amount: v }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select value={ne.category} onChange={(e) => setNe((n) => ({ ...n, category: e.target.value }))}
                  style={{ background: '#1e1008', border: `1px solid ${C.border}`, color: C.cream, padding: '11px 14px', borderRadius: 5, fontSize: '0.88rem', marginBottom: 10, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}>
                  <option value="ingredient">Ingredient</option>
                  <option value="packaging">Packaging</option>
                  <option value="delivery">Delivery</option>
                  <option value="equipment">Equipment</option>
                  <option value="other">Other</option>
                </select>
                <Input type="date" placeholder="Date" value={ne.date} onChange={(v) => setNe((e) => ({ ...e, date: v }))} />
              </div>
              <button className="btn-gold" disabled={saving || !ne.description || !ne.amount}
                onClick={async () => {
                  setSaving(true)
                  await supabase.from('expenses').insert({ description: ne.description, amount: Number(ne.amount), category: ne.category, date: ne.date })
                  setNe({ description: '', amount: '', category: 'ingredient', date: new Date().toISOString().split('T')[0] })
                  await load(); setSaving(false); flash('Expense added ✓')
                }}>
                {saving ? 'Adding…' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCTS ─────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div>
          <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Products ({products.length})</p>
          {products.map((prod) => (
            <div key={prod.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
              {editingProduct === prod.id ? (
                <div style={{ padding: '14px 16px' }}>
                  <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Editing: {prod.name}</p>
                  <Input placeholder="Name *" value={ep.name} onChange={(v) => setEp((p) => ({ ...p, name: v }))} />
                  <Input placeholder="Description" value={ep.description} onChange={(v) => setEp((p) => ({ ...p, description: v }))} />
                  <Input placeholder="Image URL" value={ep.image_url} onChange={(v) => setEp((p) => ({ ...p, image_url: v }))} />
                  {ep.image_url && (
                    <img src={ep.image_url} alt="preview" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginBottom: 10, border: `1px solid ${C.border}` }} />
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 14, cursor: 'pointer', color: C.cream }}>
                    <input type="checkbox" checked={ep.is_premium} onChange={(e) => setEp((p) => ({ ...p, is_premium: e.target.checked }))} style={{ width: 'auto', accentColor: C.gold }} />
                    Premium
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-gold" disabled={saving} style={{ flex: 1, padding: '11px' }}
                      onClick={async () => {
                        setSaving(true)
                        await supabase.from('products').update({ name: ep.name, description: ep.description, is_premium: ep.is_premium, image_url: ep.image_url || null }).eq('id', prod.id)
                        setEditingProduct(null)
                        await load(); setSaving(false); flash(`${ep.name} updated ✓`)
                      }}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <Btn onClick={() => setEditingProduct(null)}>Cancel</Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                  {prod.image_url ? (
                    <img src={prod.image_url} alt={prod.name} style={{ width: 50, height: 50, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 50, height: 50, borderRadius: 6, background: C.surface, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>🍡</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{prod.name}</p>
                    <p style={{ fontSize: '0.75rem', color: C.dim, lineHeight: 1.4, marginBottom: 2 }}>
                      {prod.description || <span style={{ fontStyle: 'italic' as const }}>No description</span>}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: C.muted }}>
                      {prod.is_premium ? <span style={{ color: C.gold }}>★ Premium</span> : 'Regular'} ·{' '}
                      <span style={{ color: prod.is_available ? C.green : C.red }}>{prod.is_available ? 'Visible' : 'Hidden'}</span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                    <Btn primary onClick={() => { setEditingProduct(prod.id); setEp({ name: prod.name, description: prod.description || '', price: String(prod.price), is_premium: prod.is_premium, image_url: prod.image_url || '' }) }}>Edit</Btn>
                    <Btn onClick={async () => { await supabase.from('products').update({ is_available: !prod.is_available }).eq('id', prod.id); load(); flash(`${prod.name} ${prod.is_available ? 'hidden' : 'shown'}`) }}>{prod.is_available ? 'Hide' : 'Show'}</Btn>
                    <Btn danger onClick={async () => { if (!confirm(`Delete ${prod.name}?`)) return; await supabase.from('products').delete().eq('id', prod.id); load(); flash(`${prod.name} deleted`) }}>✕</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px', marginTop: 8 }}>
            <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Add Product</p>
            <Input placeholder="Name *" value={np.name} onChange={(v) => setNp((p) => ({ ...p, name: v }))} />
            <Input placeholder="Description" value={np.description} onChange={(v) => setNp((p) => ({ ...p, description: v }))} />
            <Input placeholder="Image URL" value={np.image_url} onChange={(v) => setNp((p) => ({ ...p, image_url: v }))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 14, cursor: 'pointer', color: C.cream }}>
              <input type="checkbox" checked={np.is_premium} onChange={(e) => setNp((p) => ({ ...p, is_premium: e.target.checked }))} style={{ width: 'auto', accentColor: C.gold }} />
              Premium
            </label>
            <button className="btn-gold" disabled={saving || !np.name}
              onClick={async () => {
                setSaving(true)
                await supabase.from('products').insert({ name: np.name, description: np.description, price: 0, is_premium: np.is_premium, image_url: np.image_url || null, sort_order: products.length + 1 })
                setNp({ name: '', description: '', price: '', is_premium: false, image_url: '' })
                await load(); setSaving(false); flash('Product added ✓')
              }}>
              {saving ? 'Adding…' : 'Add Product'}
            </button>
          </div>
        </div>
      )}

      {/* ── SLOTS ────────────────────────────────────────────────── */}
      {tab === 'slots' && (
        <div>
          <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Time Slots ({slots.length})</p>
          {slots.map((s) => (
            <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{s.label}</p>
                <p style={{ fontSize: '0.78rem', color: C.muted }}>
                  {new Date(s.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}{s.current_orders}/{s.max_orders} ·{' '}
                  <span style={{ color: s.is_active ? C.green : C.red }}>{s.is_active ? 'Active' : 'Disabled'}</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn primary={s.is_active} onClick={async () => { await supabase.from('time_slots').update({ is_active: !s.is_active }).eq('id', s.id); load() }}>{s.is_active ? 'Disable' : 'Enable'}</Btn>
                <Btn danger onClick={async () => { if (!confirm('Delete slot?')) return; await supabase.from('time_slots').delete().eq('id', s.id); load(); flash('Slot deleted') }}>✕</Btn>
              </div>
            </div>
          ))}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginTop: 8 }}>
            <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Add Slot</p>
            <Input placeholder="Label (e.g. 5:00 PM – 6:00 PM) *" value={ns.label} onChange={(v) => setNs((s) => ({ ...s, label: v }))} />
            <Input type="date" placeholder="Date *" value={ns.date} onChange={(v) => setNs((s) => ({ ...s, date: v }))} />
            <Input type="number" placeholder="Max orders" value={ns.max_orders} onChange={(v) => setNs((s) => ({ ...s, max_orders: v }))} />
            <button className="btn-gold" disabled={saving || !ns.label || !ns.date}
              onClick={async () => {
                setSaving(true)
                await supabase.from('time_slots').insert({ label: ns.label, date: ns.date, max_orders: Number(ns.max_orders) || 10, current_orders: 0, is_active: true })
                setNs({ label: '', date: '', max_orders: '10' })
                await load(); setSaving(false); flash('Slot added ✓')
              }}>
              {saving ? 'Adding…' : 'Add Slot'}
            </button>
          </div>
        </div>
      )}

      {/* ── BOXES ────────────────────────────────────────────────── */}
      {tab === 'boxes' && (
        <div>
          <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Box Sizes ({boxes.length})</p>
          {boxes.map((box) => (
            <div key={box.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{box.label}</p>
                <p style={{ fontSize: '0.78rem', color: C.muted }}>{box.count} pieces · ₹{box.price} · <span style={{ color: box.is_active ? C.green : C.red }}>{box.is_active ? 'Active' : 'Hidden'}</span></p>
              </div>
              <Btn onClick={async () => { await supabase.from('box_sizes').update({ is_active: !box.is_active }).eq('id', box.id); load() }}>{box.is_active ? 'Hide' : 'Show'}</Btn>
            </div>
          ))}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginTop: 8 }}>
            <p style={{ fontSize: '0.75rem', color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Add Box Size</p>
            <Input placeholder="Label (e.g. Box of 20) *" value={nb.label} onChange={(v) => setNb((b) => ({ ...b, label: v }))} />
            <Input type="number" placeholder="Pieces *" value={nb.count} onChange={(v) => setNb((b) => ({ ...b, count: v }))} />
            <Input type="number" placeholder="Price ₹ *" value={nb.price} onChange={(v) => setNb((b) => ({ ...b, price: v }))} />
            <button className="btn-gold" disabled={saving || !nb.label || !nb.count || !nb.price}
              onClick={async () => {
                setSaving(true)
                await supabase.from('box_sizes').insert({ label: nb.label, count: Number(nb.count), price: Number(nb.price), is_active: true, sort_order: boxes.length + 1 })
                setNb({ label: '', count: '', price: '' })
                await load(); setSaving(false); flash('Box size added ✓')
              }}>
              {saving ? 'Adding…' : 'Add Box Size'}
            </button>
          </div>
        </div>
      )}

    </main>
  )
}
