# Tab Group Bookmarks

Chrome extension that saves your tab groups as bookmark folders with matching names.

## Install

1. Clone this repo (or download it as a ZIP and unzip).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the repo folder.

To update: `git pull`, then click the reload icon on the extension in `chrome://extensions`.

## Usage

- Click the extension icon to see the tab groups in the current window.
- Pick a destination with **Save to**.
- Click **Save** on a group, or **Save All**.

Each group is saved as a folder named after the group, inside the selected destination. If that folder already exists, new tabs are appended and URLs already saved there are skipped.
