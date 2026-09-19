(function initializeAppPopup() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'appPopupBackdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.innerHTML = `
    <div class="modal message-modal" role="dialog" aria-modal="true" aria-labelledby="appPopupTitle">
      <div class="modal-header"><h3 id="appPopupTitle">Notice</h3><button class="modal-close" id="appPopupClose" type="button" aria-label="Close message">×</button></div>
      <div class="modal-body" id="appPopupBody"></div>
      <div class="modal-actions">
        <button type="button" class="action-btn" id="appPopupCancel">Cancel</button>
        <button type="button" class="action-btn primary" id="appPopupConfirm">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const body = backdrop.querySelector('#appPopupBody');
  const closeButton = backdrop.querySelector('#appPopupClose');
  const cancelButton = backdrop.querySelector('#appPopupCancel');
  const confirmButton = backdrop.querySelector('#appPopupConfirm');
  let confirmAction = null;

  function closePopup() {
    confirmAction = null;
    backdrop.classList.remove('visible');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  window.showAppPopup = function showAppPopup(message, onConfirm = null) {
    confirmAction = typeof onConfirm === 'function' ? onConfirm : null;
    body.textContent = message;
    cancelButton.hidden = !confirmAction;
    confirmButton.textContent = confirmAction ? 'Confirm' : 'OK';
    backdrop.classList.add('visible');
    backdrop.setAttribute('aria-hidden', 'false');
  };

  closeButton.addEventListener('click', closePopup);
  cancelButton.addEventListener('click', closePopup);
  confirmButton.addEventListener('click', async () => {
    const action = confirmAction;
    closePopup();
    if (action) await action();
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closePopup();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop.classList.contains('visible')) closePopup();
  });
})();