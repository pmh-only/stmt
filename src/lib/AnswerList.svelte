<script lang="ts">
  import { enhance } from '$app/forms';
  import { Minus, Plus } from '@lucide/svelte';
  import { autosave, keepEditing } from '$lib/autosave';
  import PillIcon from '$lib/PillIcon.svelte';
  import type { Answer, Pill } from '$lib/types';
  import AnswerList from './AnswerList.svelte';

  let {
    answers: initialAnswers,
    pills,
    canEdit,
    onQuestionStrikeChange
  }: {
    answers: Answer[];
    pills: Pill[];
    canEdit: boolean;
    onQuestionStrikeChange?: (questionId: number) => void;
  } = $props();
  let answers = $state(getInitialAnswers());

  function getInitialAnswers() {
    return initialAnswers;
  }

  function hasVisibleContent(answer: Answer): boolean {
    return Boolean(answer.body.trim() || answer.pills.length || answer.children.some(hasVisibleContent));
  }

  function applyVisibleStrikes(list: Answer[]) {
    for (const answer of list) {
      applyVisibleStrikes(answer.children);
    }

    let shouldStrikeEarlierAnswers = false;
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const answer = list[index];
      answer.struck = answer.pills.some((pill) => pill.strike_answer) || shouldStrikeEarlierAnswers;
      if (answer.pills.some((pill) => pill.strike_previous_answers)) {
        shouldStrikeEarlierAnswers = true;
      }
    }
  }

  function parseVisibleAnswer(text: string) {
    const pillsByName = new Map<string, Pill>();
    for (const pill of pills) {
      pillsByName.set(pill.slug.toLowerCase(), pill);
      pillsByName.set(pill.label.toLowerCase(), pill);
    }

    const parsedPills: Pill[] = [];
    const seenPills = new Set<number>();
    const body = text
      .replace(/\[([^\]]+)\]/g, (_, name: string) => {
        const pill = pillsByName.get(name.trim().toLowerCase());
        if (!pill) return `[${name}]`;
        if (!seenPills.has(pill.id)) {
          parsedPills.push(pill);
          seenPills.add(pill.id);
        }
        return '';
      })
      .replace(/\s+/g, ' ')
      .trim();

    return { body, pills: parsedPills };
  }

  function pillForName(name: string) {
    const normalizedName = name.trim().toLowerCase();
    return pills.find((pill) => pill.slug.toLowerCase() === normalizedName || pill.label.toLowerCase() === normalizedName);
  }

  function createPillElement(pill: Pill) {
    const element = document.createElement('span');
    element.className = 'pill';
    element.contentEditable = 'false';
    element.dataset.pillToken = pill.slug;
    element.innerHTML = `${pillIconSvg(pill.icon)}<span>${pill.label}</span>`;
    element.style.background = pill.background;
    element.style.color = pill.color;
    return element;
  }

  function pillIconSvg(icon: string) {
    const paths: Record<string, string> = {
      check: '<path d="M20 6 9 17l-5-5"/>',
      x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
      'circle-help': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
      'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
      split: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22V8"/><path d="m19 3-7 7-7-7"/>',
      tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
      'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
      circle: '<circle cx="12" cy="12" r="10"/>',
      'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
    };
    if (!paths[icon]) return '';
    return `<svg class="pill-svg" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${paths[icon]}</svg>`;
  }

  function renderSerializedText(node: HTMLElement, text: string) {
    node.replaceChildren();

    let cursor = 0;
    for (const match of text.matchAll(/\[([^\]]+)\]/g)) {
      const pill = pillForName(match[1]);
      if (!pill) continue;

      if (match.index > cursor) {
        node.append(document.createTextNode(text.slice(cursor, match.index)));
      }
      node.append(createPillElement(pill));
      cursor = match.index + match[0].length;
    }

    if (cursor < text.length) {
      node.append(document.createTextNode(text.slice(cursor)));
    }
  }

  function serializeEditor(node: HTMLElement) {
    let text = '';
    for (const child of node.childNodes) {
      if (child instanceof HTMLElement && child.dataset.pillToken) {
        text += `[${child.dataset.pillToken}]`;
      } else {
        text += child.textContent ?? '';
      }
    }
    return text;
  }

  function hasTextPillToken(node: HTMLElement) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && /\[([^\]]+)\]/.test(child.textContent ?? '')) {
        return true;
      }
    }
    return false;
  }

  function placeCaretAtEnd(node: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function previousEditableNode(editor: HTMLElement) {
    const selection = getSelection();
    if (!selection?.isCollapsed || !selection.anchorNode) return null;

    const anchor = selection.anchorNode;
    const offset = selection.anchorOffset;
    if (anchor === editor) {
      return offset > 0 ? editor.childNodes[offset - 1] : null;
    }
    if (anchor.nodeType === Node.TEXT_NODE && offset === 0) {
      return anchor.previousSibling;
    }
    return null;
  }

  function syncAnswer(answer: Answer, editor: HTMLElement) {
    const text = serializeEditor(editor);
    const parsed = parseVisibleAnswer(text);
    answer.edit_body = text;
    answer.body = parsed.body;
    answer.pills = parsed.pills;
    applyVisibleStrikes(answers);
    answers = [...answers];
    onQuestionStrikeChange?.(answer.question_id);

    const input = editor.closest('form')?.querySelector<HTMLInputElement>('input[name="body"]');
    if (input) {
      input.value = text;
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  }

  function pillEditor(node: HTMLElement, answer: Answer) {
    renderSerializedText(node, answer.edit_body);

    function onInput() {
      if (hasTextPillToken(node)) {
        renderSerializedText(node, serializeEditor(node));
        placeCaretAtEnd(node);
      }
      syncAnswer(answer, node);
    }

    function onKeydown(event: KeyboardEvent) {
      if (event.key !== 'Backspace') return;
      const previousNode = previousEditableNode(node);
      if (!(previousNode instanceof HTMLElement) || !previousNode.dataset.pillToken) return;
      previousNode.remove();
      event.preventDefault();
      syncAnswer(answer, node);
    }

    node.addEventListener('input', onInput);
    node.addEventListener('keydown', onKeydown);

    return {
      destroy() {
        node.removeEventListener('input', onInput);
        node.removeEventListener('keydown', onKeydown);
      }
    };
  }
</script>

<ul class="answer-list">
  {#each answers.filter((answer) => canEdit || hasVisibleContent(answer)) as answer}
    <li>
      {#if canEdit}
        <form method="POST" action="?/updateAnswer" class="answer-form" use:enhance={keepEditing} use:autosave>
          <input type="hidden" name="id" value={answer.id} />
          <input type="hidden" name="body" value={answer.edit_body} />
          <div class:struck={answer.struck} class="answer-line">
            <span contenteditable use:pillEditor={answer} class="answer-text" data-placeholder="Answer"></span>
          </div>
        </form>
      {:else}
        <div class:struck={answer.struck} class="answer-line">
          {#each answer.pills as pill}
            <span class="pill" style={`background:${pill.background};color:${pill.color}`}><PillIcon name={pill.icon} />{pill.label}</span>
          {/each}
          {#if answer.body}<span>{answer.body}</span>{/if}
        </div>
      {/if}

      {#if answer.children.length}
        <AnswerList answers={answer.children} {pills} {canEdit} {onQuestionStrikeChange} />
      {/if}

      {#if canEdit}
        <div class="item-buttons">
          <form method="POST" action="?/appendAnswer">
            <input type="hidden" name="questionId" value={answer.question_id} />
            <input type="hidden" name="parentId" value={answer.id} />
            <input type="hidden" name="body" value="" />
            <button class="secondary item-button" aria-label="Add nested answer"><Plus size={14} /></button>
          </form>
          <form method="POST" action="?/deleteLastAnswer">
            <input type="hidden" name="questionId" value={answer.question_id} />
            <input type="hidden" name="parentId" value={answer.id} />
            <button class="secondary item-button" aria-label="Delete last nested answer" disabled={answer.children.length === 0}><Minus size={14} /></button>
          </form>
        </div>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .answer-list,
  .answer-list :global(ul) {
    margin: 0.35rem 0 0 1.2rem;
    padding: 0;
    list-style-position: inside;
    list-style-type: 'ㄴ ';
  }

  li + li {
    margin-top: 0.45rem;
  }

  .answer-line {
    display: inline;
  }

  .answer-text {
    display: inline-block;
    min-width: 3rem;
    border-radius: 0.3rem;
    outline: none;
  }

  .answer-text:focus {
    box-shadow: 0 0 0 2px #171717 inset;
  }

  .answer-text:empty::before {
    content: attr(data-placeholder);
    color: #aaa;
    text-decoration: none;
  }

  .struck {
    color: #777;
    text-decoration: line-through;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-right: 0.25rem;
    padding: 0 0.5rem;
    border-radius: 999px;
    font-weight: 700;
    text-decoration: inherit;
  }

  .answer-text :global(.pill) {
    user-select: none;
  }

  .answer-text :global(.pill-svg) {
    flex: none;
  }

  .answer-form {
    display: inline;
    margin: 0;
  }

  .item-buttons {
    display: flex;
    gap: 0.25rem;
    margin: 0.35rem 0 0.5rem 1rem;
  }

  .item-buttons form {
    margin: 0;
  }

  .item-button {
    display: inline-grid;
    place-items: center;
    width: 1.55rem;
    height: 1.55rem;
    padding: 0;
  }

  .item-button:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }

</style>
