export const requestFullscreen = (element: HTMLElement) => {
  if (element.requestFullscreen) {
    element.requestFullscreen().catch(err => {
      console.warn(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else if ((element as any).webkitRequestFullscreen) { /* Safari */
    (element as any).webkitRequestFullscreen();
  } else if ((element as any).msRequestFullscreen) { /* IE11 */
    (element as any).msRequestFullscreen();
  }
};

export const exitFullscreen = () => {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if ((document as any).webkitExitFullscreen) { /* Safari */
    (document as any).webkitExitFullscreen();
  } else if ((document as any).msExitFullscreen) { /* IE11 */
    (document as any).msExitFullscreen();
  }
};

export const isFullscreen = () => {
  return !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).msFullscreenElement);
};
