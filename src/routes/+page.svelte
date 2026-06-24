<script lang="ts">
  import { enhance } from '$app/forms';
  import { Minus, Plus } from '@lucide/svelte';
  import { autosave, editableField, keepEditing } from '$lib/autosave';
  import AnswerList from '$lib/AnswerList.svelte';
  import type { Answer } from '$lib/types';

  let { data } = $props();
  let allQuestions = $state(getInitialQuestions());
  let canEdit = $derived(Boolean(data.user));
  let questions = $derived(
    canEdit ? allQuestions : allQuestions.filter((question) => question.body.trim() || question.answers.length)
  );

  function getInitialQuestions() {
    return data.questions;
  }

  function answerStrikesQuestion(answer: Answer): boolean {
    return answer.pills.some((pill) => pill.strike_question) || answer.children.some(answerStrikesQuestion);
  }

  function updateQuestionStrike(questionId: number) {
    const question = allQuestions.find((item) => item.id === questionId);
    if (!question) return;
    question.struck = question.answers.some(answerStrikesQuestion);
    allQuestions = [...allQuestions];
  }
</script>

<svelte:head>
  <title>{data.site.title}</title>
</svelte:head>

<main class:viewer={!canEdit}>
  <header>
    <div>
      {#if canEdit}
        <form method="POST" action="?/updateSite" class="site-form" use:enhance={keepEditing} use:autosave>
          <input name="title" value={data.site.title} aria-label="Site title" />
          <textarea name="description" aria-label="Site description">{data.site.description}</textarea>
        </form>
      {:else}
        <h1>{data.site.title}</h1>
        <p>{data.site.description}</p>
      {/if}
    </div>

    <nav>
      {#if data.user}
        <span>{data.user.name}</span>
        <a class="button secondary" href="/pills">pill mgmt</a>
        <form method="POST" action="/logout"><button>logout</button></form>
      {:else}
        <a class="button" href="/login">login</a>
      {/if}
    </nav>
  </header>

  <section class="questions">
    {#each questions as question, index}
      <article>
        {#if canEdit}
          <form method="POST" action="?/updateQuestion" class="question-form" use:enhance={keepEditing} use:autosave>
            <input type="hidden" name="id" value={question.id} />
            <input type="hidden" name="body" value={question.body} />
            <div class="question">
              <h2 contenteditable="plaintext-only" use:editableField class:struck={question.struck} data-placeholder="Question">{question.body}</h2>
              <span>#{index + 1}</span>
            </div>
          </form>
        {:else}
          <div class="question">
            {#if question.struck}
              <h2><del>{question.body}</del></h2>
            {:else}
              <h2>{question.body}</h2>
            {/if}
            <span>#{index + 1}</span>
          </div>
        {/if}

        <AnswerList answers={question.answers} pills={data.pills} {canEdit} onQuestionStrikeChange={updateQuestionStrike} />

        {#if canEdit}
          <div class="item-buttons">
            <form method="POST" action="?/appendAnswer">
              <input type="hidden" name="questionId" value={question.id} />
              <input type="hidden" name="body" value="" />
              <button class="secondary item-button" aria-label="Add answer"><Plus size={14} /></button>
            </form>
            <form method="POST" action="?/deleteLastAnswer">
              <input type="hidden" name="questionId" value={question.id} />
              <button class="secondary item-button" aria-label="Delete last answer" disabled={question.answers.length === 0}><Minus size={14} /></button>
            </form>
          </div>
        {/if}
      </article>
    {/each}
  </section>

  {#if canEdit}
    <div class="item-buttons">
      <form method="POST" action="?/addQuestion">
        <input type="hidden" name="body" value="" />
        <button class="secondary item-button" aria-label="Add question"><Plus size={14} /></button>
      </form>
      <form method="POST" action="?/deleteLastQuestion">
        <button class="secondary item-button" aria-label="Delete last question" disabled={questions.length === 0}><Minus size={14} /></button>
      </form>
    </div>
  {/if}
</main>

<style>
  main {
    width: min(960px, calc(100vw - 2rem));
    margin: 0 auto;
    padding: 2rem 0 4rem;
  }

  .viewer {
    user-select: none;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 8vw, 5rem);
    line-height: 0.95;
  }

  p {
    margin: 0.65rem 0 0;
    color: #555;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  nav form {
    margin: 0;
  }

  .site-form,
  .question-form {
    display: grid;
    gap: 0.5rem;
    max-width: 44rem;
  }

  .site-form input {
    font-size: clamp(1.8rem, 7vw, 4rem);
    font-weight: 700;
  }

  .questions {
    display: grid;
    gap: 1.3rem;
  }

  article {
    padding-top: 0.25rem;
  }

  .question {
    display: flex;
    align-items: end;
    gap: 0.5rem;
  }

  .question h2 {
    margin: 0;
  }

  .question h2[contenteditable] {
    min-width: 8rem;
    border-radius: 0.4rem;
    outline: none;
  }

  .question h2[contenteditable]:focus {
    box-shadow: 0 0 0 2px #171717 inset;
  }

  .question h2[contenteditable]:empty::before {
    content: attr(data-placeholder);
    color: #aaa;
    text-decoration: none;
  }

  .struck {
    color: #777;
    text-decoration: line-through;
  }

  .question span {
    color: #777;
  }

  .item-buttons {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.45rem;
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

  @media (max-width: 700px) {
    header {
      display: grid;
    }

    nav {
      justify-content: flex-start;
    }
  }
</style>
