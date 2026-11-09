# Roadmap

Pile 1.0 is good at the first half of the problem: you can close every tab without losing any of them. The second half is getting through what you saved, and that's where most of the work below goes.

The measure that matters is how many links get resolved each week (opened, kept, marked done or deleted), not how many get saved. A reading list that only grows becomes another pile of guilt, and the unread badge becomes a reminder of it.

## Now

Small, cheap to undo, quicker to ship than to debate.

### Learn without tracking

Pile has no analytics and won't get any. What it can use instead:

- the Chrome Web Store dashboard: installs, weekly users, uninstalls
- reviews and GitHub issues
- a short survey page opened on uninstall (`chrome.runtime.setUninstallURL`). This sends nothing from the extension, but the privacy policy should say it happens.

The bar: if fewer than about 30% of installs are still weekly users after four weeks, work on the first run before adding features.

### Less noise

Most tabs you close are finished, not saved for later: search results, mail, localhost, sign-in pages. Today they all land in the pile.

- [ ] "Never save from this site" on each row, with a list to undo it
- [ ] Skip search result pages and webmail by default

### Import

Pile exports but can't import, so a pile can't move to a new machine.

- [ ] Import Pile's own JSON export
- [ ] Import OneTab's text export
- [ ] Import Pocket's CSV export

### Storage that scales

The whole list lives under one `chrome.storage.local` key, and every closed tab rewrites all of it. That's fine at a few thousand rows and slow at fifty thousand.

- [ ] Split storage into chunks (or move to IndexedDB), with a one-time migration

Doing this while there are few installs keeps the migration simple.

## Next

Bigger bets. Each starts as a small version tested on a real pile before it ships to everyone.

### Know which tabs you actually looked at

The `tabs` permission Pile already has can tell how long each tab was in front of you. A tab with ten minutes of focus was probably read. One opened in the background and never looked at is the real backlog.

- [ ] Record focus time per tab and show it on the row
- [ ] If that turns out to be accurate, mark long-focus tabs as read automatically

### Let old links fade

- [ ] A setting to archive unread links after a set age (say 30 days)

Nothing is deleted, and the archive stays searchable. It's meant for people who want permission to forget, so it's a setting, not a default.

### A reason to triage

Triage mode works, but nothing prompts you to use it.

- [ ] A "10 links, 10 minutes" session, started from where the unread count is shown

## Later

Only if the steps above show the need.

- **Topics, on your computer.** Chrome's built-in AI runs locally, so Pile could group saved titles by topic without sending anything anywhere. Worth building only if piles get large and triage isn't keeping up.
- **Firefox and Edge.** More reach, once people are sticking with it on Chrome.

## Not planned

- **Cloud sync or accounts.** Chrome's sync storage is far too small for a pile, so sync would need a server. Keeping everything on your computer is the point of Pile.
- **Reading page content.** It needs permission on every site, which means a scarier install warning, for little gain. Titles and focus time are enough.

## Open question

People who hoard tabs want different things. Some want to keep everything and need search, tags and export. Others want permission to let go and need fading, archiving and a smaller unread count. Those two groups pull "Let old links fade" and "A reason to triage" in opposite directions. Feedback from the first few weeks should show which group is installing Pile.

Have a view? [Open an issue](https://github.com/NChandrasekharR/pile/issues).
