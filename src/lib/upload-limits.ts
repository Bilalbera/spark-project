/** Largest episode video file the founder panel accepts. */
export const MAX_EPISODE_FILE_BYTES = 50 * 1024 ** 3;

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function episodeFileError(size: number) {
  if (size > MAX_EPISODE_FILE_BYTES) {
    return `Dosya ${formatBytes(size)}. Bölüm videosu en fazla 50 GB olabilir.`;
  }
  return null;
}
