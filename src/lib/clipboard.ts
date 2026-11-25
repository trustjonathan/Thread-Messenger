/**
 * Safe clipboard copy utility with fallback for non-secure contexts
 * or blocked permissions.
 */
export async function copyTextToClipboard(
  text: string,
  targetElement?: HTMLElement | null
): Promise<{ success: boolean; fallbackSelectionMade?: boolean }> {
  // 1. Try modern navigator.clipboard
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch {
      // Permission denied or non-secure context; proceed to fallback
    }
  }

  // 2. Fallback: hidden textarea + document.execCommand('copy')
  if (typeof document !== 'undefined') {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      // Prevent zooming/scrolling on mobile
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '-9999px';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.setAttribute('readonly', '');
      textarea.setAttribute('aria-hidden', 'true');
      document.body.appendChild(textarea);

      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const successful = document.execCommand('copy');
      if (successful) {
        return { success: true };
      }
    } catch {
      // execCommand failed or blocked
    } finally {
      if (textarea && textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }

    // 3. Both failed: Select the text on the target element (if provided) so user can manually copy
    if (targetElement && typeof window !== 'undefined' && window.getSelection) {
      try {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(targetElement);
          selection.removeAllRanges();
          selection.addRange(range);
          return { success: false, fallbackSelectionMade: true };
        }
      } catch {
        // Selection failed
      }
    }
  }

  return { success: false, fallbackSelectionMade: false };
}
