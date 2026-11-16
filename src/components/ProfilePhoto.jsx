import { useState } from 'react'

/**
 * Profile image with a built-in fallback.
 *
 * A photo URL can fail for reasons the UI cannot predict (presigned link
 * expired, object deleted, host blocked). Keeping the fallback in a separate
 * `src ? <img> : <placeholder>` branch means a broken URL shows a broken-image
 * icon instead of the placeholder — so both live here, combined: the image is
 * rendered first and swapped for `fallback` once it fails to load.
 *
 * Tracking the failed `src` (instead of a boolean) retries automatically when
 * the URL changes, e.g. when /api/auth/me hands back a freshly signed link.
 */
export default function ProfilePhoto({ src, alt = '', fallback = null, ...imgProps }) {
  const [failedSrc, setFailedSrc] = useState(null)
  if (!src || failedSrc === src) return fallback
  return <img src={src} alt={alt} onError={() => setFailedSrc(src)} {...imgProps} />
}
