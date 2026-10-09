export async function prepareOffline(status) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    if (status) status.textContent = 'Neste endereço o navegador não permite guardar o app offline. Use HTTPS ou o pacote local em localhost.';
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    const installing = registration.installing || registration.waiting;
    if (installing && installing.state !== 'activated') await new Promise((resolve, reject) => {
      installing.addEventListener('statechange', () => {
        if (installing.state === 'activated') resolve();
        if (installing.state === 'redundant') reject(new Error('Não foi possível guardar a nova versão.'));
      });
    });
    await navigator.serviceWorker.ready;
    if (status) status.textContent = 'Materiais disponíveis sem internet neste endereço. Teste antes da aula; os links externos precisam de conexão.';
  } catch {
    if (status) status.textContent = 'Os materiais ainda não foram guardados para uso offline. Verifique a conexão e recarregue antes da aula.';
  }
}
