<script lang="ts">
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #171717;
    background: #fafafa;
  }

  :global(button),
  :global(input),
  :global(textarea),
  :global(select) {
    font: inherit;
  }

  :global(button),
  :global(.button) {
    border: 1px solid #171717;
    border-radius: 999px;
    background: #171717;
    color: white;
    padding: 0.35rem 0.8rem;
    text-decoration: none;
    cursor: pointer;
  }

  :global(.button.secondary),
  :global(button.secondary) {
    background: white;
    color: #171717;
  }

  :global(input),
  :global(textarea) {
    width: 100%;
    border: 1px solid #cfcfcf;
    border-radius: 0.5rem;
    padding: 0.45rem 0.55rem;
    background: white;
  }

  :global(textarea) {
    min-height: 4rem;
    resize: vertical;
  }
</style>
