import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { load } from "@tauri-apps/plugin-store";

const STORE_KEY = "snippets";
const MAX_SNIPPETS = 200;
const MAX_TEXT_LENGTH = 10000;
const TOAST_DURATION = 1200;
const COPIED_DURATION = 800;

let store;
let snippets = [];
let activeConfirm = null;
let activeEdit = null;
let busy = false;

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
const binIconTemplate = document.getElementById("bin-icon-template");

function pickNextColor() {
  const used = new Set(snippets.map((s) => s.color));
  const available = COLORS.filter((c) => !used.has(c));
  if (available.length === 0) {
    currentColorIndex = Math.floor(Math.random() * COLORS.length);
  } else {
    const pick = available[Math.floor(Math.random() * available.length)];
    currentColorIndex = COLORS.indexOf(pick);
  }
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
    if (!text || !text.trim()) return null;
    const color =
      typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color)
        ? s.color
        : COLORS[0];
    return { text: text.trim(), color };
  }
  if (s != null) {
    return { text: String(s), color: COLORS[0] };
  }
  return null;
}

function createEmptyState(message) {
  const el = document.createElement("div");
  el.className = "empty-state";
  el.textContent = message;
  return el;
}

async function init() {
  try {
    store = await load("snippets.json", { autoSave: true });
    const saved = await store.get(STORE_KEY);
    if (Array.isArray(saved) && saved.length > 0) {
      snippets = saved.map(sanitizeSnippet).filter(Boolean);
    }
    pickNextColor();
    render();
  } catch (err) {
    snippetList.replaceChildren(
      createEmptyState("Erreur au chargement des données. Redémarrez l'application.")
    );
    console.error("init error:", err);
  }
}

function render() {
  snippetList.replaceChildren();

  if (snippets.length === 0) {
    snippetList.appendChild(
      createEmptyState("Aucun texte enregistré. Ajoutez-en un ci-dessus !")
    );
    return;
  }

  snippets.forEach((snippet) => {
    const el = document.createElement("div");
    el.className = "snippet";
    el.title = "Clic gauche : copier · Clic droit : modifier";

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
    deleteBtn.title = "Supprimer";
    deleteBtn.appendChild(binIconTemplate.content.cloneNode(true));
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showConfirm(snippet, actions);
    });

    actions.appendChild(deleteBtn);
    el.addEventListener("click", () => copySnippet(snippet.text, el));
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startEdit(snippet, el, textEl);
    });
    el.appendChild(colorBar);
    el.appendChild(textEl);
    el.appendChild(actions);
    snippetList.appendChild(el);
  });
}

function showConfirm(snippet, actionsEl) {
  cancelConfirm();

  const deleteBtn = actionsEl.querySelector(".delete-btn");
  deleteBtn.classList.add("d-none");

  const confirmWrap = document.createElement("div");
  confirmWrap.className = "confirm-wrap";

  const yesBtn = document.createElement("button");
  yesBtn.className = "confirm-yes";
  yesBtn.textContent = "\u2713";
  yesBtn.title = "Confirmer";
  yesBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeSnippet(snippet);
  });

  const noBtn = document.createElement("button");
  noBtn.className = "confirm-no";
  noBtn.textContent = "\u2717";
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
  activeConfirm.deleteBtn.classList.remove("d-none");
  activeConfirm.confirmWrap.remove();
  activeConfirm = null;
}

function startEdit(snippet, snippetEl, textEl) {
  if (busy) return;
  cancelConfirm();
  cancelEdit();

  const textarea = document.createElement("textarea");
  textarea.className = "edit-input";
  textarea.value = snippet.text;
  textarea.rows = 2;

  textEl.classList.add("d-none");
  snippetEl.insertBefore(textarea, textEl);
  snippetEl.classList.add("editing");
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  let finished = false;
  const finish = async (save) => {
    if (finished) return;
    finished = true;
    if (save) {
      const newText = textarea.value.trim();
      if (newText && newText !== snippet.text) {
        snippet.text = newText.slice(0, MAX_TEXT_LENGTH);
        await saveSnippets();
      }
    }
    textarea.remove();
    textEl.classList.remove("d-none");
    textEl.textContent = snippet.text;
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
  if (busy) return;
  const text = snippetInput.value.trim();
  if (!text) return;
  if (snippets.length >= MAX_SNIPPETS) {
    showToast(`Maximum ${MAX_SNIPPETS} textes atteint`);
    return;
  }

  busy = true;
  try {
    snippets.unshift({ text: text.slice(0, MAX_TEXT_LENGTH), color: COLORS[currentColorIndex] });
    await saveSnippets();
    snippetInput.value = "";
    pickNextColor();
    render();
  } catch (err) {
    snippets.shift();
    showToast("Erreur lors de la sauvegarde");
    console.error("addSnippet error:", err);
  } finally {
    busy = false;
  }
}

async function removeSnippet(snippet) {
  if (busy) return;
  busy = true;
  activeConfirm = null;
  const index = snippets.indexOf(snippet);
  if (index < 0) {
    busy = false;
    return;
  }
  snippets.splice(index, 1);
  try {
    await saveSnippets();
    pickNextColor();
    render();
  } catch (err) {
    snippets.splice(index, 0, snippet);
    showToast("Erreur lors de la suppression");
    console.error("removeSnippet error:", err);
    render();
  } finally {
    busy = false;
  }
}

async function copySnippet(text, el) {
  try {
    await writeText(text);
    el.classList.add("copied");
    showToast("Copié !");
    setTimeout(() => el.classList.remove("copied"), COPIED_DURATION);
  } catch (err) {
    showToast("Erreur de copie");
    console.error("copySnippet error:", err);
  }
}

async function saveSnippets() {
  await store.set(STORE_KEY, snippets);
  await store.save();
}

let toastTimeout;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add("hidden"), TOAST_DURATION);
}

colorPicker.addEventListener("click", (e) => {
  e.preventDefault();
  pickNextColor();
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
    cancelEdit();
  }
});

init();
