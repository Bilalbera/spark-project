# Bilal Efendi — Windows (PC) Uygulaması

Uygulama, projenin kendi üretim derlemesini bilgisayarda yerel olarak çalıştırır
(lovable.app adresini açmaz, yayın rozeti görünmez). Veriler ve giriş uzak
serviste kalır.

## Gerekenler
- Windows 10/11
- Node.js (LTS)

## İlk kurulum (proje klasöründe, PowerShell)
```powershell
npm install
npm install --save-dev electron electron-builder
```

## Geliştirme
```powershell
npm run pc:start
```

## Kurulum dosyası (.exe)
```powershell
npm run pc:build
```
Sonuç: `dist/Bilal Efendi Setup.exe`

## Google ile giriş
Masaüstünde Google girişi küçük bir pencerede açılır ve tamamlanınca uygulamaya
geri döner. Bunun çalışması için Google girişinin Lovable Cloud'da açık olması
gerekir: Cloud → Users → Authentication → Google.
