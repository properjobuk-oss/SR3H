const cardDialog = document.querySelector('.plugin-card-dialog');
document.querySelectorAll('[data-card-preview]').forEach(button => {
  button.addEventListener('click', () => {
    cardDialog.querySelector('h2').textContent = button.dataset.cardPreview;
    cardDialog.dataset.theme = button.dataset.cardPreview === 'Mandate' ? 'mandate' : 'default';
    const image = cardDialog.querySelector('img');
    image.src = button.dataset.cardImage;
    image.alt = button.dataset.cardDescription;
    cardDialog.showModal();
  });
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
});
