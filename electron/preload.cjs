// Masaüstü uygulamasının küçük, güvenli köprüsü. Sayfaya Node erişimi verilmez.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("bilalEfendiDesktop", {
  isDesktop: true,
  platform: process.platform,
});
