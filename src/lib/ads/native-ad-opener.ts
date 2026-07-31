/**
 * Native ad "open" bridge — AdSense destination URLs live inside a cross-origin
 * iframe, so we cannot read them. On like (right swipe) we forward a click to
 * the rendered ad iframe / anchor so Google can handle navigation.
 */

type AdOpener = () => boolean;

let currentOpener: AdOpener | null = null;

export function registerNativeAdOpener(opener: AdOpener | null): void {
  currentOpener = opener;
}

/** Returns true if a click / navigation attempt was made. */
export function openCurrentNativeAd(): boolean {
  return currentOpener?.() ?? false;
}

export function clickNativeAdRoot(root: HTMLElement | null): boolean {
  if (!root) return false;

  const anchor = root.querySelector<HTMLAnchorElement>("a[href^='http']");
  if (anchor?.href) {
    window.open(anchor.href, "_blank", "noopener,noreferrer");
    return true;
  }

  const iframe = root.querySelector<HTMLIFrameElement>("iframe");
  if (iframe) {
    // User-gesture continuation from swipe — ask the ad frame to receive a click.
    iframe.click();
    const rect = iframe.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    iframe.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: cx,
        clientY: cy,
      }),
    );
    return true;
  }

  const ins = root.querySelector<HTMLElement>("ins.adsbygoogle");
  if (ins) {
    ins.click();
    return true;
  }

  return false;
}
