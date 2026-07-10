# Freelance Match

A self-contained MVP demo connecting freelance technical crew with production bookers in film, TV, live events, and broadcast.

**Live demo:** Open [`index.html`](index.html) in any modern browser.

## Features

- **Landing page** with role-specific CTAs, how-it-works, and trust signals
- **Engineer Portal** — profile, availability calendar, rates & terms, inquiry responses
- **Booker Portal** — skill/date/location/budget search, sorted results, sent inquiry history
- **Matching logic** — skill + availability filtering, relevance and rate sorting
- **GDPR demo** — consent checkboxes, data export, profile deletion, privacy policy
- **localStorage persistence** — all data survives page refresh

## How to use this demo

### As a Freelance Engineer

1. Click **I'm a Freelance Engineer** or toggle **Demo as → Engineer** in the navbar
2. Complete your **Profile** (name, location, bio, skills)
3. Mark days on the **Availability** calendar (or use **Mark next 7 days**)
4. Add **Rates & Terms** for roles you offer
5. Accept the GDPR consent checkbox and click **Save Changes**
6. Check **My Matches** for incoming inquiries — respond with **Confirm available** or **Decline**

### As a Crew Booker

1. Click **I'm a Crew Booker** or toggle **Demo as → Booker**
2. Select a date (or range), skills, optional location and max rate
3. Click **Search Available Engineers**
4. Use **View Full Profile** → **Request Availability** to send an inquiry
5. Track sent inquiries in the **Sent inquiries** section below results

### Role switching

Use the navbar toggle at any time to switch between Engineer and Booker demo modes.

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
- No build step required

## License

Demo MVP — © 2026 Freelance Match