import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { load } from "@tauri-apps/plugin-store";

const STORE_KEY = "snippets";
let store;
let snippets = [];
let activeConfirm = null;
let activeEdit = null;

const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a78bfa", "#c084fc", "#d946ef",
  "#ec4899", "#f43f5e", "#fb7185", "#fda4af",
  "#fdba74", "#fcd34d", "#bef264", "#86efac",
  "#6ee7b7", "#5eead4", "#67e8f9", "#7dd3fc",
  "#93c5fd", "#a5b4fc", "#c4b5fd", "#d8b4fe",
];

let currentColorIndex = 0;

const snippetList = document.getElementById("snippet-list");
const snippetInput = document.getElementById("snippet-input");
const addBtn = document.getElementById("add-btn");
const toast = document.getElementById("toast");
const colorPicker = document.getElementById("color-picker");

function getUsedColors() {
  return new Set(snippets.map((s) => s.color));
}

function randomUnusedColor() {
  const used = getUsedColors();
  const available = COLORS.filter((c) => !used.has(c));
  if (available.length === 0) {
    currentColorIndex = Math.floor(Math.random() * COLORS.length);
  } else {
    const pick = available[Math.floor(Math.random() * available.length)];
    currentColorIndex = COLORS.indexOf(pick);
  }
  return COLORS[currentColorIndex];
}

function cycleColor() {
  randomUnusedColor();
  updateColorPicker();
}

function updateColorPicker() {
  colorPicker.style.background = COLORS[currentColorIndex];
}

function sanitizeSnippet(s) {
  if (typeof s === "string") {
    return { text: s, color: COLORS[0] };
  }
  if (s && typeof s === "object" && !Array.isArray(s)) {
    const text =
      typeof s.text === "string"
        ? s.text
        : s.text != null
          ? String(s.text)
          : null;
    if (!text) return null;
    const color =
      typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color)
        ? s.color
        : COLORS[0];
    return { text, color };
  }
  if (s != null) {
    return { text: String(s), color: COLORS[0] };
  }
  return null;
}

async function init() {
  store = await load("snippets.json", { autoSave: true });
  const saved = await store.get(STORE_KEY);
  if (Array.isArray(saved) && saved.length > 0) {
    snippets = saved.map(sanitizeSnippet).filter(Boolean);
  }
  randomUnusedColor();
  updateColorPicker();
  render();
}

function render() {
  snippetList.innerHTML = "";

  if (snippets.length === 0) {
    snippetList.innerHTML =
      '<div class="empty-state">Aucun texte enregistré.<br>Ajoutez-en un ci-dessus !</div>';
    return;
  }

  snippets.forEach((snippet, index) => {
    const el = document.createElement("div");
    el.className = "snippet";

    const colorBar = document.createElement("div");
    colorBar.className = "snippet-color";
    colorBar.style.background = snippet.color;

    const textEl = document.createElement("span");
    textEl.className = "snippet-text";
    textEl.textContent = snippet.text;

    const actions = document.createElement("div");
    actions.className = "snippet-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = `<img src="${new URL("./bin.png", import.meta.url).href}" alt="Supprimer" class="bin-icon">`;
    deleteBtn.title = "Supprimer";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showConfirm(index, actions);
    });

    actions.appendChild(deleteBtn);
    el.addEventListener("click", () => copySnippet(snippet.text, el));
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startEdit(index, el, textEl);
    });
    el.appendChild(colorBar);
    el.appendChild(textEl);
    el.appendChild(actions);
    snippetList.appendChild(el);
  });
}

function showConfirm(index, actionsEl) {
  cancelConfirm();

  const deleteBtn = actionsEl.querySelector(".delete-btn");
  deleteBtn.style.display = "none";

  const confirmWrap = document.createElement("div");
  confirmWrap.className = "confirm-wrap";

  const yesBtn = document.createElement("button");
  yesBtn.className = "confirm-yes";
  yesBtn.innerHTML = "&#10003;";
  yesBtn.title = "Confirmer";
  yesBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeSnippet(index);
  });

  const noBtn = document.createElement("button");
  noBtn.className = "confirm-no";
  noBtn.innerHTML = "&#10007;";
  noBtn.title = "Annuler";
  noBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    cancelConfirm();
  });

  confirmWrap.appendChild(yesBtn);
  confirmWrap.appendChild(noBtn);
  actionsEl.appendChild(confirmWrap);

  activeConfirm = { actionsEl, deleteBtn, confirmWrap };
}

function cancelConfirm() {
  if (!activeConfirm) return;
  activeConfirm.deleteBtn.style.display = "";
  activeConfirm.confirmWrap.remove();
  activeConfirm = null;
}

function startEdit(index, snippetEl, textEl) {
  cancelConfirm();
  cancelEdit();

  const textarea = document.createElement("textarea");
  textarea.className = "edit-input";
  textarea.value = snippets[index].text;
  textarea.rows = 2;

  textEl.style.display = "none";
  snippetEl.insertBefore(textarea, textEl);
  snippetEl.classList.add("editing");
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  const finish = async (save) => {
    if (save) {
      const newText = textarea.value.trim();
      if (newText && newText !== snippets[index].text) {
        snippets[index].text = newText;
        await saveSnippets();
      }
    }
    textarea.remove();
    textEl.style.display = "";
    textEl.textContent = snippets[index].text;
    snippetEl.classList.remove("editing");
    activeEdit = null;
  };

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      finish(true);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      finish(false);
    }
  });

  textarea.addEventListener("blur", () => finish(false));
  textarea.addEventListener("click", (e) => e.stopPropagation());

  activeEdit = { textarea, finish };
}

function cancelEdit() {
  if (!activeEdit) return;
  activeEdit.finish(false);
}

async function addSnippet() {
  const text = snippetInput.value.trim();
  if (!text) return;

  snippets.unshift({ text, color: COLORS[currentColorIndex] });
  await saveSnippets();
  snippetInput.value = "";
  randomUnusedColor();
  updateColorPicker();
  render();
}

async function removeSnippet(index) {
  activeConfirm = null;
  snippets.splice(index, 1);
  await saveSnippets();
  randomUnusedColor();
  updateColorPicker();
  render();
}

async function copySnippet(text, el) {
  await writeText(text);
  el.classList.add("copied");
  showToast();
  setTimeout(() => el.classList.remove("copied"), 800);
}

async function saveSnippets() {
  await store.set(STORE_KEY, snippets);
}

let toastTimeout;
function showToast() {
  toast.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add("hidden"), 1200);
}

colorPicker.addEventListener("click", (e) => {
  e.preventDefault();
  cycleColor();
});

addBtn.addEventListener("click", addSnippet);

snippetInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    addSnippet();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cancelConfirm();
  }
});

init();
