import { db } from './db';
import type { Answer, Pill, Question } from '$lib/types';

export function getSite() {
  return db.prepare('SELECT title, description FROM site WHERE id = 1').get() as {
    title: string;
    description: string;
  };
}

export function getPills() {
  return (db.prepare('SELECT * FROM pills ORDER BY sort_order, id').all() as Array<
    Omit<Pill, 'strike_answer' | 'strike_question' | 'strike_previous_answers'> & {
      strike_answer: number;
      strike_question: number;
      strike_previous_answers: number;
    }
  >).map(normalizePill);
}

function normalizePill(
  pill: Omit<Pill, 'strike_answer' | 'strike_question' | 'strike_previous_answers'> & {
    strike_answer: number;
    strike_question: number;
    strike_previous_answers: number;
  }
): Pill {
  return {
    id: pill.id,
    label: pill.label,
    slug: pill.slug,
    icon: pill.icon,
    background: pill.background,
    color: pill.color,
    sort_order: pill.sort_order,
    strike_answer: Boolean(pill.strike_answer),
    strike_question: Boolean(pill.strike_question),
    strike_previous_answers: Boolean(pill.strike_previous_answers)
  };
}

function normalizePillName(value: string) {
  return value.trim().toLowerCase();
}

function parseAnswerText(text: string, pills: Pill[]) {
  const pillsByName = new Map<string, Pill>();
  for (const pill of pills) {
    pillsByName.set(normalizePillName(pill.slug), pill);
    pillsByName.set(normalizePillName(pill.label), pill);
  }

  const parsedPills: Pill[] = [];
  const seenPills = new Set<number>();
  const body = text
    .replace(/\[([^\]]+)\]/g, (_, name: string) => {
      const pill = pillsByName.get(normalizePillName(name));
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

function answerEditBody(answer: { body: string; pills: Pill[] }) {
  const tokens = answer.pills.map((pill) => `[${pill.slug}]`).join(' ');
  return [tokens, answer.body].filter(Boolean).join(' ');
}

function applyPreviousAnswerStrikes(answers: Answer[]) {
  for (const answer of answers) {
    applyPreviousAnswerStrikes(answer.children);
  }

  let shouldStrikeEarlierAnswers = false;
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    const answer = answers[index];
    if (shouldStrikeEarlierAnswers) {
      answer.struck = true;
    }
    if (answer.pills.some((pill) => pill.strike_previous_answers)) {
      shouldStrikeEarlierAnswers = true;
    }
  }
}

function answerStrikesQuestion(answer: Answer): boolean {
  return answer.pills.some((pill) => pill.strike_question) || answer.children.some(answerStrikesQuestion);
}

export function getQuestions() {
  const pills = getPills();
  const questions = db
    .prepare('SELECT id, body, sort_order FROM questions ORDER BY sort_order, id')
    .all() as Array<Omit<Question, 'answers' | 'struck'>>;
  const answers = db
    .prepare('SELECT id, question_id, parent_id, body, sort_order FROM answers ORDER BY sort_order, id')
    .all() as Array<Omit<Answer, 'pills' | 'children' | 'struck'>>;
  const pillRows = db
    .prepare(
      `SELECT ap.answer_id, p.*
       FROM answer_pills ap
       JOIN pills p ON p.id = ap.pill_id
       ORDER BY ap.sort_order, p.id`
    )
    .all() as Array<
      Omit<Pill, 'strike_answer' | 'strike_question' | 'strike_previous_answers'> & {
        strike_answer: number;
        strike_question: number;
        strike_previous_answers: number;
        answer_id: number;
      }
    >;

  const pillsByAnswer = new Map<number, Pill[]>();
  for (const row of pillRows) {
    const pills = pillsByAnswer.get(row.answer_id) ?? [];
    pills.push(normalizePill(row));
    pillsByAnswer.set(row.answer_id, pills);
  }

  const answersById = new Map<number, Answer>();
  const answersByQuestion = new Map<number, Answer[]>();

  for (const answer of answers) {
    const hydrated: Answer = {
      ...answer,
      edit_body: '',
      struck: false,
      pills: pillsByAnswer.get(answer.id) ?? [],
      children: []
    };
    hydrated.edit_body = answerEditBody(hydrated);
    hydrated.struck = hydrated.pills.some((pill) => pill.strike_answer);
    answersById.set(answer.id, hydrated);
  }

  for (const answer of answersById.values()) {
    if (answer.parent_id) {
      answersById.get(answer.parent_id)?.children.push(answer);
      continue;
    }
    const list = answersByQuestion.get(answer.question_id) ?? [];
    list.push(answer);
    answersByQuestion.set(answer.question_id, list);
  }

  return questions.map((question) => {
    const answers = answersByQuestion.get(question.id) ?? [];
    applyPreviousAnswerStrikes(answers);
    return {
      ...question,
      struck: answers.some(answerStrikesQuestion),
      answers
    };
  });
}

export function updateSite(title: string, description: string) {
  db.prepare('UPDATE site SET title = ?, description = ? WHERE id = 1').run(title.trim(), description.trim());
}

export function addQuestion(body: string) {
  const nextSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort FROM questions').get() as { sort: number }).sort;
  db.prepare('INSERT INTO questions (body, sort_order) VALUES (?, ?)').run(body.trim(), nextSort);
}

export function deleteLastQuestion() {
  db.prepare('DELETE FROM questions WHERE id = (SELECT id FROM questions ORDER BY sort_order DESC, id DESC LIMIT 1)').run();
}

export function updateQuestion(id: number, body: string) {
  db.prepare('UPDATE questions SET body = ? WHERE id = ?').run(body.trim(), id);
}

export function appendAnswer(questionId: number, parentId: number | null, text: string) {
  const parsed = parseAnswerText(text, getPills());
  const nextSort = (
    db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort FROM answers WHERE question_id = ? AND parent_id IS ?')
      .get(questionId, parentId) as { sort: number }
  ).sort;
  db.exec('BEGIN');
  try {
    const result = db
      .prepare('INSERT INTO answers (question_id, parent_id, body, sort_order) VALUES (?, ?, ?, ?)')
      .run(questionId, parentId, parsed.body, nextSort);
    const answerId = Number(result.lastInsertRowid);
    parsed.pills.forEach((pill, index) => {
      db.prepare('INSERT INTO answer_pills (answer_id, pill_id, sort_order) VALUES (?, ?, ?)').run(answerId, pill.id, index + 1);
    });
    db.exec('COMMIT');
  } catch (cause) {
    db.exec('ROLLBACK');
    throw cause;
  }
}

export function deleteLastAnswer(questionId: number, parentId: number | null) {
  db.prepare(
    `DELETE FROM answers
     WHERE id = (
       SELECT id FROM answers
       WHERE question_id = ? AND parent_id IS ?
       ORDER BY sort_order DESC, id DESC
       LIMIT 1
     )`
  ).run(questionId, parentId);
}

export function updateAnswer(id: number, text: string) {
  const parsed = parseAnswerText(text, getPills());
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE answers SET body = ? WHERE id = ?').run(parsed.body, id);
    db.prepare('DELETE FROM answer_pills WHERE answer_id = ?').run(id);
    parsed.pills.forEach((pill, index) => {
      db.prepare('INSERT INTO answer_pills (answer_id, pill_id, sort_order) VALUES (?, ?, ?)').run(id, pill.id, index + 1);
    });
    db.exec('COMMIT');
  } catch (cause) {
    db.exec('ROLLBACK');
    throw cause;
  }
}

