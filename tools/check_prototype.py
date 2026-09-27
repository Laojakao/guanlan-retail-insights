"""Check the review prototype's principal flows with Playwright.

Usage: python tools/check_prototype.py
Requires Playwright and Microsoft Edge on Windows (or bundled Chromium).
"""
from pathlib import Path
import csv
import io
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)
errors = []
checks = []

with sync_playwright() as pw:
    edge = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
    browser = pw.chromium.launch(headless=True, **({"executable_path": str(edge)} if edge.exists() else {}))
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "观澜_交互原型.html").as_uri())
    page.wait_for_load_state("networkidle")
    page.get_by_role("heading", name="看见客户差异，让服务更有依据。").wait_for()
    page.screenshot(path=str(ASSETS / "overview.png"))
    checks.append("overview rendered")

    page.locator('[data-nav="data"]').click()
    page.locator("#validateData").click()
    assert "通过" in page.locator("#checkId").inner_text()
    assert "通过" in page.locator("#checkShare").inner_text()
    with page.expect_download() as dl:
        page.locator("#downloadData").click()
    rows = list(csv.DictReader(io.StringIO(Path(dl.value.path()).read_text(encoding="utf-8-sig"))))
    assert len(rows) == 240 and len({r["customer_id"] for r in rows}) == 240
    for row in rows:
        assert sum(int(row[k]) for k in ["travel_pct", "food_pct", "shopping_pct", "other_pct"]) == 100
    checks.append("sample validation and CSV download: 240 consistent rows")

    page.locator('[data-nav="groups"]').click()
    page.locator('[data-group="1"]').click()
    assert page.locator("circle").count() == 60
    page.locator("#viewGroupCustomers").click()
    assert "60" in page.locator("#customerCount").inner_text()
    page.locator("#customerFilter").select_option("-1")
    page.locator("#search").fill("C0001")
    assert page.locator('[data-profile]').count() == 1
    page.locator('[data-profile="C0001"]').click()
    assert page.get_by_role("dialog").is_visible()
    assert "未授权" in page.locator("#modalBody").inner_text()
    page.keyboard.press("Escape")
    assert not page.get_by_role("dialog").is_visible()
    page.locator("#search").fill("not-found")
    assert "没有匹配" in page.locator(".empty").inner_text()
    page.locator("#search").fill("C0240")
    page.locator('[data-profile="C0240"]').click()
    page.locator("#profileAi").click()
    assert "C0240" in page.locator("#aiOutput").inner_text()
    assert page.locator("#aiCustomer").input_value() == "C0240"
    checks.append("group filtering, customer search, empty state, dialog, and AI handoff")

    page.locator('[data-nav="strategy"]').click()
    # Independently recompute all combinations from the downloaded CSV.
    for kind, key, threshold in [("travel", "travel_pct", 35), ("food", "food_pct", 35), ("digital", "online_pct", 75)]:
        for cap in [1, 2, 4]:
            for authorized in [True, False]:
                page.locator("#strategyType").select_option(kind)
                page.locator("#cap").fill(str(cap))
                page.locator("#cap").dispatch_event("change")
                page.locator("#consent").set_checked(authorized)
                expected = [r for r in rows if int(r[key]) >= threshold
                            and (not authorized or r["contact_allowed"] == "true")
                            and int(r["touches_this_month"]) < cap
                            and int(r["days_since_contact"]) >= 7]
                assert page.locator("#eligibleCount").inner_text().startswith(str(len(expected))+" ")
    with page.expect_download() as dl:
        page.locator("#exportStrategy").click()
    report=Path(dl.value.path()).read_text(encoding="utf-8-sig")
    assert "不可执行" in report and "合成样例" in report
    page.locator("#consent").check()
    page.locator("#strategyType").select_option("travel")
    page.locator("#cap").fill("2")
    page.locator("#cap").dispatch_event("change")
    page.screenshot(path=str(ASSETS / "strategy.png"))
    checks.append("18 strategy scenarios verified against exported data; report labeling verified")

    page.locator('[data-nav="ai"]').click()
    page.locator("#aiCustomer").select_option("C0001")
    page.locator("#generateAi").click()
    ai_text=page.locator("#aiOutput").inner_text()
    assert "未调用 DeepSeek" in ai_text and "未授权" in ai_text
    checks.append("AI template and missing authorization are explicit")

    for width in [1440, 900, 390]:
        page.set_viewport_size({"width":width, "height":900})
        for key in ["overview","data","groups","customers","strategy","ai"]:
            page.locator(f'[data-nav="{key}"]').click()
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), (width, key)
    checks.append("six views fit desktop, tablet and mobile widths")
    browser.close()

assert not errors, errors
print(json.dumps({"status":"passed", "checks": checks, "browser_errors":errors}, ensure_ascii=False, indent=2))
