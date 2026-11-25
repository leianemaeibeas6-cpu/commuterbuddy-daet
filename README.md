# Commuter Buddy Web
### Daet Commuter & Tourism Guide: Final Project (Website Conversion)

**IT105 – Application Development and Emerging Technologies**
College of Computing and Multimedia Studies, University of Camarines Norte · 1st Semester, AY 2026–2027

| | |
|---|---|
| **Live website** | `https://__________________` *(add your link after deploying, see Section 8)* |
| **Group members** | `__________________` |
| **Based on** | Commuter Buddy Android app (Midterm project, Java / Android Studio) |

---

## Contents
1. [About the system](#1-about-the-system)
2. [Features](#2-features)
3. [Android to web conversion](#3-android-to-web-conversion)
4. [Emerging technologies](#4-emerging-technologies)
5. [Technologies used](#5-technologies-used)
6. [Folder structure](#6-folder-structure)
7. [Requirements](#7-requirements)
8. [Installation and deployment](#8-installation-and-deployment)
9. [User guide](#9-user-guide)
10. [Data, storage and privacy](#10-data-storage-and-privacy)
11. [Input validation and error handling](#11-input-validation-and-error-handling)
12. [Testing](#12-testing)
13. [Limitations and future improvements](#13-limitations-and-future-improvements)

---

## 1. About the system

**Commuter Buddy** helps commuters and visitors in **Daet, Camarines Norte** plan short trips around town.
It shows routes on a map, estimates tricycle and jeepney fares by distance (with student, PWD and
senior citizen discounts), lists places to visit, and collects anonymous trip feedback.

This web app is a **conversion of our approved Midterm Android app**. It keeps the **same purpose,
screens, data and fare rules**, and adapts them to the web so it works on any phone, tablet or computer
through a browser. It can also be **installed like an app** and **used offline**.

---

## 2. Features

| Screen | What it does |
|---|---|
| **Welcome / User type** | Choose *Regular Commuter, Student, PWD, Senior Citizen* or *Tourist / Visitor*. This sets the fare type and tags feedback. No name or account needed. |
| **Home** | Greeting, quick tricycle fare for your user type, shortcuts to all features, frequent routes with fares, commuter tips, and an **Install app** button. |
| **Routes** | Pick *From*, *To* and *Transport*, then see the trip on an interactive map along the **real roads**, with **distance, travel time, estimated fare**, a **landmark hint**, and **turn-by-turn directions** (the roads you'll pass, e.g. *"Turn left onto …"*, plus a *"Via …"* summary). Includes a searchable **Frequent routes** dialog, a **swap** button, **Use my location**, and map pins you can tap to set the start or destination. |
| **Fares** | Live **fare calculator** using the **new Daet tricycle fare** (₱20 regular / ₱15 Student-PWD-Senior for the first 2 km, then +₱2 per km), solo and 4-person fares, **day / night fares** and a **Special trip** option (both always higher than the exact ₱20 / ₱15 fare), with a discount switch, regular vs. discounted comparison, a **common routes table** (tap to compute), and a "How fares are estimated" guide. |
| **Places** | 19 places (tourist spots, landmarks, food, businesses), including must-visit spots like the **First Rizal Monument**, **Daet Heritage Center**, **Daet Cathedral** and **SM City Daet**, with **search by name or address** (the description is not searched), **category filters**, and **View on map** / **Get fare** shortcuts. |
| **Feedback** | Rate your **experience with the fare** anonymously (route accuracy, fare accuracy, overall), enter the **amount you were really charged (any amount, even ₱1,000)** and a comment. Before it is saved, a **photo captcha** checks that you really rode: you photograph the vehicle's number, an **AI reads it**, and you type it (Section 4.4). Shows a **rating summary**, how often the estimate matched the real fare, and the **10 most recent reviews**. |

All screens share one navigation bar: a **top menu** on desktop and an app-style **bottom bar** on tablets and phones, like the Android app.

---

## 3. Android to web conversion

The web app keeps the same structure as the Android project. Each Android part has a matching web part.

| Android (Midterm) | Web (Final) |
|---|---|
| `UserTypeActivity.java` | `index.html` + `js/pages/welcome.js` |
| `MainActivity.java` | `home.html` + `js/pages/home.js` |
| `RouteActivity.java` | `routes.html` + `js/pages/routes.js` |
| `FareActivity.java` | `fares.html` + `js/pages/fares.js` |
| `PlacesActivity.java` | `places.html` + `js/pages/places.js` |
| `FeedbackActivity.java` | `feedback.html` + `js/pages/feedback.js` |
| `LocationData.java`, `Place.java` | `js/data.js` (same places, same order, same frequent routes) |
| `FareCalculator.java` | `js/fare.js` (same constants and formulas) |
| `UserPrefs.java`, `FeedbackStore.java` | `js/storage.js` |
| `BottomNavHelper.java` | `js/ui.js` → `renderChrome()` |
| `SharedPreferences` | `localStorage` |
| Intent extras (`EXTRA_START`, `EXTRA_DEST`, `EXTRA_TRANSPORT`) | URL parameters, e.g. `routes.html?start=0&dest=6&transport=Tricycle` |
| Google Maps SDK (needs API key) | **Google Maps JavaScript API + Routes API** when a key is set in `js/config.js`; otherwise Leaflet + OpenStreetMap (free, no key) |
| `Spinner` | `<select>` |
| `RatingBar` | Star rating built from radio buttons |
| `SwitchMaterial` | Accessible CSS switch (`<input type="checkbox" role="switch">`) |
| `AlertDialog` (frequent routes) | Native HTML `<dialog>` |
| `RecyclerView` (places list) | Cards generated with JavaScript |
| `Toast` | `CB.ui.toast()` message |
| `res/values/colors.xml` | CSS variables in `css/main.css` (same colors) |

**Improvements made while converting**
- The route line now **follows real roads** when online (Google Routes API or OpenStreetMap/OSRM), instead of a straight line only.
- Tricycle fares updated to the **new Daet fare** (first 2 km, then per kilometer).
- **8 more must-visit places** added (19 in total) and 3 more frequent routes; old map pins for the town plaza and old church corrected.
- **Turn-by-turn directions** list the roads the trip passes (*dadaanan*), which the Android app did not have.
- Trips can be **bookmarked or shared** because the trip is saved in the page URL.
- Stricter **input validation** with clear messages next to each field.
- Feedback summary now shows **how often the estimated fare matched** the fare actually paid.
- Map pins have **Set as start / Set as destination** buttons.

---

## 4. Emerging technologies

### 4.1 Progressive Web App (PWA): install and offline use
**Files:** `manifest.webmanifest`, `service-worker.js`, `js/pwa.js`, `assets/icons/`

- **What it does:** The website can be **installed on a phone's home screen** and opens full screen
  like a native app. A **service worker** saves the pages, styles, scripts and data on the device, so the
  app still opens and works **without internet**.
- **Why we used it:** It keeps the "app" experience of our Android project while being a website.
  Commuters often have weak or no mobile data, and fares, places and feedback should still work.
- **How it works:** On first visit the service worker saves the app files (*app shell*). Later visits load
  the saved copy instantly and update it in the background (*stale-while-revalidate*). Map tiles you have
  viewed are also saved (up to 400 tiles).
- **Limitations:** Needs **HTTPS** (any of the hosts in Section 8 provide it). The live map and road routing
  need internet the first time. iPhone users install with *Share → Add to Home Screen*.

### 4.2 Location-based service (Geolocation API)
**Files:** `js/geo.js`, used in `js/pages/routes.js`

- **What it does:** **Use my location** finds the user's GPS position, shows it on the map, and sets the
  **nearest Commuter Buddy point** as the starting place.
- **Why:** New commuters and tourists often don't know the name of the place they are standing in.
- **Limitations:** Needs **HTTPS** and the user's **permission**. Accuracy depends on the device (GPS is
  better than Wi-Fi). If the user is more than 25 km from Daet, the start point is not changed.

### 4.3 Maps and real-road routing (online data services)
The Routes page draws the trip **along the actual roads**, not a straight shortcut. It supports two providers:

| | Google Maps (with API key) | OpenStreetMap (no key) |
|---|---|---|
| Map | Maps JavaScript API | Leaflet + OpenStreetMap / CARTO tiles |
| Road route | **Routes API** (`Route.computeRoutes`) | OSRM (Open Source Routing Machine) |
| Setup | Paste key in `js/config.js` (Section 8.4) | Nothing to set up |

- The app uses Google's new **Routes API**. The old `DirectionsService` was retired by Google in 2026, so it is not used.
- **Automatic backup:** if the Google key is missing, wrong, not allowed for the website, or over its daily limit,
  the map switches to OpenStreetMap by itself and shows a short message. The page never breaks.
- **Directions:** the same routing reply also gives the list of roads and turns, shown under the trip as
  *Roads you'll pass*. Street names come from OpenStreetMap (or Google when a key is set).
- If road routing is slow or offline, a dashed straight line is shown with a note, like the Android version
  (the directions list is hidden in that case).

### 4.4 Machine Learning: AI photo captcha (Feedback)
**Files:** `js/ocr.js`, used in `js/pages/feedback.js`

- **What it does:** Before feedback is saved, the commuter takes a **photo of the number painted on the tricycle**
  (body number; for a jeepney, the digits of the plate number). An **AI reads the number from the photo**, and the
  commuter **types the number they see**. The feedback is accepted only when the typed number **matches** what the AI read.
- **Why:** Feedback is anonymous, so the app needs a light way to show that the commuter was really beside that vehicle.
  It works like a captcha, but the "puzzle" is the real vehicle.
- **How it works:** The photo is shrunk, turned to grey and its contrast is stretched; it is read twice (normal and
  inverted, so dark-on-light and light-on-dark numbers both work). The model is **Tesseract** (an LSTM neural-network OCR
  engine) run in the browser through **Tesseract.js / WebAssembly**, limited to the digits 0-9. Every group of 2-8 digits
  the AI is reasonably sure about is kept, and the typed number must equal one of them. The detected numbers are
  **never shown** to the user, so they cannot simply copy them.
- **Privacy:** The AI runs **on the phone**. The photo is **not uploaded, not saved** and is discarded when the dialog closes.
  Only a "Ride verified" flag is saved with the feedback, not the number and not the photo.
- **Results the user can see:** *AI found a number* (type it), *could not read a number* (retake the photo; feedback is blocked),
  *wrong number* (does not match the photo), or *AI could not load*.
- **Limitations:** The first use downloads the AI (about 3 MB library + language data) and needs internet; after that the browser
  keeps it. If the AI cannot be loaded at all (for example no internet the very first time), the feedback can still be sent but is
  marked **not AI-verified** and has no "Ride verified" badge. Reading depends on photo quality: dirty, faded or angled numbers may need a retake.
  OCR cannot prove the photo was taken *during* the trip; it only shows the commuter had access to that vehicle's number.

---

## 5. Technologies used

| Technology | Used for |
|---|---|
| **HTML5** | Page structure, semantic elements (`header`, `nav`, `main`, `section`, `dialog`, `fieldset`) |
| **CSS3** | Design system with CSS variables, Flexbox, CSS Grid, transitions, media queries (responsive) |
| **JavaScript (ES5/ES6, no framework)** | Interactivity, fare logic, validation, dynamic content, storage |
| **Web Storage API** (`localStorage`) | Saving user type, anonymous ID and feedback |
| **Service Worker + Cache API, Web App Manifest** | PWA: offline use and installation |
| **Geolocation API** | "Use my location" |
| **Tesseract.js 5.1.1** (via jsDelivr CDN) | Machine Learning: on-device AI that reads the vehicle number in the feedback photo captcha |
| **File input + Canvas API** | Taking / choosing the photo and preparing it for the AI |
| **Google Maps JavaScript API + Routes API** | Map and real-road routes (when an API key is set) |
| **Leaflet 1.9.4** (via unpkg CDN) | Interactive map (no-key version and automatic backup) |
| **OpenStreetMap / CARTO tiles, OSRM** | Map images and road routes (no-key version) |
| **Google Fonts** (Poppins, Inter) | Typography |

No build tools or installs are needed. The project is plain files that run in any modern browser.

---

## 6. Folder structure

```
CommuterBuddy-Web/
├── index.html              Welcome / user type (first screen)
├── home.html               Home
├── routes.html             Routes + map
├── fares.html              Fare calculator
├── places.html             Places to visit
├── feedback.html           Trip feedback
├── manifest.webmanifest    PWA settings (name, icons, colors)
├── service-worker.js       Offline caching (PWA)
├── README.md               This documentation
├── assets/
│   └── icons/              App icons (favicon, 192, 512, maskable, Apple)
├── css/
│   ├── main.css            Design system: colors, layout, components, responsive rules
│   └── pages.css           Styles for each page
└── js/
    ├── config.js           Settings: Google Maps API key goes here
    ├── data.js             Places, frequent routes, user types
    ├── fare.js             Fare and distance calculations
    ├── storage.js          localStorage (user type, anonymous ID, feedback)
    ├── ui.js               Navigation, toasts, URL trip data, helpers
    ├── pwa.js              Install button and service worker registration
    ├── map.js              Google Maps / OpenStreetMap map and road routing
    ├── geo.js              Geolocation (nearest place)
    ├── roads.js            Real road distance (OSRM) + saved distances
    ├── search.js           Type-to-search From / To boxes (name + address only), recent searches
    ├── ocr.js              Machine Learning: AI reads the vehicle number from a photo (captcha)
    └── pages/              One script per page
        ├── welcome.js
        ├── home.js
        ├── routes.js
        ├── fares.js
        ├── places.js
        └── feedback.js
```

All JavaScript is wrapped in one namespace, `window.CB`, so files do not clash
(e.g. `CB.fare.estimateTrip()`, `CB.storage.feedback.add()`).

---

## 7. Requirements

**To use the website**
- A modern browser: Chrome, Edge, Firefox, Safari or Samsung Internet (2022 or newer)
- Internet connection for the first visit and for the live map
- For install, offline mode and "Use my location": the site must be opened over **HTTPS**

**To edit the code**
- Any text editor (VS Code recommended)
- Optional: VS Code **Live Server** extension, or Python, to run a local server

---

## 8. Installation and deployment

### 8.1 Run on your computer (for development)
Opening `index.html` by double-clicking works for most features, but **offline mode, install and
location need a local server**:

- **VS Code:** install the *Live Server* extension → right-click `index.html` → **Open with Live Server**.
- **Python:** open a terminal in the project folder and run
  `python -m http.server 8000`, then visit `http://localhost:8000`.

### 8.2 Put it online (required)
Any free static host works. Both options below give a free **HTTPS** link.

**Option A: Netlify Drop (easiest, about 2 minutes)**
1. Go to **app.netlify.com/drop** and log in (free account).
2. Drag the whole `CommuterBuddy-Web` folder onto the page.
3. Netlify gives a link such as `https://commuter-buddy-xyz.netlify.app`. Rename it under *Site settings*.

**Option B: GitHub Pages**
1. Create a public GitHub repository and upload all the files (keep the folder structure).
2. Go to **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
3. After about a minute the site is live at `https://<username>.github.io/<repository>/`.

### 8.3 After changing files
Open `service-worker.js` and **change `VERSION`** (e.g. `v1.2.0` → `v1.2.1`) before uploading again.
This tells installed copies to download the new files.

### 8.4 Google Maps API key (optional, for Google Maps with real-road routes)
Without a key the app uses OpenStreetMap, which also follows real roads. To use Google Maps:

**A. Free Maps Demo Key (no credit card, good for class demos)**
1. Open the **Google Maps Platform "Maps Demo Key"** page and click **Get demo key**. Sign in with a Google account.
2. Copy the key.
3. The demo key has a **daily limit** per API. When it is reached, the app switches to OpenStreetMap until the next day.

**B. Standard key (needs a billing account / credit card; small projects stay within the free monthly usage)**
1. Go to **console.cloud.google.com** → create a project → link a billing account.
2. **APIs & Services → Library**: enable **Maps JavaScript API** and **Routes API**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. **Restrict the key:** *Websites* → add your site (e.g. `https://your-site.netlify.app/*`) and `http://localhost/*`;
   *API restrictions* → only Maps JavaScript API and Routes API.
5. Set a **budget alert** under Billing.

**Paste the key**
1. Open `js/config.js` and put the key between the quotes:
   `GOOGLE_MAPS_API_KEY: 'AIza...your key...',`
2. Change `VERSION` in `service-worker.js`, then upload again (Section 8.2).
3. Open **Routes**, show a trip, and check the note under the trip: it should say
   *"follows the real roads (Google Maps routing)"*.

> Keep `GOOGLE_MAP_ID: 'DEMO_MAP_ID'` for demos. For a long-term public site, create your own Map ID in
> Google Cloud (*Google Maps Platform → Map Management*) and paste it there.
> An API key used in a website is visible to visitors, which is why **restricting it to your website** (step 4) matters.

---

## 9. User guide

**First time**
1. Open the website. On **Who's commuting today?**, choose your user type and tap **Continue**.
   (Change it anytime with the user button at the top right.)

**Check a route**
1. Go to **Routes**. Choose **From** and **To** (or tap **Frequent routes**).
2. Choose **Tricycle** or **Jeepney**, then tap **Show route**.
3. Read the distance, travel time, fare and landmark hint. Tap **View fare** or **Rate this trip**.
4. *Optional:* tap **Use my location** to start from the nearest point, or tap a map pin and choose
   **Set as start / Set as destination**.

**Check a fare**
1. Go to **Fares**. Choose the places and transport; the fare updates immediately.
2. Turn the **discount switch** on or off to compare. Tap any row in **Common routes** to compute it.

**Find a place**
1. Go to **Places**. Type in the search box or tap the **microphone** and say a place name.
2. Use the category chips (*Tourist Spot, Landmark, Food, Business*).
3. Tap **View on map** or **Get fare** on a place.

**Give feedback**
1. Go to **Feedback** (or tap **Rate this trip** from Routes/Fares, which fills in the trip).
2. Give all **three star ratings**. Enter the **amount you were actually charged** (any whole number of pesos, even if it is much
   higher than the estimate, such as ₱1,000) and write a **comment** about your experience with the fare. Tick **Special trip** if you booked the whole tricycle.
3. Tap **Submit feedback**, tick that you rode, then do the **photo captcha**: take a photo of the number on the tricycle, wait for the AI to read it,
   and type the number you see. Tap **Confirm & submit**. Your review appears in the list on the right (below the form on phones).

**Install the app**
- **Android / desktop Chrome or Edge:** tap **Install app** on Home (or the browser menu → *Install app*).
- **iPhone / iPad (Safari):** tap **Share** → **Add to Home Screen**.

---

## 10. Data, storage and privacy

| Saved item | Key in `localStorage` | Notes |
|---|---|---|
| User type | `cb_user_type` | One of the 5 types |
| Anonymous ID | `cb_anon_id` | Random 6-digit number, e.g. `482915`; no personal data |
| Feedback | `cb_feedback` | List of reviews (max 200 kept), each with a `verified` flag (AI photo captcha matched). The captcha photo and vehicle number are **not** saved |

- Everything stays **on the user's own device**. No name, phone number, email or account is collected.
  Location is used only to find the nearest place and is **not saved**.
- **Editing places:** open `js/data.js`. **Add new places at the end of the list**, because a place's
  position is its ID in links (e.g. `?dest=6`).
- **Places added in the web version** (19 in total): First Rizal Monument (Rizal Park), Daet Heritage Center
  and Museum, Daet Cathedral (Most Holy Trinity), Our Lady of Peñafrancia Parish, Divine Mercy Parish
  (Alawihao), Bagasbas Airport, Bagasbas Lighthouse Hotel Resort and SM City Daet. Frequent routes added:
  Market → SM City Daet, Elevated Plaza → Rizal Monument, SM City Daet → Bagasbas Beach.
- **Where the locations came from:** Wikipedia (Rizal Monument, Daet Cathedral, Bagasbas Airport),
  GCatholic.org plus codes (Old Daet Church, Peñafrancia, Divine Mercy), and published map pins/plus codes
  (Elevated Town Plaza, Heritage Center, Lighthouse Resort, SM City Daet). The town plaza and old church pins
  from the Android data were corrected with these sources. Other Android pins (market, capitol, hospital,
  campus) are still approximate; check them on the live map and adjust if needed.
- **Fares:** minimum fare **₱20 regular / ₱15 Student-PWD-Senior** (first 2 km), then **+₱2 per 1 km** for everyone. A started
  kilometer counts as a full kilometer, and fares are rounded up to the next peso. Fares are per passenger, so a group of 4 pays 4 ×
  the solo fare. A **night surcharge** (+₱5, 8 PM to 5 AM) makes the night fare higher than the exact fare (₱25 regular / ₱20 discounted for the first 2 km). A **Special trip** (whole tricycle, not shared, no discount, tricycle only) costs ₱50 for the first 2 km then +₱5 per km (+₱5 at night), also higher than the exact fare, and is one price for the whole tricycle. A **jeepney between Daet and another town is a flat ₱15** in either direction (Talisay → Daet and Daet → Talisay). Tricycles serve trips inside Daet only; jeepneys serve Daet ↔ other
  towns only (`TOWNS` in `js/data.js`). To change fares, edit `RULES` in `js/fare.js`; the fare guide on the Fares page updates automatically.
- The Android data listed "CNSC Main Campus"; the web version uses **"UCN Main Campus (formerly CNSC)"**.

---

## 11. Input validation and error handling

| Situation | How the app handles it |
|---|---|
| Same place chosen for start and destination | Message under the **To** field; no trip or fare is shown |
| Feedback without all three ratings | Ratings are highlighted, with "Please give all three ratings." |
| Actual fare not a whole number of pesos, or less than ₱1 | Message under the field; feedback is not saved. There is **no ₱500 limit**: commuters can report any amount they were charged (only an absurd value above ₱99,999 is refused as a typing mistake) |
| Photo captcha: no photo, AI still reading, no number found, or typed number does not match the photo | Message in the confirm dialog; feedback is not saved until the photo and number match |
| Photo captcha: AI cannot be loaded (offline the first time) | Warning shown; feedback can be sent but is marked "not AI-verified" |
| Photo is not an image or is over 25 MB | Message asking for another photo |
| Comment too long | Limited to 300 characters with a live counter |
| Comments containing HTML or code | Shown as plain text (escaped), so it cannot run as code |
| Invalid or edited URL (e.g. `?start=99`) | Safe default trip is used instead |
| Opening an inner page before choosing a user type | Redirected to the welcome screen, then back to the page |
| Saved data damaged or edited by hand | Invalid entries are skipped; the page still loads |
| Browser blocks storage (some private modes) | App keeps working and shows a notice that data won't be saved |
| No internet | Orange offline banner; saved pages, fares and feedback still work |
| Map library can't load | "Map unavailable" message; trip details still shown |
| Road routing fails or is slow (6-second limit) | Falls back to a straight dashed line with a note |
| Location permission denied, unavailable or timed out | Clear message explaining what to do |

---

## 12. Testing

The following were tested in Google Chrome on a local server at phone (390 px), tablet (820 px) and
desktop (1440 px) widths. No JavaScript errors appeared and no page scrolled sideways at any of the three widths.

| # | Test case | Expected result | Result |
|---|---|---|---|
| 1 | Open Home with no user type saved | Redirects to welcome screen | Passed |
| 2 | Choose *Student* and continue | Home shows "Hello, Student!" and ₱15 fare | Passed |
| 3 | Open `routes.html?start=0&dest=6&transport=Tricycle` (Student) | Trip card shows Market → Bagasbas, 5.3 km, ~18 min, ₱19 | Passed |
| 4 | Choose the same place for From and To | Error message, trip card hidden | Passed |
| 5 | Frequent routes (10): search "campus" | 2 routes listed; picking one shows the trip | Passed |
| 6 | Swap button | Start and destination switch | Passed |
| 7 | Invalid URL `?start=99&dest=abc&transport=Plane` | Defaults used, no crash | Passed |
| 8 | Fares: discount switch on/off (Market → Bagasbas, 5.3 km) | ₱19 ↔ ₱28 (new fare: 2 km base + per km) | Passed |
| 9 | Fares: tap a row in Common routes | Calculator updates, row highlighted | Passed |
| 10 | Places: *Food* filter, then search "bagasbas" | 2 results, then 1 | Passed |
| 11 | Places: search "zzz", then Clear | Empty message, then all 19 places | Passed |
| 12 | Feedback: submit with no ratings | Ratings error shown | Passed |
| 13 | Feedback: actual fare "abc" and "900" | Validation error shown | Passed |
| 14 | Feedback: valid submit | Toast, review listed, form cleared | Passed |
| 15 | Feedback: reload page | Reviews still there | Passed |
| 16 | Feedback: damaged saved data | Page loads with empty list, no crash | Passed |
| 17 | Comment with `<script>` text | Displayed as text only | Passed |
| 18 | Service worker | Page controlled; "Ready to use offline" shown | Passed |
| 19 | Go offline, open Places and Fares | Pages work; offline banner shows | Passed |
| 20 | Google Maps: key accepted / Routes API fails / script fails / key rejected (tested with a simulated Google Maps) | Road line drawn / dashed line / switches to OpenStreetMap / switches to OpenStreetMap | Passed |
| 21 | Directions list from routing reply (simulated): turn, roundabout, unnamed road, arrival, "Via" summary; hidden when routing fails | Correct text and order | Passed |
| 22 | Search "SM" in From / To | Only **SM City Daet** is listed | Passed |
| 23 | Search a word that appears only in a place description (e.g. "mall", "surfboard"), in From / To and in Places | No results (only name and address are searched) | Passed |
| 24 | Search an address word (e.g. "Lag-on") | The place at that address is listed (SM City Daet) | Passed |
| 25 | Feedback: actual fare ₱1,000 | Accepted (no ₱500 limit) | Passed |
| 26 | Fares: exact vs night vs special trip (Market → Bagasbas) | Night and special are higher than the exact fare; special night is higher than special day | Passed |
| 27 | Jeepney Talisay → Daet and Daet → Talisay | ₱15 both ways | Passed |
| 28 | Photo captcha with a photo of "128" (dark on yellow) and "4521" (light on dark), real Tesseract.js | AI reads both; wrong number rejected; correct number accepted; "Ride verified" shown | Passed |
| 29 | Photo captcha with a blank photo / AI blocked from loading | Blank: cannot submit. AI unavailable: accepted as "not AI-verified" | Passed |
| 30 | Live map tiles, real Google key, road routing, Use my location, place search suggestions, install | Work on the deployed HTTPS site | **Test after deploying** |

> Test case 30 needs the real internet, a phone and HTTPS, so it must be checked on the live site
> before the presentation.

---

## 13. Limitations and future improvements

**Limitations**
- Fares use the **real road distance**. If no road route can be loaded (offline and never loaded before), a plain straight-line distance is shown, marked "≈ approx.". The night surcharge and jeepney town list are placeholders to confirm (see Change log).
- Feedback is saved **per device**, so users only see reviews made on their own device.
- Some place coordinates are approximate (see Section 10), and the beachfront restaurants, surf shops,
  market food stalls and pasalubong shops are grouped listings rather than single shops.
- The live map, road routing and place suggestions need internet. The Google Maps Demo Key has a daily limit.

**Future improvements**
- Store feedback in an online database (e.g. Firebase Firestore) so all commuters can see community reviews.
- Add Filipino instructions for the directions list.
- Add more places with photos, opening hours and contact details.
- Add Filipino / Bikol language options.

---

*Commuter Buddy · Travel & Tourism Guide for Daet, Camarines Norte · Fares shown are estimates only.*

---

## Change log (this update)

- From / To are now **type-to-search boxes** (local places + towns, Google Places or OpenStreetMap suggestions); the route is detected automatically.
- **Recent searches** are saved on the device and shown when a box is tapped and on the Routes page.
- Tap the **map** to set a start / destination.
- **Search by voice removed** from Places.
- Fares: removed the straight-line × 1.25 guess (real road distance is used), +₱2 per km for everyone, solo and 4-person fares, day / night fares.
- Tricycle = inside Daet only; jeepney = Daet ↔ another town only.
- Feedback: confirmation dialog before submitting, posted as **anon**, actual fare and comment are now **required**.
- To confirm: the night surcharge amount (`NIGHT_SURCHARGE`), the town list and the 2 km minimum-fare distance.

### Update: instructor feedback
- **Search (Routes, Fares, Feedback, Places):** only the place **name and address** are searched; the description is no longer searched
  (it is still shown on the Places cards). Name matches come first, so typing "SM" lists *SM City Daet*, and typing part of an address lists the place at that address.
- **Feedback:** removed the ₱1–₱500 limit on the actual fare, because feedback is where commuters report what they really paid
  (for example ₱1,000), even when it is not the official fare. Wording now says the feedback is about the commuter's experience with the fare.
- **Fares:** added a **Special trip** option; night fare and special trip fare are both higher than the exact ₱20 regular / ₱15 Student-PWD-Senior fare.
  Jeepney Talisay → Daet (and Daet → Talisay) is ₱15. The focus stays on estimated fares inside Daet.
- **Machine Learning:** new **AI photo captcha** in Feedback (Section 4.4). `js/ocr.js` is new; `service-worker.js` is now `v1.7.0`.
- **To confirm with the instructor / LGU:** the **special trip** amounts (`SPECIAL_BASE` = ₱50, `SPECIAL_EXTRA_PER_KM` = ₱5 in `js/fare.js`) are placeholders, as is the night surcharge (₱5). Change them in `RULES` and the app and the fare guide update automatically.
