export const DEFAULT_PARENT_ID = "2"; // Other Bookmarks

export async function getSavedParentId() {
  const { parentId } = await chrome.storage.sync.get({ parentId: DEFAULT_PARENT_ID });
  return parentId;
}

export function groupDisplayName(group) {
  return group.title || `Unnamed (${group.color})`;
}

export async function saveGroup(group, tabs) {
  const parentId = await getSavedParentId();
  const folderName = groupDisplayName(group);

  // Find existing folder with same name under the target, or create new one
  const children = await chrome.bookmarks.getChildren(parentId);
  let folder = children.find((c) => !c.url && c.title === folderName);

  // Track URLs already in the folder so re-saving appends without duplicates
  const existingUrls = new Set();
  if (folder) {
    const existing = await chrome.bookmarks.getChildren(folder.id);
    for (const bm of existing) {
      if (bm.url) existingUrls.add(bm.url);
    }
  } else {
    folder = await chrome.bookmarks.create({
      parentId,
      title: folderName,
    });
  }

  // Add each tab as a bookmark, skipping non-bookmarkable and already-saved URLs
  for (const tab of tabs) {
    try {
      if (tab.url && /^https?:\/\//.test(tab.url) && !existingUrls.has(tab.url)) {
        existingUrls.add(tab.url);
        await chrome.bookmarks.create({
          parentId: folder.id,
          title: tab.title || tab.url,
          url: tab.url,
        });
      }
    } catch (err) {
      console.warn("Skipped tab:", tab.url, err);
    }
  }

  return tabs.length;
}

export async function saveGroupById(groupId) {
  const group = await chrome.tabGroups.get(groupId);
  const tabs = await chrome.tabs.query({ groupId });
  await saveGroup(group, tabs);
  return group;
}
