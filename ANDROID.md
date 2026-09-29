# Bilal Efendi — Android Uygulaması

Mevcut web uygulaması hiç değiştirilmeden Capacitor ile Android'e paketlenir.
Uygulama açıldığında mevcut ana sayfa yüklenir; giriş ve tüm özellikler aynı çalışır.

## Kurulum (kendi bilgisayarında, bir kez)

Gerekenler: Node.js, Android Studio.

```bash
git clone <repo> && cd <repo>
npm install
npm install -D @capacitor/cli @capacitor/core @capacitor/android
npx cap add android
npx cap sync android
npx cap open android   # Android Studio açılır → Run veya Build > APK
```

## Notlar

- Siteyi yayınladıktan sonra `capacitor.config.ts` içindeki `url` değerini yayın adresiyle değiştirip `npx cap sync android` çalıştır.
- Web sitesinde yapılan her güncelleme uygulamaya otomatik yansır; yeniden paketlemek gerekmez.
- Google, bazı cihazlarda uygulama içi tarayıcıdan girişi engelleyebilir. Böyle olursa haber ver, harici tarayıcıyla giriş eklenir.
