// Bilal Efendi — Windows masaüstü uygulaması.
// Paketlenmiş sürüm, projenin kendi üretim derlemesini (.output) bilgisayarda
// yerel bir sunucuyla çalıştırır. Geliştirme sürümü (npm run pc:start) Vite
// geliştirme sunucusunu başlatıp onu açar. Veriler ve giriş uzak servisle sürer.
const { app, BrowserWindow, shell, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const PROD_PORT = 47823;
const DEV_PORT = 47824;
// Google girişinin geri döneceği, giriş servisinde tanımlı adres.
const AUTH_HOST = "https://bilalefendi-app.vercel.app/";
const AUTH_RETURN = AUTH_HOST + "/giris";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const ROOT = path.join(__dirname, "..");
let appUrl = "";
let devServer = null;
let mainWin = null;

function loadEnvFile() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function waitFor(url, timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http
        .get(url, (res) => { res.resume(); resolve(); })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error("Sunucu başlamadı: " + url));
          else setTimeout(tryOnce, 500);
        });
    };
    tryOnce();
  });
}

async function startProdServer() {
  process.env.PORT = process.env.NITRO_PORT = String(PROD_PORT);
  process.env.HOST = process.env.NITRO_HOST = "127.0.0.1";
  process.env.NODE_ENV = "production";
  const entry = path.join(ROOT, ".output", "server", "index.mjs");
  await import(pathToFileURL(entry).href);
  appUrl = `http://127.0.0.1:${PROD_PORT}`;
  await waitFor(appUrl + "/");
}

async function startDevServer() {
  devServer = spawn("npx", ["vite", "dev", "--port", String(DEV_PORT), "--strictPort", "--host", "127.0.0.1"], {
    cwd: ROOT,
    shell: true,
    stdio: "inherit",
  });
  appUrl = `http://127.0.0.1:${DEV_PORT}`;
  await waitFor(appUrl + "/");
}

// Google girişi: uygulama doğrudan giriş servisinin (Supabase) Google adresine
// gider. Bunu ayrı bir pencerede açar, dönüşte (yerel /giris adresine) gelen
// oturum bilgisini ana pencereye aktarırız.
function isSupabaseAuthorize(url) {
  return /\.supabase\.co\/auth\/v1\/authorize/.test(url);
}

function startGoogleLogin(authorizeUrl) {
  const returnPrefix = appUrl + "/giris";
  const authWin = new BrowserWindow({
    width: 520,
    height: 700,
    parent: mainWin,
    modal: true,
    title: "Google ile giriş",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: "oauth" },
  });
  authWin.webContents.setUserAgent(CHROME_UA);
  let done = false;
  const check = (event, url) => {
    if (done || !url.startsWith(returnPrefix)) return;
    done = true;
    if (event && event.preventDefault) event.preventDefault();
    authWin.close();
    mainWin.loadURL(url);
  };
  authWin.webContents.on("will-redirect", check);
  authWin.webContents.on("will-navigate", check);
  authWin.webContents.on("did-navigate", (e, url) => check(null, url));
  authWin.loadURL(authorizeUrl);
}

function isInternal(url) {
  return url.startsWith(appUrl);
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    title: "Bilal Efendi",
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWin.webContents.on("will-navigate", (event, url) => {
    if (isSupabaseAuthorize(url)) {
      event.preventDefault();
      startGoogleLogin(url);
      return;
    }
    if (!isInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (isSupabaseAuthorize(url)) {
      startGoogleLogin(url);
      return { action: "deny" };
    }
    if (!isInternal(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWin.loadURL(appUrl + "/");
}

app.whenReady().then(async () => {
  loadEnvFile();
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  try {
    if (app.isPackaged || process.env.BILAL_EFENDI_PROD === "1") await startProdServer();
    else await startDevServer();
  } catch (err) {
    console.error(err);
    app.quit();
    return;
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (devServer) devServer.kill();
  if (process.platform !== "darwin") app.quit();
});
