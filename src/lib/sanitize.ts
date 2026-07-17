import DOMPurify from "dompurify";

/**
 * Safely sanitize admin/user-authored HTML before rendering with `v-html`.
 *
 * Replaces the previous regex-based sanitizer (which was bypassable via
 * unquoted event handlers, <svg>/<math> vectors, malformed tags, etc.) with
 * DOMPurify and a conservative allow-list. Newlines are converted to <br>
 * BEFORE sanitizing so the original display behavior is preserved while any
 * literal markup the author typed is still cleaned.
 */
const ALLOWED_TAGS = [
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "br",
  "p",
  "span",
  "div",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "code",
  "pre",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

const ALLOWED_ATTR = [
  "href",
  "title",
  "target",
  "rel",
  "class",
  "colspan",
  "rowspan",
];

export const sanitizeHtml = (html: string): string => {
  if (!html) return "";
  const withBreaks = html.replace(/\n/g, "<br>");
  return DOMPurify.sanitize(withBreaks, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Block javascript:/data: URIs in href; only allow safe schemes + relative
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ["target"],
  });
};

// Ensure external links opened from sanitized content can't access window.opener
if (typeof window !== "undefined") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}
