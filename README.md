# Chicken Khata 🐔

A voice-first Android app for my home poultry farm and shop. It records chicken sales (live, cut meat, khutta-tauko), grain and medicine purchases, deaths and feeding lot by lot, plus the shop's daily cash and QR collection. It also shows profit. It runs on several phones, uses the Nepali (BS) calendar, and understands English and Nepali voice.

> Screenshots use **demo data**.

<table>
<tr>
<td align="center"><img src="docs/screenshots/01-home.png" width="230"><br><sub>Home: chicken & shop today</sub></td>
<td align="center"><img src="docs/screenshots/02-lots.png" width="230"><br><sub>Lot card: birds left, spent, grain in bora</sub></td>
<td align="center"><img src="docs/screenshots/05-voice-confirm.png" width="230"><br><sub>Voice: "sold 2.5 kg live" → confirm</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/03-lot-details.png" width="230"><br><sub>Lot details & costs</sub></td>
<td align="center"><img src="docs/screenshots/04-lot-daily.png" width="230"><br><sub>Daily sales chart (tap a bar)</sub></td>
<td align="center"><img src="docs/screenshots/13-entries.png" width="230"><br><sub>Tap any number → edit / delete entries</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/06-sell.png" width="230"><br><sub>Sell form (birds estimated)</sub></td>
<td align="center"><img src="docs/screenshots/07-profit.png" width="230"><br><sub>Profit report</sub></td>
<td align="center"><img src="docs/screenshots/08-stock.png" width="230"><br><sub>Grain & medicine stock</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/09-shop.png" width="230"><br><sub>Shop: cash, QR, goods</sub></td>
<td align="center"><img src="docs/screenshots/10-shop-report.png" width="230"><br><sub>Shop daily / weekly / monthly</sub></td>
<td align="center"><img src="docs/screenshots/11-log.png" width="230"><br><sub>Change log (who changed what)</sub></td>
</tr>
</table>

## Features

**Chickens and lots**
- Lots are auto-named from the Nepali date the chicks arrived, e.g. `Ashar83_10_1_100`: Ashar 2083, day 10, the 1st lot that month, 100 chicks.
- One lot can hold several chicken types (Broiler, Local, Giriraj, or your own), each with its own count and prices.
- You can add chicks to a lot later (for example after a predator attack). Deaths, cuts, weigh-ins and count checks are kept per type.
- Every sale reduces the bird count:
  - **Live sales:** the app estimates the birds from kg and the weight per bird, which comes from age, weigh-ins and recent sales.
  - **Meat sales:** you record the chickens cut, and leftover meat is kept as "cut meat in stock".
- **Count check:** the app reminds you to count the birds. If the count differs, it records the missing ones as dead, sold or cut.
- **Lot cards fold** into a one-line list. At most 3 stay open, and closed lots start folded. Each card shows birds left, sales, money spent, profit, and grain used per size in **bora** (kg in small text).
- **Lot details:** daily sales chart and list, and history split into **Sales / Purchases / Process**.
- **Tap any number** (dead, sold, grain, spent…) to see the entries behind it, then edit or delete a mistake.
- Archive a lot instead of deleting it, and restore it any time.

**Selling**
- Sale types: **live**, **cut meat**, **khutta-tauko** (own rate, default Rs 150/kg) and **grain** (B0–B3, by bora or kg).
- Default prices per chicken type, and buy/sell rates per grain size. If you give a different price, the app asks whether to save it as the new default.
- If you give only the amount, the app works out the kg from the rate (and the other way round).
- Credit (udharo) flag and invoice number.

**Buying and stock**
- Buy feed by grain size (B0, B1, B2, B3; 1 bora = 50 kg, or by kg), plus medicine, vitamins, vaccines and equipment, with supplier and credit.
- Stock left = bought − used − sold, for each grain size and each medicine.

**Profit and reports**
- Profit for this month, last month, this Nepali fiscal year (from Shrawan), last year, or all time.
- Profit per lot, per bird, mortality %, and feed per kg sold.
- Tap a bar in any chart to see that day's sales, purchases and process entries.
- CSV exports (sales, purchases, process, lots, shop) and WhatsApp share.

**🏪 Shop register**
- Daily **cash**, **QR** (eSewa, Khalti, Fonepay) and **goods bought**.
- Reports: daily (31 days), weekly (12 weeks), monthly (12 Nepali months), with averages.

