import { supabase } from "@/integrations/supabase/client";

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

/** Uses the existing media bucket and its server-enforced founder policies. */
export async function uploadVideo(file: File) {
  if (!file.name.toLowerCase().endsWith(".mp4")) throw new Error("Lütfen .mp4 uzantılı bir video seçin.");
  if (!file.size) throw new Error("Seçilen video dosyası boş.");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (String.fromCharCode(...header.slice(4, 8)) !== "ftyp") throw new Error("Dosya geçerli bir MP4 video değil.");
  const path = `videos/${crypto.randomUUID()}.mp4`;
  const bucket = supabase.storage.from("media");
  const { error } = await bucket.upload(path, file, { contentType: "video/mp4", upsert: false });
  if (error) throw error;
  const { data, error: urlError } = await bucket.createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (urlError || !data) {
    await bucket.remove([path]);
    throw urlError ?? new Error("Video adresi alınamadı.");
  }
  return data.signedUrl;
}
