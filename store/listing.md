# Chrome Web Store submission: Pile

Everything to paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), tab by tab.

Live listing: https://chromewebstore.google.com/detail/pile/hojmpdhoiphnbokfmfgacehjnfmbdlfg

## Before you start

- [ ] Register as a Chrome Web Store developer and pay the one-time fee. The dashboard shows the current amount.
- [ ] Turn on 2-Step Verification for the Google account you publish from.
- [ ] Check the website is up: homepage, support and privacy pages all load (served from `docs/` by GitHub Pages).
- [ ] Build the upload: `store/package.sh` writes `dist/pile-<version>.zip` with only the extension's own files.

## Package

**Add new item** → upload `dist/pile-1.0.0.zip`.

For updates, bump `"version"` in `manifest.json`, rerun `store/package.sh`, and upload the new zip on the Package tab.

## Store listing

**Item name and summary** come from `manifest.json`:
- Name: `Pile`
- Summary: `Every tab you close, kept as a reading list you can actually come back to.`

**Description** (plain text, paste as is):

```
Pile keeps every tab you close as a reading list you can come back to.

Close tabs freely. Close whole windows. Pile saves each one the moment it closes, so "I'll read that later" no longer means keeping sixty tabs open.

WHAT IT DOES
• Saves every tab as you close it, including a whole window at once.
• Pulls in the browser's Recently Closed list when you install it and after a restart.
• Keeps tabs you closed together as a group, so a closed window reads as one unit instead of fifty unrelated rows.
• Removes duplicates and strips tracking parameters (utm_*, fbclid and friends). The same article closed four times is one row marked "closed 4×".
• Search titles and links, filter by site, and sort by when you closed it, by site, by title or by how often you closed it.
• Triage mode shows one link at a time, full screen: open it, keep it, mark it done, delete it or skip it.
• Export as Markdown grouped by site, as JSON, or as a bookmarks file any browser can import.
• Follows your system's light or dark mode. The line beside each row darkens with age, so you can see what's been sitting there.

KEYBOARD
/ search · j k move · o open · s keep · e done · x delete · u undo · t triage
Alt+Shift+P opens Pile from anywhere.

PRIVATE BY DESIGN
Everything stays in your browser's local storage on this computer. Pile has no host permissions, makes no network requests, and has no account and no analytics. Site icons come from the browser's own cache. Uninstalling Pile deletes its data, so export first if you want to keep it.

Free and open source: https://github.com/NChandrasekharR/pile
```

**Category:** Productivity. If the dashboard offers subcategories, pick Workflow & Planning.
**Language:** English

**Graphics**

| field | file |
|---|---|
| Store icon (128×128) | `icons/icon128.png` |
| Screenshot 1 | `store/screenshot-1-overview.jpg` |
| Screenshot 2 | `store/screenshot-2-capture.jpg` |
| Screenshot 3 | `store/screenshot-3-reading-list.jpg` |
| Screenshot 4 | `store/screenshot-4-triage.jpg` |
| Screenshot 5 | `store/screenshot-5-search-export.jpg` |
| Small promo tile (440×280) | `store/promo-small-440x280.jpg` |
| Marquee promo tile (1400×560) | `store/promo-marquee-1400x560.jpg` |

**Homepage URL:** `https://nchandrasekharr.github.io/pile/`
**Support URL:** `https://nchandrasekharr.github.io/pile/support/`

## Privacy

**Single purpose description**

```
Pile saves the tabs you close into a local reading list, so you can find, triage and reopen them later.
```

**Permission justifications**

`tabs`
```
Pile needs each tab's URL and title to save it when it closes. Chrome only passes a tab ID to the close event, so Pile keeps a local copy of open tabs' URLs and titles and reads it back when a tab closes.
```

`sessions`
```
Pile reads the browser's Recently Closed list when it's installed, when the browser starts (quitting the browser closes tabs without firing a close event), and when the user clicks "Pull from browser".
```

`storage`
```
Stores the reading list in chrome.storage.local, and a temporary list of open tabs in chrome.storage.session. Nothing is synced or sent anywhere.
```

`unlimitedStorage`
```
A reading list of thousands of closed tabs can outgrow the default local storage quota. This permission keeps new tabs from being silently dropped once the list gets large.
```

`favicon`
```
Shows each saved link's site icon from the browser's own favicon cache, so Pile never has to fetch icons from the network.
```

**Host permissions:** none requested.

**Remote code:** No, I am not using remote code.

**Data usage.** Tick **Web history**, then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

If the form asks for detail on web history:
```
Pile stores the URL, title and closing time of tabs the user closes, in chrome.storage.local on the user's device only. It is never transmitted.
```

**Privacy policy URL:** `https://nchandrasekharr.github.io/pile/privacy/`

## Distribution

- Payments: free
- Regions: all
- Visibility: Public, or Unlisted if you want to share the link before it shows up in search

## Test instructions

No account or credentials needed. Optional note for the reviewer:

```
No login required. Install, close a few tabs (or a whole window), then click the Pile toolbar icon or press Alt+Shift+P to open the reading list. Press T for triage mode.
```

## After you submit

Review time depends on the permissions. Pile's `tabs` and `sessions` show users a "Read your browsing history" warning, and reviewers check those more closely. The single-purpose and permission text above is written for that. You can choose to publish by hand after approval. The approval holds for 30 days.
