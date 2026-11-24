import { groupDisplayName, saveGroupById } from "./shared.js";

const MENU_ID = "save-tab-group";
const NO_GROUP = chrome.tabGroups.TAB_GROUP_ID_NONE;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save tab group to bookmarks",
    contexts: ["page", "frame", "link", "selection", "image"],
    visible: false,
  });
  refreshMenu();
});

// Show the menu item only when the active tab is grouped, labeled with the group name.
async function refreshMenu() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || tab.groupId === NO_GROUP) {
      await chrome.contextMenus.update(MENU_ID, { visible: false });
      return;
    }
    const group = await chrome.tabGroups.get(tab.groupId);
    await chrome.contextMenus.update(MENU_ID, {
      visible: true,
      title: `Save tab group "${groupDisplayName(group)}"`,
    });
  } catch {
    // Menu may not exist yet (before onInstalled) or tab/group vanished; ignore.
  }
}

chrome.tabs.onActivated.addListener(refreshMenu);
chrome.windows.onFocusChanged.addListener(refreshMenu);
chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
  if ("groupId" in change && tab.active) refreshMenu();
});
chrome.tabGroups.onUpdated.addListener(refreshMenu);

async function saveForTab(tab) {
  if (!tab || tab.groupId === NO_GROUP) {
    flashBadge(tab?.id, "–", "#5f6368");
    return;
  }
  try {
    await saveGroupById(tab.groupId);
    flashBadge(tab.id, "✓", "#188038");
  } catch (err) {
    console.error("Failed to save group:", err);
    flashBadge(tab.id, "!", "#d93025");
  }
}

function flashBadge(tabId, text, color) {
  if (tabId == null) return;
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {}), 2000);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) saveForTab(tab);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "save-current-group") return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  saveForTab(tab);
});