**Voice (English and Nepali)**
- Tap 🎤 and speak. The app shows what it heard, asks "Save?", and you answer by voice or by tapping.
- It understands Nepali numbers, including डेढ, साढे दुई, आधा, सय and हजार, and Devanagari or romanized words such as masu, jiudo, mare, dana, kineko, nagad and gate.

**Several phones and users**
- Every entry stores **who** entered it and **when**. Edits and deletes are logged in a **change log**.
- Sync works through a Google Sheet (automatic; the sheet also gets readable tabs) or a sync file (offline).
- **Built-in updater:** screen updates install silently from GitHub Releases, and app updates show an "Install" banner. If an update ever fails to start, the app goes back to the working version by itself.

## Things you can say
| What | Say |
|---|---|
| Sell meat | "chicken sold 1 kg", "1kg masu", "एक केजी मासु" |
| Sell live | "sold 3 live giriraj chickens 7 kg at 320", "डेढ केजी जिउँदो कुखुरा" |
| Only amount | "sold live 550 rupees" |
| Khutta-tauko | "khutta tauko 2 kg", "खुट्टा टाउको २ केजी" |
| Grain sale | "sold 2 bora B1 dana", "B2 dana 10 kg becheko 1000" |
| Buy | "bought 10 bags B2 feed for 34000 from Ram", "bought 2 bottles amprolium medicine 900 credit" |
| Use feed / medicine | "feed B2 2 bags lot 1", "medicine amprolium 1 bottle lot 1" |
| Dead / cut | "2 dead in lot 1", "आज दुई वटा कुखुरा मरे", "cut 5 chickens lot 2" |
| Chicks | "new lot 80 broiler 20 giriraj chicks", "added 100 broiler chicks to lot 1 at 120" |
| Count check | "lot 1 has 220 left" |
| Shop | "shop cash 5000 QR 3000 goods 2000", "पसल नगद पाँच हजार क्यूआर तीन हजार" |
| Ask | "how many left?", "how much feed left?", "today's summary", "yo mahina ko nafa kati" |
| Dates | "yesterday …", "Kartik 2 gate …" |

## Install on a phone
1. On the phone, open the latest release: <https://github.com/rs0404/chicken-khata-updates/releases/latest>. Download **ChickenKhata-x.y.apk** and install it, allowing "Install unknown apps" when asked.
2. Open the app, enter your name and the prices, then add your first lot.
3. After that, the phone updates itself.

> On Samsung phones with **Dual Apps**, install only the normal copy. A dual copy has separate, empty data.

## Several phones: Google Sheet sync
Paste [`google-sheet-sync/ChickenKhata-Sync.gs`](google-sheet-sync/ChickenKhata-Sync.gs) into a Google Sheet (Extensions → Apps Script). Deploy it as a web app, then paste the link and the sync key into Settings on every phone. The steps are at the top of the file.

## Build and release (developer)
Needs the Android SDK command line tools (build-tools 35, platform 35) and a JDK. No Gradle.
```bash
./build.sh      # builds ChickenKhata.apk and dist/ (update.json, web-<ver>.json, APK)
./publish.sh    # creates GitHub Release v<WEB_VERSION> with the dist/ files
```
- Versions are in [`version.env`](version.env):
  - Raise `WEB_VERSION` for screen and logic changes (installed silently).
  - Raise `APK_CODE`/`APK_NAME` only when `src/` or `AndroidManifest.xml` changes.
- The signing key (`signing/`) stays on the build computer and is **never committed**. Every update must be signed with it.
- Phones read `https://github.com/rs0404/chicken-khata-updates/releases/latest/download/update.json`.
- To try the screens in a browser: `python3 devserver.py` → <http://localhost:8765>.

## Project layout
| Path | What |
|---|---|
| `src/…/MainActivity.java` | Android shell: WebView, voice (SpeechRecognizer), text-to-speech, files, updater, APK installer |
| `assets/` | The app: `core.js` (data, stats, sync), `parser.js` (voice → command), `flows.js` (conversations), `ui.js` (screens), `shop.js`, `updater.js`, `nepcal.js` (BS calendar from [yarsa/nepal-compliance](https://github.com/yarsa/nepal-compliance)) |
| `google-sheet-sync/` | Google Apps Script for multi-phone sync |
| `docs/screenshots/` | README images (demo data) |
