// Bilal Efendi masaüstü uygulaması (Windows PC).
// Uygulama, mevcut web sitesini doğrudan açar; sayfalar, giriş ve veriler
// web ile birebir aynı kalır. Yayınladıktan sonra APP_URL değerini
// yayınlanan adresle değiştir.
const { app, BrowserWindow, shell } = require("electron");

const APP_URL =
  process.env.BILAL_EFENDI_URL ||
  "https://bilal-efendi.lovable.app/";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    title: "Bilal Efendi",
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(APP_URL);

  // Uygulama dışı bağlantıları normal tarayıcıda aç.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
