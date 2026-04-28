const authForm = document.getElementById("auth-form");
const authModeToggle = document.getElementById("auth-mode-toggle");
const authTitle = document.getElementById("auth-title");
const authSubmitButton = document.getElementById("auth-submit-button");
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const authStatusMessage = document.getElementById("auth-status-message");
const signOutButton = document.getElementById("sign-out-button");
const authCard = document.getElementById("auth-card");
const todoCard = document.getElementById("todo-card");
const userEmail = document.getElementById("user-email");
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const emptyMessage = document.getElementById("empty-message");
const todoStatusMessage = document.getElementById("todo-status-message");
const isFileProtocol = window.location.protocol === "file:";
const saveErrorMessage = "保存に失敗しました。しばらくしてから再試行してください。";
const submitButton = form.querySelector('button[type="submit"]');

let authMode = "sign-in";
let authClient = null;
let authToken = null;
let currentUser = null;
let isSubmitting = false;

function setStatus(message) {
  authStatusMessage.textContent = message;
  todoStatusMessage.textContent = message;
}

function setAuthMode(nextMode) {
  authMode = nextMode;
  const isSignInMode = nextMode === "sign-in";
  authTitle.textContent = isSignInMode ? "ログイン" : "新規登録";
  authSubmitButton.textContent = isSignInMode ? "ログイン" : "登録";
  authModeToggle.textContent = isSignInMode
    ? "アカウントがない場合は新規登録"
    : "アカウントがある場合はログイン";
}

async function fetchAppConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("failed to load config");
  }

  return response.json();
}

function getAuthHeaders() {
  if (!authToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${authToken}`
  };
}

async function createTask(taskText) {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
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
  const response = await fetch("/api/tasks", {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    throw new Error("failed to load tasks");
  }

  const tasks = await response.json();
  return Array.isArray(tasks) ? tasks : [];
}

async function updateTask(taskId, updates) {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error("failed to update task");
  }
}

async function deleteTask(taskId) {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    throw new Error("failed to delete task");
  }
}

function clearTasks() {
  list.replaceChildren();
  updateEmptyState();
}

function updateEmptyState() {
  emptyMessage.style.display = list.children.length === 0 ? "block" : "none";
}

function setSignedOutView() {
  currentUser = null;
  authToken = null;
  userEmail.textContent = "";
  todoCard.hidden = true;
  authCard.hidden = false;
  authPasswordInput.autocomplete = authMode === "sign-in" ? "current-password" : "new-password";
  clearTasks();
}

function setSignedInView(user, accessToken) {
  currentUser = user;
  authToken = accessToken;
  userEmail.textContent = user.email || "";
  authCard.hidden = true;
  todoCard.hidden = false;
}

async function refreshTaskList() {
  clearTasks();
  const tasks = await loadTasks();

  for (const task of tasks) {
    renderTask(task);
  }

  updateEmptyState();
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

authModeToggle.addEventListener("click", () => {
  setStatus("");
  setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in");
  authPasswordInput.autocomplete = authMode === "sign-in" ? "current-password" : "new-password";
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!authClient) {
    return;
  }

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || !password) {
    setStatus("メールアドレスとパスワードを入力してください。");
    return;
  }

  authSubmitButton.disabled = true;
  authSubmitButton.textContent = authMode === "sign-in" ? "ログイン中..." : "登録中...";

  try {
    if (authMode === "sign-up") {
      const { data, error } = await authClient.auth.signUp({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setSignedInView(data.user, data.session.access_token);
        await refreshTaskList();
        setStatus("新規登録してログインしました。");
      } else {
        setAuthMode("sign-in");
        authPasswordInput.value = "";
        setStatus("確認メールを送信しました。メール内のリンクを開いてからログインしてください。");
      }
    } else {
      const { data, error } = await authClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      setSignedInView(data.user, data.session.access_token);
      await refreshTaskList();
      setStatus("ログインしました。");
    }
  } catch (error) {
    setStatus(error.message || "認証に失敗しました。");
  } finally {
    authSubmitButton.disabled = false;
    authSubmitButton.textContent = authMode === "sign-in" ? "ログイン" : "登録";
  }
});

signOutButton.addEventListener("click", async () => {
  if (!authClient) {
    return;
  }

  await authClient.auth.signOut();
  setSignedOutView();
  setStatus("ログアウトしました。");
});

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

async function initializeAuth() {
  if (isFileProtocol) {
    setStatus("このアプリはサーバー経由で起動してください。");
    return;
  }

  const appConfig = await fetchAppConfig();

  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    throw new Error("Supabase Auth の設定が不足しています。");
  }

  const { createClient } = window.supabase;
  authClient = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey);

  const { data } = await authClient.auth.getSession();
  const session = data.session;

  if (session) {
    setSignedInView(session.user, session.access_token);
    await refreshTaskList();
    setStatus("ログイン済みです。");
  } else {
    setSignedOutView();
    setStatus("ログインしてください。");
  }

  authClient.auth.onAuthStateChange(async (event, sessionData) => {
    if (event === "SIGNED_OUT") {
      setSignedOutView();
      return;
    }

    if (sessionData) {
      setSignedInView(sessionData.user, sessionData.access_token);
      await refreshTaskList();
    }
  });
}

async function initialize() {
  try {
    setSignedOutView();
    await initializeAuth();
  } catch {
    setStatus("初期化に失敗しました。環境変数と Supabase 設定を確認してください。");
  }
}

setAuthMode("sign-in");
initialize();
