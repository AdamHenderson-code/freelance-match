# Freelance Match

A self-contained MVP demo connecting freelance technical crew with production bookers in film, TV, live events, and broadcast.

**Live demo:** [https://adamhenderson-code.github.io/freelance-match/](https://adamhenderson-code.github.io/freelance-match/)

Or open [`index.html`](index.html) locally in any modern browser.

## Features

- **Landing page** with role-specific CTAs, how-it-works, and trust signals
- **Engineer Portal** — profile, availability calendar, rates & terms, inquiry responses
- **Booker Portal** — quick search plus **Projects & Shifts** planner with categorized projects, shift start/end times, per-shift availability visualization, shift details, and document uploads
- **Notifications** — role-aware bell icon with inquiry alerts for engineers and bookers
- **14 sample engineers** across UK, Ireland, France, Germany, Spain, and USA
- **Matching logic** — skill + availability filtering, relevance and rate sorting
- **GDPR demo** — consent checkboxes, data export, profile deletion, privacy policy
- **localStorage persistence** — all data survives page refresh
- **Invite-only access** — gate with redeemable codes and an admin console to manage invites

## Invite-only access & admin

The site runs in **invite-only mode** by default. Visitors must enter a valid invite code before using the portal.

### First-time access (bootstrap credentials)

| Role | Value |
|------|-------|
| Invite code | `FM-BETA-2026` |
| Admin password | `FreelanceAdmin2026!` |

Change the admin password immediately after your first login.

### Entering the site

1. Open the live URL or `index.html`
2. Enter an invite code on the gate screen (and email if the invite is email-locked)
3. Use the portal as normal — access persists in your browser until you sign out

### Admin console

1. From the gate, click **Admin sign in** (or **Admin** in the footer when already inside)
2. Sign in with the admin password
3. From the dashboard you can:
   - **Create invites** — generate one-time codes (shown once; only a hash is stored)
   - **Revoke invites** — disable codes immediately
   - **Toggle invite-only mode** — turn the gate on or off
   - **Export access.json** — download updated config for redeploy
   - **Change password** — update the admin password (stored locally until export)

### Deploying access changes globally

This is a static site — invite state is merged from `access.json` (deployed) and each browser's `localStorage`. To apply admin changes for **all visitors**:

1. Export `access.json` from the admin console
2. Replace [`access.json`](access.json) in the repo
3. Commit and push to `main` — GitHub Pages redeploys automatically

> **Note:** Client-side access control is suitable for a private demo or beta. It does not replace server-side authentication for production use.

## GitHub Pages

The site auto-deploys to GitHub Pages on every push to `main` via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

**One-time setup** (repo owner):

1. Go to **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Push to `main` — the workflow publishes `index.html` and `access.json` to Pages

Live URL: `https://<username>.github.io/freelance-match/`

## How to use this demo

### As a Freelance Engineer

1. Click **I'm a Freelance Engineer** or toggle **Demo as → Engineer**
2. Complete your **Profile** (name, location, bio, skills)
3. Mark days on the **Availability** calendar (or use **Mark next 7 days**)
4. Add **Rates & Terms** for roles you offer
5. Accept the GDPR consent checkbox and click **Save Changes**
6. Check the **notification bell** and **My Matches** for incoming inquiries
7. Respond with **Confirm available** or **Decline** — bookers receive notifications

### As a Crew Booker

**Quick Search**

1. Click **I'm a Crew Booker** or toggle **Demo as → Booker**
2. On the **Quick Search** tab, select a date (or range), skills, optional location and max rate
3. Click **Search Available Engineers** (14 sample profiles available)
4. Use **View Full Profile** → **Request & place rate offer** to send an inquiry with an optional day rate bid
5. Use **+10% / +15% / +20%** quick premiums on in-demand engineers (listed at £500+/day) to improve acceptance

**Projects & Shifts**

1. Open the **Projects & Shifts** tab in the Booker Portal
2. Create a project with a category (Live Broadcast, Sports, etc.), location, and overview
3. Add shifts with date, start/end times, required roles, and shift details for engineers
4. Upload supporting documents per shift (call sheets, site maps — stored locally, max 1.5 MB each)
5. Review the availability bar and engineer avatars on each shift — green means good coverage
6. Click **View & request** to see matching engineers and send a shift-specific inquiry with a rate offer

**Both flows**

- Watch the **notification bell** for engineer responses
- Track all sent inquiries in the **Sent inquiries** section
- Engineers see shift context, **day rate offers** (with premium badges), and can download attached documents from their **My Matches** inbox

### Notifications

- Switch demo role to filter notifications (Engineer vs Booker)
- Click the bell icon to open the panel
- Click a notification to jump to Matches or Sent inquiries
- Use **Mark all read** to clear unread badges

### Reset

Click **Reset demo data** in the footer to clear all localStorage and restore sample engineers.

## Running tests

```bash
pip3 install --break-system-packages playwright
python3 -m playwright install chromium
python3 test_search_inquiry.py
```

## Grok Imagine prompts (hero & section images)

| Location | Prompt |
|----------|--------|
| **Hero** | Professional diverse group of freelance technical crew on a film set at golden hour, cinematic lighting, modern broadcast equipment, confident and collaborative atmosphere, deep navy and teal color grading |
| **Feature section** | Behind-the-scenes photo of a live broadcast truck setup at a major sporting event, engineers configuring audio and video equipment, professional workwear, dynamic lighting, cinematic depth of field |
| **CTA banner** | Aerial view of a large outdoor concert stage being built, cranes and lighting rigs, crew in high-vis vests, twilight sky, epic scale production setup |

## Tech stack

- Single HTML file (`index.html`)
- [Tailwind CSS](https://tailwindcss.com/) via CDN
- Vanilla JavaScript
- GitHub Actions → GitHub Pages
- No build step required

## License

Demo MVP — © 2026 Freelance Match