export function keepEditing() {
  return async () => {
    // Autosave must not invalidate/reload page data, or stale in-flight saves
    // can overwrite the text currently being edited.
  };
}

export function editableField(node: HTMLElement, inputName = 'body') {
  const form = node.closest('form');
  const input = form?.querySelector<HTMLInputElement>(`input[name="${inputName}"]`);

  function sync() {
    if (!input) return;
    input.value = node.textContent ?? '';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  node.addEventListener('input', sync);

  return {
    destroy() {
      node.removeEventListener('input', sync);
    }
  };
}

export function autosave(node: HTMLFormElement, delay = 500) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  function schedule() {
    clearTimeout(timeout);
    timeout = setTimeout(() => node.requestSubmit(), delay);
  }

  node.addEventListener('input', schedule);
  node.addEventListener('change', schedule);

  return {
    destroy() {
      clearTimeout(timeout);
      node.removeEventListener('input', schedule);
      node.removeEventListener('change', schedule);
    }
  };
}
