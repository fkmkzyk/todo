require("dotenv").config();

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const INDEX_FILE = path.join(__dirname, "index.html");
const SCRIPT_FILE = path.join(__dirname, "app.js");
const STYLE_FILE = path.join(__dirname, "styles.css");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_TASKS_TABLE = process.env.SUPABASE_TASKS_TABLE || "tasks";
const TASKS_FILE = process.env.TASKS_FILE
  ? path.resolve(process.env.TASKS_FILE)
  : path.join(__dirname, "tasks.json");
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

let supabaseClient = null;

function createTaskId() {
  return crypto.randomUUID();
}

function normalizeTask(task) {
  if (!task || typeof task.text !== "string") {
    return null;
  }

  return {
    id: typeof task.id === "string" && task.id ? task.id : createTaskId(),
    text: task.text,
    completed: Boolean(task.completed)
  };
}

function readTasks() {
  try {
    const raw = fs.readFileSync(TASKS_FILE, "utf8");
    const tasks = JSON.parse(raw);
    return Array.isArray(tasks) ? tasks.map(normalizeTask).filter(Boolean) : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function writeTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf8");
}

function getSupabaseClient() {
  if (!useSupabase) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseClient;
}

async function listTasks() {
  if (!useSupabase) {
    return readTasks();
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_TASKS_TABLE)
    .select("id, text, completed")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data.map(normalizeTask).filter(Boolean) : [];
}

async function getTaskById(taskId) {
  if (!useSupabase) {
    return readTasks().find((item) => item.id === taskId) || null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_TASKS_TABLE)
    .select("id, text, completed")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeTask(data);
}

async function createTask(taskInput) {
  if (!useSupabase) {
    const tasks = readTasks();
    const task = {
      id: createTaskId(),
      text: taskInput.text.trim(),
      completed: Boolean(taskInput.completed)
    };

    tasks.push(task);
    writeTasks(tasks);
    return task;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_TASKS_TABLE)
    .insert({
      text: taskInput.text.trim(),
      completed: Boolean(taskInput.completed)
    })
    .select("id, text, completed")
    .single();

  if (error) {
    throw error;
  }

  return normalizeTask(data);
}

async function updateTask(taskId, updates) {
  if (!useSupabase) {
    const tasks = readTasks();
    const task = tasks.find((item) => item.id === taskId);

    if (!task) {
      return null;
    }

    if ("text" in updates) {
      task.text = updates.text.trim();
    }

    if ("completed" in updates) {
      task.completed = Boolean(updates.completed);
    }

    writeTasks(tasks);
    return task;
  }

  const nextUpdates = {};

  if ("text" in updates) {
    nextUpdates.text = updates.text.trim();
  }

  if ("completed" in updates) {
    nextUpdates.completed = Boolean(updates.completed);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_TASKS_TABLE)
    .update(nextUpdates)
    .eq("id", taskId)
    .select("id, text, completed")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeTask(data);
}

async function deleteTaskById(taskId) {
  if (!useSupabase) {
    const tasks = readTasks();
    const nextTasks = tasks.filter((item) => item.id !== taskId);

    if (nextTasks.length === tasks.length) {
      return false;
    }

    writeTasks(nextTasks);
    return true;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_TASKS_TABLE)
    .delete()
    .eq("id", taskId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response) {
  const html = fs.readFileSync(INDEX_FILE, "utf8");
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(html);
}

function sendFile(response, filePath, contentType) {
  const content = fs.readFileSync(filePath, "utf8");
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(content);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });

    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const taskIdMatch = requestUrl.pathname.match(/^\/api\/tasks\/([^/]+)$/);

  try {
    if (request.method === "GET" && requestUrl.pathname === "/") {
      sendHtml(response);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/app.js") {
      sendFile(response, SCRIPT_FILE, "application/javascript; charset=utf-8");
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/styles.css") {
      sendFile(response, STYLE_FILE, "text/css; charset=utf-8");
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/tasks") {
      sendJson(response, 200, await listTasks());
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/tasks") {
      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendJson(response, 400, { error: "Invalid JSON payload." });
        return;
      }

      if (typeof body.text !== "string" || !body.text.trim()) {
        sendJson(response, 400, { error: "Task text is required." });
        return;
      }

      const task = await createTask(body);
      sendJson(response, 201, task);
      return;
    }

    if (request.method === "GET" && taskIdMatch) {
      const task = await getTaskById(taskIdMatch[1]);

      if (!task) {
        sendJson(response, 404, { error: "Task not found." });
        return;
      }

      sendJson(response, 200, task);
      return;
    }

    if (request.method === "PATCH" && taskIdMatch) {
      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendJson(response, 400, { error: "Invalid JSON payload." });
        return;
      }

      if ("text" in body && (typeof body.text !== "string" || !body.text.trim())) {
        sendJson(response, 400, { error: "Task text must be a non-empty string." });
        return;
      }

      const task = await updateTask(taskIdMatch[1], body);

      if (!task) {
        sendJson(response, 404, { error: "Task not found." });
        return;
      }

      sendJson(response, 200, task);
      return;
    }

    if (request.method === "DELETE" && taskIdMatch) {
      const deleted = await deleteTaskById(taskIdMatch[1]);

      if (!deleted) {
        sendJson(response, 404, { error: "Task not found." });
        return;
      }

      response.writeHead(204);
      response.end();
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`TODO app server running on ${HOST}:${PORT}`);
});
