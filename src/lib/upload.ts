import * as tus from "tus-js-client";
import { supabase } from "@/lib/site-client";
import { episodeFileError, formatBytes } from "@/lib/upload-limits";

/** Uploads an image to the private media bucket and returns a long-lived signed URL. */
export async function uploadImage(file: File, folder: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage
    .from("media")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (e2 || !data) throw e2 ?? new Error("URL alınamadı");
  return data.signedUrl;
}

/** Resumable, chunked upload so large videos do not fail in a single request. */
function resumableUpload(path: string, file: File, onProgress?: (ratio: number) => void) {
  return new Promise<void>(async (resolve, reject) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return reject(new Error("Oturum bulunamadı, tekrar giriş yap."));
    const base = import.meta.env["VITE_SUPABASE_URL"] as string;
    const projectId = import.meta.env["VITE_SUPABASE_PROJECT_ID"] as string | undefined;
    const storageBase = projectId && /^[a-z0-9]+$/.test(projectId)
      ? `https://${projectId}.storage.supabase.co`
      : base;
    const upload = new tus.Upload(file, {
      endpoint: `${storageBase}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: "media", objectName: path, contentType: "video/mp4", cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => {
        const msg = String(err?.message ?? err);
        if (/413|too large|maximum size|exceeded/i.test(msg)) {
          reject(new Error(`Supabase yükleme sınırı dosya boyutundan düşük (${formatBytes(file.size)}). Storage ayarlarında global ve media bucket sınırlarını kontrol et; ücretsiz projelerde üst sınır 50 MB.`));
        } else reject(new Error(`Video yüklenemedi: ${msg}`));
      },
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

/** Uses the existing media bucket and its server-enforced founder policies. */
export async function uploadVideo(file: File, onProgress?: (ratio: number) => void) {
  if (!file.name.toLowerCase().endsWith(".mp4")) throw new Error("Lütfen .mp4 uzantılı bir video seçin.");
  if (!file.size) throw new Error("Seçilen video dosyası boş.");
  const limitError = episodeFileError(file.size);
  if (limitError) throw new Error(limitError);
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (String.fromCharCode(...header.slice(4, 8)) !== "ftyp") throw new Error("Dosya geçerli bir MP4 video değil.");
  const path = `videos/${crypto.randomUUID()}.mp4`;
  const bucket = supabase.storage.from("media");
  await resumableUpload(path, file, onProgress);
  const { data, error: urlError } = await bucket.createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (urlError || !data) {
    await bucket.remove([path]);
    throw urlError ?? new Error("Video adresi alınamadı.");
  }
  return data.signedUrl;
}
