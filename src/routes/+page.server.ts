import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';
import {
  addQuestion,
  appendAnswer,
  deleteLastAnswer,
  deleteLastQuestion,
  getPills,
  getQuestions,
  getSite,
  updateAnswer,
  updateQuestion,
  updateSite
} from '$lib/server/content';

function text(form: FormData, key: string) {
  return String(form.get(key) || '');
}

function numberValue(form: FormData, key: string) {
  const value = Number(form.get(key));
  if (!Number.isInteger(value)) throw new Error(`Invalid ${key}`);
  return value;
}

export function load({ locals }) {
  return {
    user: locals.user,
    site: getSite(),
    questions: getQuestions(),
    pills: getPills()
  };
}

export const actions = {
  updateSite({ request, locals }) {
    requireUser(locals.user);
    return request.formData().then((form) => {
      const title = text(form, 'title');
      if (!title.trim()) return fail(400, { message: 'Title is required' });
      updateSite(title, text(form, 'description'));
      return { ok: true };
    });
  },
  addQuestion({ request, locals }) {
    requireUser(locals.user);
    return request.formData().then((form) => {
      addQuestion(text(form, 'body'));
      return { ok: true };
    });
  },
  deleteLastQuestion({ locals }) {
    requireUser(locals.user);
    deleteLastQuestion();
    return { ok: true };
  },
  updateQuestion({ request, locals }) {
    requireUser(locals.user);
    return request.formData().then((form) => {
      updateQuestion(numberValue(form, 'id'), text(form, 'body'));
      return { ok: true };
    });
  },
  appendAnswer({ request, locals }) {
    requireUser(locals.user);
    return request.formData().then((form) => {
      appendAnswer(
        numberValue(form, 'questionId'),
        form.get('parentId') ? numberValue(form, 'parentId') : null,
        text(form, 'body')
      );
      return { ok: true };
    });
  },
  deleteLastAnswer({ request, locals }) {
    requireUser(locals.user);
    return request.formData().then((form) => {
      deleteLastAnswer(numberValue(form, 'questionId'), form.get('parentId') ? numberValue(form, 'parentId') : null);
      return { ok: true };
    });
  },
  updateAnswer({ request, locals }) {
    requireUser(locals.user);
    return request.formData().then((form) => {
      updateAnswer(numberValue(form, 'id'), text(form, 'body'));
      return { ok: true };
    });
  }
};