export function addPill(
  label: string,
  slug: string,
  icon: string,
  background: string,
  color: string,
  strikeAnswer: boolean,
  strikeQuestion: boolean,
  strikePreviousAnswers: boolean
) {
  const nextSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort FROM pills').get() as { sort: number }).sort;
  db.prepare(
    'INSERT INTO pills (label, slug, icon, background, color, strike_answer, strike_question, strike_previous_answers, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    label.trim(),
    slug.trim().toLowerCase(),
    icon.trim(),
    background.trim(),
    color.trim(),
    strikeAnswer ? 1 : 0,
    strikeQuestion ? 1 : 0,
    strikePreviousAnswers ? 1 : 0,
    nextSort
  );
}

export function updatePill(
  id: number,
  label: string,
  slug: string,
  icon: string,
  background: string,
  color: string,
  strikeAnswer: boolean,
  strikeQuestion: boolean,
  strikePreviousAnswers: boolean
) {
  db.prepare(
    'UPDATE pills SET label = ?, slug = ?, icon = ?, background = ?, color = ?, strike_answer = ?, strike_question = ?, strike_previous_answers = ? WHERE id = ?'
  ).run(
    label.trim(),
    slug.trim().toLowerCase(),
    icon.trim(),
    background.trim(),
    color.trim(),
    strikeAnswer ? 1 : 0,
    strikeQuestion ? 1 : 0,
    strikePreviousAnswers ? 1 : 0,
    id
  );
}
