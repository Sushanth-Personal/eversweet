'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, BoxSize, TimeSlot, Order } from '@/lib/types'

type Tab = 'orders' | 'dispatched' | 'products' | 'slots' | 'boxes'

// ── Status flow ────────────────────────────────────────────────────
const STATUS_FLOW = ['pending', 'confirmed', 'prepared', 'porter_booked', 'dispatched'] as const
type OrderStatus = typeof STATUS_FLOW[number] | 'cancelled'

const STATUS_LABELS: Record<string, string> = {
  pending:       'Pending',
  confirmed:     'Confirmed',
  prepared:      'Prepared',
  porter_booked: 'Porter Booked',
  dispatched:    'Dispatched',
  cancelled:     'Cancelled',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:       { bg: 'rgba(201,168,76,0.1)',  text: '#c9a84c' },
  confirmed:     { bg: 'rgba(74,138,90,0.1)',   text: '#4a8a5a' },
  prepared:      { bg: 'rgba(100,149,237,0.1)', text: '#6495ed' },
  porter_booked: { bg: 'rgba(180,100,200,0.1)', text: '#b464c8' },
  dispatched:    { bg: 'rgba(74,138,90,0.15)',  text: '#5aaa6a' },
  cancelled:     { bg: 'rgba(192,64,64,0.1)',   text: '#c04040' },
}

function nextStatus(current: string): string | null {
  const idx = STATUS_FLOW.indexOf(current as typeof STATUS_FLOW[number])
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

// ── Copy labeled button ────────────────────────────────────────────
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
    <button
      onClick={copy}
      style={{
        background: copied ? 'rgba(74,138,90,0.15)' : 'rgba(201,168,76,0.08)',
        border: `1px solid ${copied ? 'rgba(74,138,90,0.4)' : 'rgba(201,168,76,0.25)'}`,
        cursor: value ? 'pointer' : 'default',
        padding: '3px 9px', borderRadius: 3,
        fontSize: '0.65rem',
        color: copied ? '#4a8a5a' : '#c9a84c',
        transition: 'all 0.2s',
        letterSpacing: '0.06em',
        fontFamily: 'DM Sans, sans-serif',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {copied ? `✓ Copied` : `Copy ${label}`}
    </button>
  )
}

// ── Shared input ───────────────────────────────────────────────────
function Input({ placeholder, value, onChange, type = 'text' }: {
  placeholder: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <input type={type} placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', background: '#2d1a12', border: '1px solid rgba(201,168,76,0.2)',
        color: '#f5ede0', padding: '10px 12px', borderRadius: 4, fontSize: '0.85rem',
        marginBottom: 8, outline: 'none', fontFamily: 'DM Sans, sans-serif',
      }}
    />
  )
}

// ── Small action button ────────────────────────────────────────────
function Btn({ children, onClick, danger = false, active = false, disabled = false }: {
  children: React.ReactNode; onClick: () => void
  danger?: boolean; active?: boolean; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: '4px 10px', borderRadius: 3, border: '1px solid',
        borderColor: danger ? 'rgba(192,64,64,0.4)' : active ? '#c9a84c' : 'rgba(201,168,76,0.3)',
        background: active ? 'rgba(201,168,76,0.12)' : 'transparent',
        color: danger ? '#c04040' : active ? '#e8c97a' : '#c9a84c',
        fontSize: '0.68rem', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1, letterSpacing: '0.08em',
        transition: 'all 0.2s', fontFamily: 'DM Sans, sans-serif',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {children}
    </button>
  )
}

