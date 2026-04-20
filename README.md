# Eversweet — Mochi Ordering Website

Single-page mobile-first ordering website for Eversweet Company, Kochi.

**Stack:** Next.js 14 · Supabase · Resend · Vercel

---

## Folder Structure

```
eversweet/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Main customer page
│   │   ├── layout.tsx            ← Root layout + metadata
│   │   ├── globals.css           ← Dark chocolate theme
│   │   ├── admin/
│   │   │   └── page.tsx          ← Admin panel (/admin)
│   │   └── api/
│   │       └── orders/
│   │           └── route.ts      ← POST order + email notification
│   └── lib/
│       ├── supabase.ts           ← Supabase client
│       └── types.ts              ← TypeScript types
├── public/
│   └── upi-qr.png               ← PUT YOUR UPI QR CODE HERE
├── supabase-setup.sql            ← Run this in Supabase SQL Editor
├── .env.local                    ← Fill in your keys (never commit)
└── README.md
```

---

## Step-by-Step Setup

### 1. Prerequisites

Install these if you haven't:
- **Node.js** (LTS): https://nodejs.org
- **VS Code**: https://code.visualstudio.com
- **Git**: https://git-scm.com

Create accounts at (all free):
- https://github.com
- https://supabase.com
- https://resend.com
- https://vercel.com (sign in with GitHub)

---

### 2. Install Dependencies

Open VS Code → open this folder → press Ctrl+` to open terminal → run:

```bash
npm install
```

---

### 3. Supabase Setup

1. Go to https://supabase.com → **New Project**
   - Name: `eversweet`
   - Region: Southeast Asia (Singapore)
   - Wait ~2 minutes for it to spin up

2. Go to **SQL Editor** (left sidebar) → **New Query**
   - Open `supabase-setup.sql` from this folder
   - Copy everything → paste into SQL Editor → click **Run**
   - You should see "Success" for each statement

3. Get your API keys:
   - Go to **Settings** (gear icon, bottom left) → **API**
   - Copy **Project URL** (looks like https://xxxx.supabase.co)
   - Copy **anon public** key (starts with eyJ...)
   - Copy **service_role** key (also starts with eyJ... — keep this SECRET)

---

### 4. Resend Setup

1. Go to https://resend.com → Sign up
2. **API Keys** → **Create API Key** → name it `eversweet`
3. Copy the key (starts with `re_`) — you only see it once

---

### 5. Fill in .env.local

Open `.env.local` and replace all placeholder values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
ADMIN_EMAIL=your@gmail.com
NEXT_PUBLIC_ADMIN_PASSWORD=your_admin_password
```

---

### 6. Add Your UPI QR Code

1. Open your UPI app (GPay, PhonePe, etc.)
2. Get your QR code → screenshot → save as `upi-qr.png`
3. Place the file in the `public/` folder (replace the placeholder)

---

### 7. Run Locally

```bash
npm run dev
```

Open http://localhost:3000 in your browser.
Open http://localhost:3000/admin to test the admin panel.

To test on your phone (same WiFi):
- Find your computer's local IP: run `ipconfig` (Windows) or `ifconfig` (Mac)
- Open `http://YOUR_IP:3000` on your phone

---

### 8. Push to GitHub

```bash
# Step 1: Initialise git
git init

# Step 2: Stage all files
git add .

# Step 3: First commit
git commit -m "initial commit: eversweet mochi site"

# Step 4: Go to github.com → click New repository
#   Name: eversweet
#   Visibility: Private (recommended)
#   Do NOT initialise with README (we already have one)
#   Click Create repository

# Step 5: GitHub will show you two commands. Run them:
git remote add origin https://github.com/YOUR_USERNAME/eversweet.git
git branch -M main
git push -u origin main
```

---

### 9. Deploy on Vercel

1. Go to https://vercel.com → **Add New Project**
2. **Import** your `eversweet` GitHub repo
3. Under **Environment Variables**, add all 6 variables from `.env.local`
4. Click **Deploy**

Vercel gives you a live URL instantly (e.g. `eversweet.vercel.app`).
Put this URL in your Instagram bio.

**After that:** every `git push` automatically redeploys. No manual steps.

---

### 10. After Going Live

**Update prices:**
→ Supabase Dashboard → Table Editor → `box_sizes` or `products` → edit → Save

**Add new products (Brookie, Tiramisu, etc.):**
→ Go to `/admin` on your live site → Products tab → Add New Product

**Add time slots for each day:**
→ `/admin` → Slots tab → Add New Slot
→ Do this every evening for the next day

**Upload real product photos:**
1. Supabase Dashboard → Storage → New Bucket → name: `products` → make it Public
2. Upload your mochi photos (800×800px, JPG, under 500KB)
3. Copy the public URL
4. Admin panel → Products → the image URL field on each product

---

## Admin Panel

URL: `yoursite.vercel.app/admin`

| Tab | What you can do |
|-----|----------------|
| Orders | View all orders, confirm or cancel |
| Products | Add, hide, delete products. Toggle availability |
| Slots | Add time slots, disable full ones, delete old ones |
| Boxes | Add new box sizes, show/hide |

---

## Customisation

**Change phone number** (for call to confirm payment):
→ In `src/app/page.tsx` → search for `tel:+919999999999` → replace with your number

**Change Instagram handle:**
→ In `src/app/page.tsx` → search for `eversweet.mochi` → replace with yours

**Change email sender** (after adding domain to Resend):
→ In `src/app/api/orders/route.ts` → update the `from` field

**Add new FAQ questions:**
→ In `src/app/page.tsx` → find the FAQ array → add a new `['Question', 'Answer']` entry

---

## Troubleshooting

**Products not loading:**
→ Check `.env.local` — no extra spaces around the `=` sign
→ Check Supabase RLS policies were created (run the SQL again)

**Email not arriving:**
→ Check spam folder
→ In Resend dashboard → Emails → check for errors
→ Make sure `RESEND_API_KEY` is set in Vercel environment variables

**Time slot not updating after order:**
→ Make sure the orders API ran without error (check Vercel function logs)

**Admin password not working:**
→ Make sure `NEXT_PUBLIC_ADMIN_PASSWORD` is set in Vercel environment variables
→ Redeploy after adding environment variables
