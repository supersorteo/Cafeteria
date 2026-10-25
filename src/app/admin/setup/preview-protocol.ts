import { SiteData } from '../../core/site.models';
import { PreviewTarget } from './setup-steps';

export const PREVIEW_PATH = '/admin/preview';

export type PreviewMessage =
  | { type: 'terraza-preview-ready' }
  | { type: 'terraza-preview-data'; site: SiteData; target: PreviewTarget }
  | { type: 'terraza-preview-section'; missing: boolean };

export function readPreviewMessage(event: MessageEvent, expectedSource: MessageEventSource | null): PreviewMessage | null {
  if (event.origin !== location.origin || event.source !== expectedSource) {
    return null;
  }
  const data = event.data as { type?: string } | null;
  return data && typeof data.type === 'string' && data.type.startsWith('terraza-preview-') ? (data as PreviewMessage) : null;
}
