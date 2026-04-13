const COLOR_MAP = {
  grey: "#5f6368",
  blue: "#1a73e8",
  red: "#d93025",
  yellow: "#f9ab00",
  green: "#188038",
  pink: "#d01884",
  purple: "#a142f4",
  cyan: "#007b83",
  orange: "#e8710a",
};

const BOOKMARK_ROOT_NAME = "Tab Groups";
const DEFAULT_PARENT_ID = "2"; // Other Bookmarks

async function getSavedParentId() {
  const { parentId } = await chrome.storage.sync.get({ parentId: DEFAULT_PARENT_ID });
  return parentId;
}

async function getOrCreateRootFolder() {
  const parentId = await getSavedParentId();
  const results = await chrome.bookmarks.search({ title: BOOKMARK_ROOT_NAME });
  const existing = results.find((b) => !b.url && b.parentId === parentId);
  if (existing) return existing;

  return chrome.bookmarks.create({ parentId, title: BOOKMARK_ROOT_NAME });
}

async function saveGroup(group, tabs) {
  const root = await getOrCreateRootFolder();
  const folderName = group.title || `Unnamed (${group.color})`;

  // Find existing folder with same name under root, or create new one
  const children = await chrome.bookmarks.getChildren(root.id);
  let folder = children.find((c) => !c.url && c.title === folderName);

  if (folder) {
    // Clear existing bookmarks in this folder before re-saving
    const existing = await chrome.bookmarks.getChildren(folder.id);
    for (const bm of existing) {
      await chrome.bookmarks.removeTree(bm.id);
    }
  } else {
    folder = await chrome.bookmarks.create({
      parentId: root.id,
      title: folderName,
    });
  }

  // Add each tab as a bookmark, skipping non-bookmarkable URLs
  for (const tab of tabs) {
    try {
      if (tab.url && /^https?:\/\//.test(tab.url)) {
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

async function loadGroups() {
  const currentWindow = await chrome.windows.getCurrent();
  const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
  const allTabs = await chrome.tabs.query({ windowId: currentWindow.id });

  const groupsContainer = document.getElementById("groups");
  const emptyMsg = document.getElementById("empty");

  if (groups.length === 0) {
    emptyMsg.style.display = "block";
    document.getElementById("save-all").disabled = true;
    return;
  }

  emptyMsg.style.display = "none";

  const groupData = groups.map((g) => ({
    group: g,
    tabs: allTabs.filter((t) => t.groupId === g.id),
  }));

  for (const { group, tabs } of groupData) {
    const row = document.createElement("div");
    row.className = "group-row";

    const displayName = group.title || `Unnamed (${group.color})`;

    row.innerHTML = `
      <div class="group-info">
        <span class="group-dot" style="background:${COLOR_MAP[group.color] || "#5f6368"}"></span>
        <span class="group-name" title="${displayName}">${displayName}</span>
      </div>
      <span class="group-count">${tabs.length} tab${tabs.length !== 1 ? "s" : ""}</span>
      <button class="save-btn">Save</button>
    `;

    const btn = row.querySelector(".save-btn");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Saving...";
      try {
        await saveGroup(group, tabs);
        btn.textContent = "Saved";
        btn.classList.add("saved");
      } catch (err) {
        btn.textContent = "Error";
        console.error("Failed to save group:", err);
      }
    });

    groupsContainer.appendChild(row);
  }

  // Save All button
  document.getElementById("save-all").addEventListener("click", async () => {
    const saveAllBtn = document.getElementById("save-all");
    const buttons = groupsContainer.querySelectorAll(".save-btn");

    saveAllBtn.disabled = true;
    saveAllBtn.textContent = "Saving...";
    buttons.forEach((b) => (b.disabled = true));

    let saved = 0;
    for (const { group, tabs } of groupData) {
      try {
        await saveGroup(group, tabs);
        saved++;
      } catch (err) {
        console.error("Failed to save group:", group.title, err);
      }
    }

    buttons.forEach((b) => {
      b.textContent = "Saved";
      b.classList.add("saved");
    });

    saveAllBtn.textContent = "All Saved";
    showStatus(`Saved ${saved} group${saved !== 1 ? "s" : ""} to bookmarks.`);
  });
}

function showStatus(msg) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 3000);
}

async function initLocationPicker() {
  const select = document.getElementById("location");
  const tree = await chrome.bookmarks.getTree();

  function addFolders(nodes, depth) {
    for (const node of nodes) {
      if (node.url) continue; // skip bookmarks, only show folders
      const opt = document.createElement("option");
      opt.value = node.id;
      const indent = "\u00A0\u00A0".repeat(depth); // non-breaking spaces for nesting
      opt.textContent = indent + (node.title || "Bookmarks Bar");
      select.appendChild(opt);
      if (node.children) {
        addFolders(node.children, depth + 1);
      }
    }
  }

  // Start from the top-level folders (skip the invisible root node)
  addFolders(tree[0].children, 0);

  // Set saved selection
  const savedId = await getSavedParentId();
  select.value = savedId;

  select.addEventListener("change", async () => {
    await chrome.storage.sync.set({ parentId: select.value });
  });
}

initLocationPicker();
loadGroups();
