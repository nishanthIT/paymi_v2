import { useEffect, useState } from 'react';
import api from '@/services/api';
import { API_CONFIG } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';

/** Private record photos are fetched through the same authenticated scope as their parent record.
 * A data URI works on both native and web, whose image element cannot attach authorization headers. */
export function usePrivateImage(uri: string | null | undefined) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<{ key: string; uri: string } | null>(null);
  let privatePath: string | null = null;
  try {
    const base = new URL(API_CONFIG.BASE_URL);
    const url = new URL(uri || '', base.origin);
    if (url.origin === base.origin && /^\/(api\/)?uploads\/(incidents|age-restriction-records|chat)\//.test(url.pathname)) {
      privatePath = url.pathname.replace(/^\/api/, '');
    }
  } catch { /* Local camera URI or an ordinary public image. */ }
  const mayLoad = !!user && (privatePath?.startsWith('/uploads/chat/') || !!user.shopId);
  const key = `${user?.userType}:${user?.id}:${user?.shopId}:${uri}`;
  useEffect(() => {
    if (!privatePath || !mayLoad) return;
    let cancelled = false;
    api.get<ArrayBuffer>(privatePath, { responseType: 'arraybuffer' }).then((response) => {
      const bytes = new Uint8Array(response.data);
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      if (!cancelled) setLoaded({ key, uri: `data:${response.headers['content-type'] || 'image/jpeg'};base64,${btoa(binary)}` });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [key, privatePath, mayLoad]);
  return privatePath ? loaded?.key === key ? loaded.uri : null : uri;
}