// ── Order card ─────────────────────────────────────────────────────
function OrderCard({ order, isRepeat, slotLabel, onStatusChange, onCancel }: {
  order: Order; isRepeat: boolean; slotLabel: string
  onStatusChange: (id: string, status: string) => Promise<void>
  onCancel: (id: string) => Promise<void>
}) {
  const [updating, setUpdating] = useState(false)
  const next = nextStatus(order.status)
  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending

  return (
    <div style={{
      background: '#24120c',
      border: `1px solid ${order.status === 'porter_booked' ? 'rgba(180,100,200,0.35)' : 'rgba(201,168,76,0.1)'}`,
      borderRadius: 6, padding: '12px 14px', marginBottom: 8,
    }}>

      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{order.customer_name}</span>
        <CopyBtn value={order.customer_name} label="Name" />
        {isRepeat && (
          <span style={{
            fontSize: '0.58rem', padding: '2px 6px', borderRadius: 10,
            background: 'rgba(100,149,237,0.15)', color: '#6495ed', letterSpacing: '0.1em',
          }}>
            🔄 REPEAT
          </span>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: '0.6rem', padding: '2px 7px', borderRadius: 3,
          background: sc.bg, color: sc.text, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
        }}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      {/* Phone row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: '0.78rem', color: '#c8b89a' }}>📞 {order.phone}</span>
        <CopyBtn value={order.phone} label="Phone" />
      </div>

      {/* Address row */}
      {order.address && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: '0.75rem', color: '#8a7060', flex: 1 }}>📍 {order.address}</span>
          <CopyBtn value={order.address} label="Address" />
        </div>
      )}

      {/* Slot + order meta */}
      <p style={{ fontSize: '0.7rem', color: '#5a4030', marginBottom: 2 }}>
        🕐 {slotLabel} · ₹{order.total_price} · {order.payment_method}
      </p>

      {/* Flavours */}
      {order.flavours && Object.keys(order.flavours).length > 0 && (
        <p style={{ fontSize: '0.68rem', color: '#6a5040', marginBottom: 2 }}>
          🍡 {Object.entries(order.flavours as Record<string, number>)
            .filter(([, q]) => q > 0)
            .map(([id, q]) => `${id.slice(0, 8)}…×${q}`)
            .join(' · ')}
        </p>
      )}

      {/* Notes */}
      {order.notes && (
        <p style={{ fontSize: '0.7rem', color: '#7a9060', fontStyle: 'italic' as const, marginBottom: 2 }}>
          💬 {order.notes}
        </p>
      )}

      <p style={{ fontSize: '0.62rem', color: '#3a2010', marginBottom: 10 }}>
        {new Date(order.created_at).toLocaleString('en-IN')}
        {order.dob ? ` · DOB: ${order.dob}` : ''}
      </p>

      {/* Action buttons */}
      {order.status !== 'dispatched' && order.status !== 'cancelled' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {next && (
            <Btn active disabled={updating} onClick={async () => {
              setUpdating(true)
              await onStatusChange(order.id, next)
              setUpdating(false)
            }}>
              {updating ? '…' : `→ ${STATUS_LABELS[next]}`}
            </Btn>
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
  const [repeatPhones, setRepeatPhones] = useState<Set<string>>(new Set())

  const [np, setNp] = useState({ name: '', description: '', price: '', is_premium: false, image_url: '' })
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [ep, setEp] = useState({ name: '', description: '', price: '', is_premium: false, image_url: '' })
  const [ns, setNs] = useState({ label: '', date: '', max_orders: '10' })
  const [nb, setNb] = useState({ label: '', count: '', price: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [{ data: o }, { data: s }, { data: p }, { data: b }] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('time_slots').select('*').order('date').order('label'),
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('box_sizes').select('*').order('sort_order'),
    ])
    if (o) {
      setOrders(o as Order[])
      // Detect repeat customers by phone
      const counts: Record<string, number> = {}
      ;(o as Order[]).forEach((ord) => { counts[ord.phone] = (counts[ord.phone] || 0) + 1 })
      setRepeatPhones(new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([p]) => p)))
    }
    if (s) setSlots(s as TimeSlot[])
    if (p) setProducts(p as Product[])
    if (b) setBoxes(b as BoxSize[])
  }, [])

  useEffect(() => { if (authed) load() }, [authed, load])

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  function getSlotLabel(slotId: string) {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return '—'
    return `${slot.label} · ${new Date(slot.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
  }

  async function handleStatusChange(id: string, status: string) {
    await supabase.from('orders').update({ status }).eq('id', id)
    await load()
    flash(`Marked as ${STATUS_LABELS[status]} ✓`)
  }

  async function handleCancel(id: string) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
    await load()
    flash('Order cancelled')
  }

  const activeOrders = orders.filter((o) => o.status !== 'dispatched' && o.status !== 'cancelled')
  const dispatchedOrders = orders.filter((o) => o.status === 'dispatched')
  const pendingCount = orders.filter((o) => o.status === 'pending').length

  // ── Login ──────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#160c08', padding: 24,
      }}>
        <div style={{ width: '100%', maxWidth: 320 }}>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', color: '#c9a84c', marginBottom: 4, fontWeight: 300 }}>
            Eversweet
          </p>
          <p style={{ fontSize: '0.75rem', color: '#7a6050', marginBottom: 24 }}>Admin Panel</p>
          <Input type="password" placeholder="Password" value={pw} onChange={setPw} />
          {pwError && <p style={{ fontSize: '0.75rem', color: '#c04040', marginBottom: 8 }}>Wrong password</p>}
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
    <main style={{
      maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px',
      background: '#160c08', minHeight: '100vh', color: '#f5ede0',
      fontFamily: 'DM Sans, sans-serif',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(201,168,76,0.15)',
      }}>
        <div>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', color: '#c9a84c', fontWeight: 300 }}>
            Eversweet Admin
          </p>
          <p style={{ fontSize: '0.7rem', color: '#7a6050' }}>
            {pendingCount > 0 ? `${pendingCount} new order${pendingCount > 1 ? 's' : ''} waiting` : 'All caught up ✓'}
          </p>
        </div>
        <button onClick={load} style={{
          background: 'transparent', border: '1px solid rgba(201,168,76,0.2)',
          color: '#c9a84c', padding: '6px 12px', borderRadius: 3, cursor: 'pointer', fontSize: '0.72rem',
        }}>
          ↻ Refresh
        </button>
      </div>

      {/* Status flow legend */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto' as const, paddingBottom: 4 }}>
        {STATUS_FLOW.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{
              fontSize: '0.56rem', padding: '2px 6px', borderRadius: 3,
              background: STATUS_COLORS[s].bg, color: STATUS_COLORS[s].text, letterSpacing: '0.06em',
            }}>
              {STATUS_LABELS[s]}
            </span>
            {i < STATUS_FLOW.length - 1 && <span style={{ color: '#3a2010', fontSize: '0.65rem' }}>→</span>}
          </div>
        ))}
      </div>

      {/* Flash */}
      {msg && (
        <div style={{
          background: 'rgba(74,138,90,0.15)', border: '1px solid rgba(74,138,90,0.3)',
          color: '#4a8a5a', padding: '10px 14px', borderRadius: 4, fontSize: '0.8rem', marginBottom: 16,
        }}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto' as const }}>
        {([
          { id: 'orders',     label: `Orders (${activeOrders.length})` },
          { id: 'dispatched', label: `Dispatched (${dispatchedOrders.length})` },
          { id: 'products',   label: 'Products' },
          { id: 'slots',      label: 'Slots' },
          { id: 'boxes',      label: 'Boxes' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', borderRadius: 3, border: '1px solid',
            borderColor: tab === t.id ? '#c9a84c' : 'rgba(201,168,76,0.2)',
            background: tab === t.id ? '#c9a84c' : 'transparent',
            color: tab === t.id ? '#160c08' : '#c9a84c',
            cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.06em',
            whiteSpace: 'nowrap' as const, fontFamily: 'DM Sans, sans-serif',
            fontWeight: tab === t.id ? 500 : 300,
          }}>
            {t.label}
            {t.id === 'orders' && pendingCount > 0 && (
              <span style={{
                marginLeft: 6, background: '#c04040', color: 'white',
                borderRadius: 10, padding: '0 5px', fontSize: '0.6rem',
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ACTIVE ORDERS ─────────────────────────────────────── */}
      {tab === 'orders' && (
        <div>
          {activeOrders.length === 0 ? (
            <p style={{ color: '#7a6050', fontSize: '0.85rem', textAlign: 'center', padding: 40 }}>
              No active orders
            </p>
          ) : (
            activeOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                isRepeat={repeatPhones.has(o.phone)}
                slotLabel={getSlotLabel(o.time_slot_id)}
                onStatusChange={handleStatusChange}
                onCancel={handleCancel}
              />
            ))
          )}
        </div>
      )}

      {/* ── DISPATCHED ────────────────────────────────────────── */}
      {tab === 'dispatched' && (
        <div>
          <p style={{ fontSize: '0.65rem', color: '#8a7060', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
            Dispatched Orders ({dispatchedOrders.length})
          </p>
          {dispatchedOrders.length === 0 ? (
            <p style={{ color: '#7a6050', fontSize: '0.85rem', textAlign: 'center', padding: 40 }}>
              No dispatched orders yet
            </p>
          ) : (
            dispatchedOrders.map((o) => (
              <div key={o.id} style={{
                background: '#1e120a', border: '1px solid rgba(74,138,90,0.12)',
                borderRadius: 6, padding: '10px 14px', marginBottom: 6, opacity: 0.75,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{o.customer_name}</p>
                      {repeatPhones.has(o.phone) && (
                        <span style={{ fontSize: '0.6rem', color: '#6495ed' }}>🔄</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#5a7050' }}>
                      {o.phone} · ₹{o.total_price}
                    </p>
                    {o.address && (
                      <p style={{ fontSize: '0.7rem', color: '#4a5040' }}>📍 {o.address}</p>
                    )}
                    <p style={{ fontSize: '0.65rem', color: '#3a4030', marginTop: 2 }}>
                      {getSlotLabel(o.time_slot_id)} · {new Date(o.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.6rem', padding: '2px 7px', borderRadius: 3,
                    background: 'rgba(74,138,90,0.15)', color: '#5aaa6a', flexShrink: 0,
                  }}>
                    ✓ Done
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── PRODUCTS ──────────────────────────────────────────── */}
      {tab === 'products' && (
        <div>
          <p style={{ fontSize: '0.65rem', color: '#8a7060', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
            Products ({products.length})
          </p>
          {products.map((prod) => (
            <div key={prod.id} style={{
              background: '#24120c', border: '1px solid rgba(201,168,76,0.1)',
              borderRadius: 6, marginBottom: 6, overflow: 'hidden',
            }}>
              {editingProduct === prod.id ? (
                /* ── Inline edit form ── */
                <div style={{ padding: '12px 14px' }}>
                  <p style={{ fontSize: '0.65rem', color: '#8a7060', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
                    Editing: {prod.name}
                  </p>
                  <Input placeholder="Name *" value={ep.name} onChange={(v) => setEp((p) => ({ ...p, name: v }))} />
                  <Input placeholder="Description" value={ep.description} onChange={(v) => setEp((p) => ({ ...p, description: v }))} />
                  <Input placeholder="Price ₹" type="number" value={ep.price} onChange={(v) => setEp((p) => ({ ...p, price: v }))} />
                  <Input placeholder="Image URL" value={ep.image_url} onChange={(v) => setEp((p) => ({ ...p, image_url: v }))} />
                  {ep.image_url && (
                    <div style={{ marginBottom: 8 }}>
                      <img src={ep.image_url} alt="preview"
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(201,168,76,0.2)' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', marginBottom: 12, cursor: 'pointer', color: '#c8b89a' }}>
                    <input type="checkbox" checked={ep.is_premium}
                      onChange={(e) => setEp((p) => ({ ...p, is_premium: e.target.checked }))}
                      style={{ width: 'auto', accentColor: '#c9a84c' }} />
                    Premium
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-gold" disabled={saving}
                      style={{ flex: 1, padding: '10px' }}
                      onClick={async () => {
                        setSaving(true)
                        await supabase.from('products').update({
                          name: ep.name,
                          description: ep.description,
                          price: Number(ep.price),
                          is_premium: ep.is_premium,
                          image_url: ep.image_url || null,
                        }).eq('id', prod.id)
                        setEditingProduct(null)
                        await load(); setSaving(false); flash(`${ep.name} updated ✓`)
                      }}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <Btn onClick={() => setEditingProduct(null)}>Cancel</Btn>
                  </div>
                </div>
              ) : (
                /* ── Normal product row ── */
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                  {prod.image_url ? (
                    <img src={prod.image_url} alt={prod.name}
                      style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 4, background: '#2d1a12', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                      🍡
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{prod.name}</p>
                    <p style={{ fontSize: '0.68rem', color: '#6a5040', lineHeight: 1.4, marginBottom: 2 }}>
                      {prod.description || <span style={{ color: '#4a3020', fontStyle: 'italic' as const }}>No description</span>}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#8a7060' }}>
                      {prod.is_premium ? <span style={{ color: '#c9a84c' }}>★ Premium</span> : 'Regular'} ·{' '}
                      <span style={{ color: prod.is_available ? '#4a8a5a' : '#c04040' }}>
                        {prod.is_available ? 'Visible' : 'Hidden'}
                      </span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, flexShrink: 0 }}>
                    <Btn active onClick={() => {
                      setEditingProduct(prod.id)
                      setEp({
                        name: prod.name,
                        description: prod.description || '',
                        price: String(prod.price),
                        is_premium: prod.is_premium,
                        image_url: prod.image_url || '',
                      })
                    }}>
                      Edit
                    </Btn>
                    <Btn onClick={async () => {
                      await supabase.from('products').update({ is_available: !prod.is_available }).eq('id', prod.id)
                      load(); flash(`${prod.name} ${prod.is_available ? 'hidden' : 'shown'}`)
                    }}>
                      {prod.is_available ? 'Hide' : 'Show'}
                    </Btn>
                    <Btn danger onClick={async () => {
                      if (!confirm(`Delete ${prod.name}?`)) return
                      await supabase.from('products').delete().eq('id', prod.id)
                      load(); flash(`${prod.name} deleted`)
                    }}>
                      ✕
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ background: '#24120c', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 6, padding: 16, marginTop: 16 }}>
            <p style={{ fontSize: '0.65rem', color: '#8a7060', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Add Product</p>
            <Input placeholder="Name *" value={np.name} onChange={(v) => setNp((p) => ({ ...p, name: v }))} />
            <Input placeholder="Description" value={np.description} onChange={(v) => setNp((p) => ({ ...p, description: v }))} />
            <Input placeholder="Price ₹ *" type="number" value={np.price} onChange={(v) => setNp((p) => ({ ...p, price: v }))} />
            <Input placeholder="Image URL" value={np.image_url} onChange={(v) => setNp((p) => ({ ...p, image_url: v }))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', marginBottom: 12, cursor: 'pointer', color: '#c8b89a' }}>
              <input type="checkbox" checked={np.is_premium} onChange={(e) => setNp((p) => ({ ...p, is_premium: e.target.checked }))}
                style={{ width: 'auto', accentColor: '#c9a84c' }} />
              Premium
            </label>
            <button className="btn-gold" disabled={saving || !np.name || !np.price}
              onClick={async () => {
                setSaving(true)
                await supabase.from('products').insert({ name: np.name, description: np.description, price: Number(np.price), is_premium: np.is_premium, image_url: np.image_url || null, sort_order: products.length + 1 })
                setNp({ name: '', description: '', price: '', is_premium: false, image_url: '' })
                await load(); setSaving(false); flash('Product added ✓')
              }}>
              {saving ? 'Adding…' : 'Add Product'}
            </button>
          </div>
        </div>
      )}

      {/* ── SLOTS ─────────────────────────────────────────────── */}
      {tab === 'slots' && (
        <div>
          <p style={{ fontSize: '0.65rem', color: '#8a7060', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
            Time Slots ({slots.length})
          </p>
          {slots.map((s) => (
            <div key={s.id} style={{
              background: '#24120c', border: '1px solid rgba(201,168,76,0.1)',
              borderRadius: 6, padding: '10px 14px', marginBottom: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: '0.7rem', color: '#8a7060' }}>
                  {new Date(s.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}{s.current_orders}/{s.max_orders}{' · '}
                  <span style={{ color: s.is_active ? '#4a8a5a' : '#c04040' }}>
                    {s.is_active ? 'Active' : 'Disabled'}
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn onClick={async () => {
                  await supabase.from('time_slots').update({ is_active: !s.is_active }).eq('id', s.id)
                  load()
                }}>
                  {s.is_active ? 'Disable' : 'Enable'}
                </Btn>
                <Btn danger onClick={async () => {
                  if (!confirm('Delete slot?')) return
                  await supabase.from('time_slots').delete().eq('id', s.id)
                  load(); flash('Slot deleted')
                }}>✕</Btn>
              </div>
            </div>
          ))}
          <div style={{ background: '#24120c', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 6, padding: 16, marginTop: 16 }}>
            <p style={{ fontSize: '0.65rem', color: '#8a7060', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Add Slot</p>
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

      {/* ── BOXES ─────────────────────────────────────────────── */}
      {tab === 'boxes' && (
        <div>
          <p style={{ fontSize: '0.65rem', color: '#8a7060', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
            Box Sizes ({boxes.length})
          </p>
          {boxes.map((box) => (
            <div key={box.id} style={{
              background: '#24120c', border: '1px solid rgba(201,168,76,0.1)',
              borderRadius: 6, padding: '10px 14px', marginBottom: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{box.label}</p>
                <p style={{ fontSize: '0.7rem', color: '#8a7060' }}>
                  {box.count} pieces · ₹{box.price} ·{' '}
                  <span style={{ color: box.is_active ? '#4a8a5a' : '#c04040' }}>
                    {box.is_active ? 'Active' : 'Hidden'}
                  </span>
                </p>
              </div>
              <Btn onClick={async () => {
                await supabase.from('box_sizes').update({ is_active: !box.is_active }).eq('id', box.id)
                load()
              }}>
                {box.is_active ? 'Hide' : 'Show'}
              </Btn>
            </div>
          ))}
          <div style={{ background: '#24120c', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 6, padding: 16, marginTop: 16 }}>
            <p style={{ fontSize: '0.65rem', color: '#8a7060', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Add Box Size</p>
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
