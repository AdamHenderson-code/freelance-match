#!/usr/bin/env python3
"""E2E test for Freelance Match search and inquiry flow."""

import json
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
PORT = 8765
BASE = f"http://127.0.0.1:{PORT}/index.html"


def start_server():
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def tomorrow_iso(page):
    return page.evaluate("""() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }""")


def run_tests():
    server = start_server()
    time.sleep(0.3)
    results = []

    def check(name, condition, detail=""):
        results.append({"name": name, "pass": bool(condition), "detail": detail})
        status = "PASS" if condition else "FAIL"
        print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Fresh localStorage for deterministic test
        page.goto(BASE)
        page.evaluate("""() => {
          localStorage.clear();
          location.reload();
        }""")
        page.wait_for_load_state("networkidle")

        # Accept cookies if shown
        accept = page.locator("#cookie-banner button:has-text('Accept')")
        if accept.is_visible():
            accept.click()

        # --- Booker search flow ---
        page.evaluate("App.ctaBooker()")
        page.wait_for_selector('[data-view="booker"].active')

        tomorrow = tomorrow_iso(page)
        page.locator("#booker-date-start").fill(tomorrow)

        page.locator('#booker-skills-pool button[data-skill="Broadcast Engineer"]').click()
        page.locator('button:has-text("Search Available Engineers")').click()
        page.wait_for_timeout(500)

        result_count = page.locator("#booker-results article").count()
        count_text = page.locator("#booker-results-count").inner_text()
        check("Search returns results", result_count > 0, f"{result_count} cards, header says {count_text}")

        no_match_visible = page.locator("#booker-no-match").is_visible()
        check("No-match state hidden on success", not no_match_visible)

        first_card = page.locator("#booker-results article").first
        first_name = first_card.locator("h3").inner_text()
        check("Result card shows engineer name", len(first_name) > 0, first_name)

        has_teal_skill = first_card.locator("span.bg-teal\\/20").count() > 0
        check("Matched skill highlighted", has_teal_skill)

        first_card.locator('button:has-text("View Full Profile")').click()
        page.wait_for_selector("#profile-modal.flex")
        modal_name = page.locator("#profile-modal-body h3").inner_text()
        check("Profile modal opens", modal_name == first_name, modal_name)

        page.locator('#profile-modal-body button:has-text("Request Availability")').click()
        page.wait_for_selector("#inquiry-modal.flex")
        check("Inquiry modal opens", page.locator("#inquiry-modal").is_visible())

        engineer_name = page.locator("#inquiry-engineer-name").inner_text()
        check("Inquiry targets correct engineer", engineer_name == first_name)

        page.locator("#inquiry-dates").fill("8 Jul – 10 Jul 2026")
        page.locator("#inquiry-message").fill("E2E test: need broadcast engineer for live OB.")
        page.locator("#inquiry-consent").check()
        page.locator('#inquiry-form button[type="submit"]').click()
        page.wait_for_timeout(400)

        inquiry_modal_hidden = page.locator("#inquiry-modal").is_hidden()
        check("Inquiry modal closes after submit", inquiry_modal_hidden)

        inquiries = page.evaluate("JSON.parse(localStorage.getItem('fm_inquiries') || '[]')")
        check("Inquiry stored in localStorage", len(inquiries) == 1, json.dumps(inquiries[0], indent=2) if inquiries else "none")
        if inquiries:
            check("Inquiry has message", "E2E test" in inquiries[0].get("message", ""))
            target_id = inquiries[0].get("engineerId")
            check("Inquiry linked to engineer id", bool(target_id), target_id)

        # --- Search with impossible criteria returns empty ---
        page.locator('#booker-skills-pool button[data-skill="Broadcast Engineer"]').click()  # deselect
        page.locator('#booker-skills-pool button[data-skill="Rigging & Automation"]').click()
        page.locator("#booker-location").fill("NonexistentCityXYZ")
        page.locator('button:has-text("Search Available Engineers")').click()
        page.wait_for_timeout(400)
        no_results = page.locator("#booker-no-match").is_visible()
        check("No-match UI for bad filters", no_results)

        # --- Inquiry blocked without consent ---
        page.evaluate("""() => {
          App.ctaBooker();
          App.state.bookerSearch.skills = ['Video Engineer'];
          App.runBookerSearch();
        }""")
        page.wait_for_timeout(400)
        if page.locator("#booker-results article").count() > 0:
            page.locator("#booker-results article").first.locator('button:has-text("View Full Profile")').click()
            page.wait_for_selector("#profile-modal.flex")
            page.locator('#profile-modal-body button:has-text("Request Availability")').click()
            page.wait_for_selector("#inquiry-modal.flex")
            before = page.evaluate("JSON.parse(localStorage.getItem('fm_inquiries') || '[]').length")
            page.locator("#inquiry-consent").uncheck()
            page.locator("#inquiry-message").fill("Should not save")
            page.locator('#inquiry-form button[type="submit"]').click()
            page.wait_for_timeout(400)
            after = page.evaluate("JSON.parse(localStorage.getItem('fm_inquiries') || '[]').length")
            still_open = page.locator("#inquiry-modal").is_visible()
            check("Inquiry blocked without consent", after == before and still_open, f"count {before}->{after}")

        browser.close()

    server.shutdown()
    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    print(f"\n{passed}/{total} tests passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(run_tests())