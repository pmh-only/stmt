<script lang="ts">
  import { enhance } from '$app/forms';
  import { autosave, keepEditing } from '$lib/autosave';
  import PillIcon from '$lib/PillIcon.svelte';
  import { normalizeIconName, pillIconOptions } from '$lib/pill-icons';
  import type { Pill } from '$lib/types';

  let { data, form } = $props();
  let pills = $state<Pill[]>(getInitialPills());

  function getInitialPills() {
    return data.pills;
  }

  function updatePreview(pill: Pill, event: Event) {
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    pill.label = String(formData.get('label') || '');
    pill.slug = String(formData.get('slug') || '');
    pill.icon = String(formData.get('icon') || '');
    pill.background = String(formData.get('background') || '');
    pill.color = String(formData.get('color') || '');
    pill.strike_answer = formData.get('strikeAnswer') === 'on';
    pill.strike_question = formData.get('strikeQuestion') === 'on';
    pill.strike_previous_answers = formData.get('strikePreviousAnswers') === 'on';
    pills = [...pills];
  }
</script>

<svelte:head>
  <title>Pill management</title>
</svelte:head>

<main>
  <header>
    <div>
      <a href="/">Back</a>
      <h1>Pill management</h1>
      <p>Labels and colors used on answers.</p>
    </div>
    <form method="POST" action="/logout"><button>logout</button></form>
  </header>

  {#if form?.message}
    <p class="error">{form.message}</p>
  {/if}

  <section class="grid">
    {#each pills as pill}
      <form method="POST" action="?/update" class="card" use:enhance={keepEditing} use:autosave oninput={(event) => updatePreview(pill, event)} onchange={(event) => updatePreview(pill, event)}>
        <input type="hidden" name="id" value={pill.id} />
        <span class="pill" style={`background:${pill.background};color:${pill.color}`}>
          <PillIcon name={pill.icon} />{pill.label}
        </span>
        <label>Label <input name="label" value={pill.label} /></label>
        <label>Slug <input name="slug" value={pill.slug} /></label>
        <label>
          Icon
          <select name="icon">
            {#each pillIconOptions as option}
              <option value={option.value} selected={normalizeIconName(pill.icon) === option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label>Background <input name="background" value={pill.background} /></label>
        <label>Text color <input name="color" value={pill.color} /></label>
        <label class="inline"><input type="checkbox" name="strikeAnswer" checked={pill.strike_answer} /> strike this answer</label>
        <label class="inline"><input type="checkbox" name="strikeQuestion" checked={pill.strike_question} /> strike question when included</label>
        <label class="inline"><input type="checkbox" name="strikePreviousAnswers" checked={pill.strike_previous_answers} /> strike previous answers</label>
      </form>
    {/each}
  </section>

  <form method="POST" action="?/add" class="add-card">
    <h2>Add pill</h2>
    <label>Label <input name="label" placeholder="Maybe" /></label>
    <label>Slug <input name="slug" placeholder="maybe" /></label>
    <label>
      Icon
      <select name="icon">
        {#each pillIconOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
    <label>Background <input name="background" value="lightgray" /></label>
    <label>Text color <input name="color" value="#111111" /></label>
    <label class="inline"><input type="checkbox" name="strikeAnswer" /> strike this answer</label>
    <label class="inline"><input type="checkbox" name="strikeQuestion" /> strike question when included</label>
    <label class="inline"><input type="checkbox" name="strikePreviousAnswers" /> strike previous answers</label>
    <button>Add pill</button>
  </form>
</main>

<style>
  main {
    width: min(960px, calc(100vw - 2rem));
    margin: 0 auto;
    padding: 2rem 0 4rem;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  h1 {
    margin: 0.25rem 0 0;
    font-size: clamp(2rem, 7vw, 4rem);
    line-height: 1;
  }

  p {
    margin: 0.5rem 0 0;
    color: #555;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .card,
  .add-card {
    display: grid;
    gap: 0.55rem;
    padding: 1rem;
    border: 1px solid #e1e1e1;
    border-radius: 1rem;
    background: white;
  }

  .add-card {
    max-width: 28rem;
    margin-top: 1rem;
  }

  .pill {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.5rem;
    border-radius: 999px;
    font-weight: 700;
  }

  .error {
    padding: 0.75rem;
    border: 1px solid #8b0000;
    border-radius: 0.75rem;
    color: #8b0000;
    background: #fff0f0;
  }

  .inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .inline input {
    width: auto;
  }

  @media (max-width: 700px) {
    header {
      display: grid;
    }
  }
</style>
