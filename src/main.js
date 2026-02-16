import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { load } from "@tauri-apps/plugin-store";

const STORE_KEY = "snippets";
let store;
let snippets = [];
let activeConfirm = null;

const snippetList = document.getElementById("snippet-list");
const snippetInput = document.getElementById("snippet-input");
const addBtn = document.getElementById("add-btn");
const toast = document.getElementById("toast");

async function init() {
  store = await load("snippets.json", { autoSave: true });
  const saved = await store.get(STORE_KEY);
  if (Array.isArray(saved)) {
    snippets = saved;
  }
  render();
}

function render() {
  snippetList.innerHTML = "";

  if (snippets.length === 0) {
    snippetList.innerHTML = '<div class="empty-state">Aucun texte enregistré.<br>Ajoutez-en un ci-dessus !</div>';
    return;
  }

  snippets.forEach((text, index) => {
    const el = document.createElement("div");
    el.className = "snippet";

    const textEl = document.createElement("span");
    textEl.className = "snippet-text";
    textEl.textContent = text;

    const actions = document.createElement("div");
    actions.className = "snippet-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "&#128465;";
    deleteBtn.title = "Supprimer";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showConfirm(index, actions);
    });

    actions.appendChild(deleteBtn);
    el.addEventListener("click", () => copySnippet(text, el));
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startEdit(index, el, textEl);
    });
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
  textarea.value = snippets[index];
  textarea.rows = 2;

  textEl.style.display = "none";
  snippetEl.insertBefore(textarea, textEl);
  snippetEl.classList.add("editing");
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  const finish = async (save) => {
    if (save) {
      const newText = textarea.value.trim();
      if (newText && newText !== snippets[index]) {
        snippets[index] = newText;
        await saveSnippets();
      }
    }
    textarea.remove();
    textEl.style.display = "";
    textEl.textContent = snippets[index];
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

let activeEdit = null;

function cancelEdit() {
  if (!activeEdit) return;
  activeEdit.finish(false);
}

async function addSnippet() {
  const text = snippetInput.value.trim();
  if (!text) return;

  snippets.unshift(text);
  await saveSnippets();
  snippetInput.value = "";
  render();
}

async function removeSnippet(index) {
  activeConfirm = null;
  snippets.splice(index, 1);
  await saveSnippets();
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
