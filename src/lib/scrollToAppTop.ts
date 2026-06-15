export function scrollToAppTop(): void {
  const main = document.getElementById('app-main-scroll');
  if (main) main.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}