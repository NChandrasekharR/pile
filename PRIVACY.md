# Pile privacy policy

_Effective 9 November 2026_

Pile is a browser extension that saves the tabs you close into a reading list. It works entirely inside your browser, on your computer. This page explains what it keeps and where.

## What Pile stores

When you close a tab, Pile saves:

- the page's address (URL), with tracking parameters such as `utm_*` and `fbclid` removed
- the page's title and site name
- when you closed it, and how many times you've closed the same address
- whether you've marked it read, kept or done
- which tabs you closed together

Pile only saves `http` and `https` pages. Browser pages (`chrome://` and similar), extension pages and local files are ignored.

To do this, Pile also keeps a temporary list of the URLs and titles of your open tabs, because the browser doesn't say which page a tab held at the moment it closes. That list lives in session storage and is cleared when the browser quits.

When you install Pile, when the browser starts, and when you click **Pull from browser**, Pile reads the browser's own Recently Closed list and adds those tabs in the same way.

Site icons are shown from the browser's own favicon cache.

## Where it's stored

Everything is kept in your browser's local extension storage (`chrome.storage.local`) on this computer. It isn't synced to your Google account or any other service.

## What Pile does not do

- It makes no network requests. Nothing you save leaves your computer.
- It has no account, no server, no analytics and no advertising.
- It doesn't read the content of the pages you visit, only their address and title.
- It doesn't sell, share or transfer your data to anyone.

## Exporting and deleting

**Export** creates a Markdown, JSON or bookmarks file and saves it to your computer, only when you ask it to.

You can delete any link inside Pile, or delete everything shown at once. Removing the extension deletes all of Pile's data from your browser, so export first if you want to keep it.

## Changes

If this policy changes, the new version will be published here with a new effective date. The full history is in this repository's commit log.

## Contact

Questions or concerns: [open an issue](https://github.com/NChandrasekharR/pile/issues).
