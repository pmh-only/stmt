import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';
import { addPill, getPills, updatePill } from '$lib/server/content';

function text(form: FormData, key: string) {
  return String(form.get(key) || '');
}

function id(form: FormData) {
  const value = Number(form.get('id'));
  if (!Number.isInteger(value)) throw new Error('Invalid id');
  return value;
}

function validate(label: string, slug: string, background: string, color: string) {
  if (!label.trim() || !slug.trim() || !background.trim() || !color.trim()) {
    return fail(400, { message: 'All pill fields are required' });
  }
  if (!/^[a-z0-9-]+$/.test(slug.trim())) {
    return fail(400, { message: 'Slug must contain lowercase letters, numbers, and hyphens only' });
  }
  return null;
}

export function load({ locals }) {
  requireUser(locals.user);
  return { user: locals.user, pills: getPills() };
}

export const actions = {
  add({ request, locals }) {
    requireUser(locals.user);
    return request.formData().then((form) => {
      const label = text(form, 'label');
      const slug = text(form, 'slug');
      const icon = text(form, 'icon');
      const background = text(form, 'background');
      const color = text(form, 'color');
      const strikeAnswer = form.get('strikeAnswer') === 'on';
      const strikeQuestion = form.get('strikeQuestion') === 'on';
      const strikePreviousAnswers = form.get('strikePreviousAnswers') === 'on';
      const invalid = validate(label, slug, background, color);
      if (invalid) return invalid;
      addPill(label, slug, icon, background, color, strikeAnswer, strikeQuestion, strikePreviousAnswers);
      return { ok: true };
    });
  },
  update({ request, locals }) {
    requireUser(locals.user);
    return request.formData().then((form) => {
      const label = text(form, 'label');
      const slug = text(form, 'slug');
      const icon = text(form, 'icon');
      const background = text(form, 'background');
      const color = text(form, 'color');
      const strikeAnswer = form.get('strikeAnswer') === 'on';
      const strikeQuestion = form.get('strikeQuestion') === 'on';
      const strikePreviousAnswers = form.get('strikePreviousAnswers') === 'on';
      const invalid = validate(label, slug, background, color);
      if (invalid) return invalid;
      updatePill(id(form), label, slug, icon, background, color, strikeAnswer, strikeQuestion, strikePreviousAnswers);
      return { ok: true };
    });
  }
};
