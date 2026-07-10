# Freelance Match

A self-contained MVP demo connecting freelance technical crew with production bookers in film, TV, live events, and broadcast.

**Live demo:** [https://adamhenderson-code.github.io/freelance-match/](https://adamhenderson-code.github.io/freelance-match/)

Or open [`index.html`](index.html) locally in any modern browser.

## Features

- **Landing page** with role-specific CTAs, how-it-works, and trust signals
- **Engineer Portal** — profile, availability calendar, rates & terms, inquiry responses
- **Booker Portal** — skill/date/location/budget search, sorted results, sent inquiry history
- **Notifications** — role-aware bell icon with inquiry alerts for engineers and bookers
- **14 sample engineers** across UK, Ireland, France, Germany, Spain, and USA
- **Matching logic** — skill + availability filtering, relevance and rate sorting
- **GDPR demo** — consent checkboxes, data export, profile deletion, privacy policy
- **localStorage persistence** — all data survives page refresh

## GitHub Pages

The site auto-deploys to GitHub Pages on every push to `main` via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

**One-time setup** (repo owner):

1. Go to **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Push to `main` — the workflow publishes `index.html` to Pages

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

1. Click **I'm a Crew Booker** or toggle **Demo as → Booker**
2. Select a date (or range), skills, optional location and max rate
3. Click **Search Available Engineers** (14 sample profiles available)
4. Use **View Full Profile** → **Request Availability** to send an inquiry
5. Watch the **notification bell** for engineer responses
6. Track all sent inquiries in the **Sent inquiries** section

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