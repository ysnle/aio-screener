// v59.56 (owner 11/01: "텔레그램에서 시각적 자료/이미지도 확인할 수 있나?"): the digest read only a post's caption text. A
// chart, a broker-note screenshot or an attached PDF report was invisible — a post with a caption counted as text and its
// picture was dropped silently; a picture with no caption became 'media-only' with score 0. This reads what the public
// preview says about a post's attachments without reading the attachment itself:
//   - kind and count (photo / video / document; an album counts each photo),
//   - a document's file name ("SK하이닉스_3Q26_Review.pdf" names the company, the quarter and that it is a report).
// Image and PDF bodies stay unread (no OCR, no vision call — the AI Worker refuses image input as a cost guard, P1421);
// the counts make that gap measurable in coverage instead of hiding it.

const decode = (value) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

/** Attachments of one message bubble: { kind, photoCount, videoCount, documents:[{ title, extra }] } or null. */
export function telegramMedia(bubbleHtml) {
  const html = String(bubbleHtml || '');
  const photoCount = (html.match(/class="tgme_widget_message_photo_wrap\b/g) || []).length;
  const videoCount = (html.match(/class="tgme_widget_message_video_player\b/g) || []).length;
  const documents = [];
  const re = /<div class="tgme_widget_message_document_title[^"]*"[^>]*>([\s\S]*?)<\/div>(?:\s*<div class="tgme_widget_message_document_extra[^"]*"[^>]*>([\s\S]*?)<\/div>)?/g;
  let m;
  while ((m = re.exec(html))) {
    const title = decode(m[1]).slice(0, 160);
    if (title) documents.push({ title, ...(decode(m[2]) ? { extra: decode(m[2]).slice(0, 40) } : {}) });
  }
  if (!photoCount && !videoCount && !documents.length) return null;
  const kind = documents.length ? 'document' : photoCount ? 'photo' : 'video';
  return { kind, photoCount, videoCount, documents };
}

/** Text the classifier may read besides the caption: document file names, underscores and extension made readable. */
export function mediaClassifierText(media) {
  return (media?.documents || [])
    .map((doc) => doc.title.replace(/\.\b(?:pdf|pptx?|docx?|xlsx?|hwp)\b$/i, '').replace(/[_]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Coverage counts over observed rows carrying `media` (lineage keeps only kind and counts). */
export function mediaCoverage(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const withMedia = list.filter((row) => row?.media?.kind);
  return {
    mediaAttachedCount: withMedia.length,
    photoPostCount: withMedia.filter((row) => row.media.photoCount > 0).length,
    documentPostCount: withMedia.filter((row) => row.media.kind === 'document').length,
    imageOnlyCount: withMedia.filter((row) => !row.hasText && row.media.photoCount > 0).length,
  };
}
