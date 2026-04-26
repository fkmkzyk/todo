const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const emptyMessage = document.getElementById("empty-message");
const statusMessage = document.getElementById("status-message");
const isFileProtocol = window.location.protocol === "file:";
const saveErrorMessage = "保存に失敗しました。ローカルサーバーが起動しているか確認してください。";
const submitButton = form.querySelector('button[type="submit"]');
let isSubmitting = false;

function setStatus(message) {
  statusMessage.textContent = message;
}

async function createTask(taskText) {
  if (isFileProtocol) {
    return {
      id: `local-${Date.now()}`,
      text: taskText,
      completed: false
    };
  }

  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: taskText,
      completed: false
    })
  });

  if (!response.ok) {
    throw new Error("failed to create task");
  }

  return response.json();
}

async function loadTasks() {
  if (isFileProtocol) {
    return [];
  }

  const response = await fetch("/api/tasks");
  if (!response.ok) {
    throw new Error("failed to load tasks");
  }

  const tasks = await response.json();
  return Array.isArray(tasks) ? tasks : [];
}

async function updateTask(taskId, updates) {
  if (isFileProtocol) {
    return;
  }

  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error("failed to update task");
  }
}

async function deleteTask(taskId) {
  if (isFileProtocol) {
    return;
  }

  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("failed to delete task");
  }
}

function updateEmptyState() {
  emptyMessage.style.display = list.children.length === 0 ? "block" : "none";
}

function renderTask(task) {
  const item = document.createElement("li");
  item.dataset.taskId = task.id;

  const taskMain = document.createElement("div");
  taskMain.className = "task-main";

  const actionGroup = document.createElement("div");
  actionGroup.className = "task-actions";

  const checkbox = document.createElement("input");
  checkbox.className = "task-check";
  checkbox.type = "checkbox";

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;

  const editInput = document.createElement("input");
  editInput.className = "task-edit-input";
  editInput.type = "text";
  editInput.value = task.text;
  editInput.hidden = true;

  const loadingMessage = document.createElement("span");
  loadingMessage.className = "task-loading";
  loadingMessage.textContent = "保存中...";
  loadingMessage.hidden = true;

  let isSaving = false;
  let isComposingText = false;

  function setSaveButtonLoadingState(isLoading) {
    saveButton.textContent = isLoading ? "保存中..." : "保存";
    saveButton.disabled = isLoading;
  }

  function setSavingState(nextSavingState) {
    isSaving = nextSavingState;
    item.classList.toggle("saving", nextSavingState);
    loadingMessage.hidden = !nextSavingState;
    checkbox.disabled = nextSavingState;
    editInput.disabled = nextSavingState;
    editButton.disabled = nextSavingState;
    saveButton.disabled = nextSavingState;
    cancelButton.disabled = nextSavingState;
    deleteButton.disabled = nextSavingState;
  }

  function setEditingState(isEditing) {
    item.classList.toggle("editing", isEditing);
    text.hidden = isEditing;
    editInput.hidden = !isEditing;
    editButton.hidden = isEditing;
    saveButton.hidden = !isEditing;
    cancelButton.hidden = !isEditing;

    if (isEditing) {
      editInput.value = text.textContent;
      editInput.focus();
      editInput.select();
    }
  }

  async function saveTaskText() {
    if (isSaving) {
      return;
    }

    const nextText = editInput.value.trim();
    if (!nextText) {
      editInput.value = text.textContent;
      setEditingState(false);
      return;
    }

    if (nextText === text.textContent) {
      setEditingState(false);
      return;
    }

    try {
      setSaveButtonLoadingState(true);
      setSavingState(true);
      await updateTask(task.id, { text: nextText });
      text.textContent = nextText;
      task.text = nextText;
      setEditingState(false);
    } catch {
      editInput.value = text.textContent;
      setStatus(saveErrorMessage);
    } finally {
      setSavingState(false);
      setSaveButtonLoadingState(false);
    }
  }

  checkbox.addEventListener("change", async () => {
    if (isSaving) {
      return;
    }

    item.classList.toggle("completed", checkbox.checked);
    try {
      setSavingState(true);
      await updateTask(task.id, { completed: checkbox.checked });
    } catch {
      checkbox.checked = !checkbox.checked;
      item.classList.toggle("completed", checkbox.checked);
      setStatus(saveErrorMessage);
    } finally {
      setSavingState(false);
    }
  });

  const editButton = document.createElement("button");
  editButton.className = "edit-button";
  editButton.type = "button";
  editButton.textContent = "編集";
  editButton.addEventListener("click", () => {
    if (isSaving) {
      return;
    }

    setEditingState(true);
  });

  const saveButton = document.createElement("button");
  saveButton.className = "save-button";
  saveButton.type = "button";
  saveButton.textContent = "保存";
  saveButton.hidden = true;
  saveButton.addEventListener("click", async () => {
    await saveTaskText();
  });

  const cancelButton = document.createElement("button");
  cancelButton.className = "cancel-button";
  cancelButton.type = "button";
  cancelButton.textContent = "キャンセル";
  cancelButton.hidden = true;
  cancelButton.addEventListener("click", () => {
    if (isSaving) {
      return;
    }

    editInput.value = text.textContent;
    setEditingState(false);
  });

  editInput.addEventListener("compositionstart", () => {
    isComposingText = true;
  });

  editInput.addEventListener("compositionend", () => {
    isComposingText = false;
  });

  editInput.addEventListener("keydown", async (event) => {
    if (event.isComposing || isComposingText) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      await saveTaskText();
    }

    if (event.key === "Escape") {
      editInput.value = text.textContent;
      setEditingState(false);
    }
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "削除";
  deleteButton.addEventListener("click", async () => {
    if (isSaving) {
      return;
    }

    try {
      setSavingState(true);
      await deleteTask(task.id);
      item.remove();
      updateEmptyState();
    } catch {
      setStatus(saveErrorMessage);
      setSavingState(false);
    }
  });

  checkbox.checked = task.completed;
  item.classList.toggle("completed", task.completed);
  taskMain.append(checkbox, text, editInput, loadingMessage);
  actionGroup.append(editButton, saveButton, cancelButton, deleteButton);
  item.append(taskMain, actionGroup);
  list.appendChild(item);
  updateEmptyState();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  const taskText = input.value.trim();
  if (!taskText) {
    input.focus();
    return;
  }

  try {
    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "追加中...";
    const task = await createTask(taskText);
    renderTask(task);
    input.value = "";
    input.focus();
  } catch {
    setStatus(saveErrorMessage);
  } finally {
    isSubmitting = false;
    submitButton.disabled = false;
    submitButton.textContent = "追加";
  }
});

async function initialize() {
  if (isFileProtocol) {
    setStatus("共有して使うには `npm start` または `node server.js` で起動してください。");
    updateEmptyState();
    return;
  }

  setStatus("サーバーに保存中。このURLを別ブラウザや別端末で開いても同じタスクが表示されます。");

  try {
    const tasks = await loadTasks();
    for (const task of tasks) {
      renderTask(task);
    }
  } catch {
    setStatus("保存データの読み込みに失敗しました。サーバーが稼働しているか確認してください。");
  }

  updateEmptyState();
}

initialize();
