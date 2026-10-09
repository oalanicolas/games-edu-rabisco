(() => {
  if (location.hostname !== 'edu.rabisco.net' || !navigator.onLine) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-TT2J9B4B';
  document.head.appendChild(tag);
})();
