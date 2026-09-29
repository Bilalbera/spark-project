# Bilal Efendi — Windows (PC) Uygulaması

Bu klasördeki `electron/main.cjs` dosyası, mevcut Bilal Efendi web sitesini
açan bir Windows masaüstü uygulaması oluşturur. Sitede yaptığınız her
değişiklik uygulamada otomatik görünür; uygulamayı yeniden derlemeniz gerekmez.

## Gerekenler

- Windows bilgisayar
- [Node.js](https://nodejs.org) (LTS sürümü)

## Kurulum ve çalıştırma

Proje klasöründe bir terminal (PowerShell) açın:

```powershell
npm install --save-dev electron electron-builder
npx electron electron/main.cjs
```

Uygulama penceresi açılır ve siteyi gösterir.

## Kurulum dosyası (.exe) üretme

`package.json` içine şunu ekleyin:

```json
"main": "electron/main.cjs",
"scripts": {
  "pc:start": "electron .",
  "pc:build": "electron-builder --win"
},
"build": {
  "appId": "app.bilalefendi.pc",
  "productName": "Bilal Efendi",
  "win": { "target": "nsis" }
}
```

Sonra:

```powershell
npm run pc:build
```

`dist/` klasöründe `Bilal Efendi Setup.exe` oluşur. Bu dosyayı istediğiniz
bilgisayara kurabilirsiniz.

## Yayın adresi

Uygulama şu an önizleme adresini açıyor. Siteyi yayınladıktan sonra
`electron/main.cjs` içindeki `APP_URL` değerini yayınlanan adresle değiştirin.

## Not

Google ile giriş bazı masaüstü uygulamalarında engellenebilir. Öyle olursa
girişi normal tarayıcıda açacak şekilde ayarlayabilirim — bana söylemeniz yeterli.
