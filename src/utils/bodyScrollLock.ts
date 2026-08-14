const BODY_SCROLL_LOCK_CLASS = 'overflow-hidden';

let activeLockCount = 0;
let addedScrollLockClass = false;

export function acquireBodyScrollLock(): () => void {
  if (activeLockCount === 0) {
    addedScrollLockClass = !document.body.classList.contains(BODY_SCROLL_LOCK_CLASS);

    if (addedScrollLockClass) {
      document.body.classList.add(BODY_SCROLL_LOCK_CLASS);
    }
  }

  activeLockCount += 1;
  let released = false;

  return () => {
    if (released) return;

    released = true;
    activeLockCount -= 1;

    if (activeLockCount === 0) {
      if (addedScrollLockClass) {
        document.body.classList.remove(BODY_SCROLL_LOCK_CLASS);
      }

      addedScrollLockClass = false;
    }
  };
}
