const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const INDEX_FILE = path.join(__dirname, "index.html");
const SCRIPT_FILE = path.join(__dirname, "app.js");
const STYLE_FILE = path.join(__dirname, "styles.css");
const TASKS_FILE = process.env.TASKS_FILE
  ? path.resolve(process.env.TASKS_FILE)
  : path.join(__dirname, "tasks.json");

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

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const taskIdMatch = requestUrl.pathname.match(/^\/api\/tasks\/([^/]+)$/);

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
    sendJson(response, 200, readTasks());
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/tasks") {
    readJsonBody(request)
      .then((body) => {
        if (typeof body.text !== "string" || !body.text.trim()) {
          sendJson(response, 400, { error: "Task text is required." });
          return;
        }

        const tasks = readTasks();
        const task = {
          id: createTaskId(),
          text: body.text.trim(),
          completed: Boolean(body.completed)
        };

        tasks.push(task);
        writeTasks(tasks);
        sendJson(response, 201, task);
      })
      .catch(() => {
        sendJson(response, 400, { error: "Invalid JSON payload." });
      });

    return;
  }

  if (request.method === "GET" && taskIdMatch) {
    const tasks = readTasks();
    const task = tasks.find((item) => item.id === taskIdMatch[1]);

    if (!task) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }

    sendJson(response, 200, task);
    return;
  }

  if (request.method === "PATCH" && taskIdMatch) {
    readJsonBody(request)
      .then((body) => {
        const tasks = readTasks();
        const task = tasks.find((item) => item.id === taskIdMatch[1]);

        if (!task) {
          sendJson(response, 404, { error: "Task not found." });
          return;
        }

        if ("text" in body) {
          if (typeof body.text !== "string" || !body.text.trim()) {
            sendJson(response, 400, { error: "Task text must be a non-empty string." });
            return;
          }
          task.text = body.text.trim();
        }

        if ("completed" in body) {
          task.completed = Boolean(body.completed);
        }

        writeTasks(tasks);
        sendJson(response, 200, task);
      })
      .catch(() => {
        sendJson(response, 400, { error: "Invalid JSON payload." });
      });

    return;
  }

  if (request.method === "DELETE" && taskIdMatch) {
    const tasks = readTasks();
    const nextTasks = tasks.filter((item) => item.id !== taskIdMatch[1]);

    if (nextTasks.length === tasks.length) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }

    writeTasks(nextTasks);
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`TODO app server running on ${HOST}:${PORT}`);
});
