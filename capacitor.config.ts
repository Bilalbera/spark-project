// Android paketi için Capacitor ayarı. Uygulama, mevcut Bilal Efendi web sitesini
// doğrudan açar; böylece sayfalar, giriş ve veriler web ile birebir aynı kalır.
// Yayınladıktan sonra "url" değerini yayınlanan adresle değiştir.
const config = {
  appId: "app.bilalefendi.android",
  appName: "Bilal Efendi",
  webDir: "public",
  server: {
    url: "https://id-preview--2e6ef5cf-bbcd-4c7e-b68f-9e7bdb89ab8d.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#0a0a0a",
  },
};

export default config;
