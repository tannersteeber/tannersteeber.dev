// Keep browser selection and page gestures out of the game, while allowing
// native controls and scrolling inside the game's own menus.
export function installGameTouch(root) {
  const off = [],
    on = (target, type, fn, options) => {
      target.addEventListener(type, fn, options);
      off.push(() => target.removeEventListener(type, fn, options));
    };
  document.documentElement.classList.add('arcade-game-document');
  const cancel = (event) => {
    if (event.cancelable) event.preventDefault();
  };
  const native = (target) => target.closest?.('button,a,input,select,textarea,summary,label');
  const scrollArea = (target) => {
    for (let el = target; el && el !== root; el = el.parentElement) {
      if (
        el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)
      ) return el;
    }
    return null;
  };
  for (
    const type of [
      'contextmenu',
      'selectstart',
      'dragstart',
      'copy',
      'cut',
      'gesturestart',
      'gesturechange',
    ]
  ) on(root, type, cancel, { capture: true, passive: false });
  let lastY = null;
  on(root, 'touchstart', (event) => {
    lastY = event.touches?.[0]?.clientY ?? null;
    if (event.touches?.length > 1 || (!native(event.target) && !scrollArea(event.target))) {
      cancel(event);
    }
  }, { capture: true, passive: false });
  on(root, 'touchmove', (event) => {
    if (event.touches?.length !== 1) {
      cancel(event);
      return;
    }
    const y = event.touches[0].clientY, dy = lastY === null ? 0 : y - lastY;
    lastY = y;
    // Range sliders, selects and color pickers retain their native interaction.
    if (event.target.closest?.('input,select,textarea')) return;
    const area = scrollArea(event.target);
    if (
      !area || (dy > 0 && area.scrollTop <= 0) ||
      (dy < 0 && area.scrollTop + area.clientHeight >= area.scrollHeight - 1)
    ) cancel(event);
  }, { capture: true, passive: false });
  for (const type of ['touchend', 'touchcancel']) {
    on(root, type, () => {
      lastY = null;
    }, { capture: true });
  }
  on(document, 'selectionchange', () => {
    const selection = document.getSelection();
    if (
      selection && !selection.isCollapsed &&
      (root.contains(selection.anchorNode) || root.contains(selection.focusNode))
    ) selection.removeAllRanges();
  });
  return () => {
    off.forEach((remove) => remove());
    document.documentElement.classList.remove('arcade-game-document');
  };
}
