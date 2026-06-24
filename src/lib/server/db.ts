import { DatabaseSync } from 'node:sqlite';
import { env } from '$env/dynamic/private';

const db = new DatabaseSync(env.DATABASE_URL || 'stmt.db');
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS site (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL DEFAULT '',
    background TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#111111',
    strike_answer INTEGER NOT NULL DEFAULT 0,
    strike_question INTEGER NOT NULL DEFAULT 0,
    strike_previous_answers INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    body TEXT NOT NULL,
    struck INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES answers(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    struck INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS answer_pills (
    answer_id INTEGER NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    pill_id INTEGER NOT NULL REFERENCES pills(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (answer_id, pill_id)
  );

  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

const pillColumns = db.prepare('PRAGMA table_info(pills)').all() as Array<{ name: string }>;
const pillColumnNames = new Set(pillColumns.map((column) => column.name));
if (!pillColumnNames.has('strike_answer')) {
  db.exec('ALTER TABLE pills ADD COLUMN strike_answer INTEGER NOT NULL DEFAULT 0');
}
if (!pillColumnNames.has('strike_question')) {
  db.exec('ALTER TABLE pills ADD COLUMN strike_question INTEGER NOT NULL DEFAULT 0');
}
if (!pillColumnNames.has('strike_previous_answers')) {
  db.exec('ALTER TABLE pills ADD COLUMN strike_previous_answers INTEGER NOT NULL DEFAULT 0');
}
if (!pillColumnNames.has('icon')) {
  db.exec("ALTER TABLE pills ADD COLUMN icon TEXT NOT NULL DEFAULT ''");
}

const pillCount = (db.prepare('SELECT COUNT(*) AS count FROM pills').get() as { count: number }).count;
if (pillCount > 0) {
  db.prepare("UPDATE pills SET strike_question = 1 WHERE slug = 'what'").run();
  db.prepare("UPDATE pills SET strike_previous_answers = 1 WHERE slug = 'changed'").run();
  db.prepare("UPDATE pills SET icon = 'check' WHERE slug = 'yes' AND icon = ''").run();
  db.prepare("UPDATE pills SET icon = 'x' WHERE slug = 'no' AND icon = ''").run();
  db.prepare("UPDATE pills SET icon = 'refresh-cw' WHERE slug = 'changed' AND icon = ''").run();
  db.prepare("UPDATE pills SET icon = 'circle-help' WHERE slug = 'what' AND icon = ''").run();

  const existingStruckPill = db.prepare("SELECT id FROM pills WHERE slug = 'struck'").get() as { id: number } | undefined;
  if (!existingStruckPill) {
  const nextSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort FROM pills').get() as { sort: number }).sort;
  db.prepare(
    'INSERT INTO pills (label, slug, icon, background, color, strike_answer, strike_question, strike_previous_answers, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('Struck', 'struck', 'circle', 'lightgray', '#111111', 1, 0, 0, nextSort);
  }

  db.prepare(
    `INSERT OR IGNORE INTO answer_pills (answer_id, pill_id, sort_order)
     SELECT a.id, p.id, 0
     FROM answers a
     JOIN pills p ON p.slug = 'struck'
     WHERE a.struck = 1`
  ).run();
}

const siteCount = db.prepare('SELECT COUNT(*) AS count FROM site').get() as { count: number };

if (siteCount.count === 0) {
  const insertSite = db.prepare('INSERT INTO site (id, title, description) VALUES (1, ?, ?)');
  const insertPill = db.prepare(
    'INSERT INTO pills (label, slug, icon, background, color, strike_answer, strike_question, strike_previous_answers, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertQuestion = db.prepare(
    'INSERT INTO questions (body, struck, sort_order) VALUES (?, ?, ?) RETURNING id'
  );
  const insertAnswer = db.prepare(
    'INSERT INTO answers (question_id, parent_id, body, struck, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING id'
  );
  const insertAnswerPill = db.prepare(
    'INSERT INTO answer_pills (answer_id, pill_id, sort_order) VALUES (?, ?, ?)'
  );

  const seed = () => {
    db.exec('BEGIN');
    try {
    insertSite.run('Site Name', 'Site description');

    const pills = new Map<string, number>();
    const seedPills: Array<[string, string, string, string, string, number, number, number]> = [
      ['Yes', 'yes', 'check', 'greenyellow', '#111111', 0, 0, 0],
      ['No', 'no', 'x', 'palevioletred', '#111111', 0, 0, 0],
      ['Changed', 'changed', 'refresh-cw', 'skyblue', '#111111', 0, 0, 1],
      ['What?', 'what', 'circle-help', 'brown', '#ffffff', 0, 1, 0],
      ['If', 'if', 'split', 'yellow', '#111111', 0, 0, 0],
      ['Or', 'or', 'split', 'yellow', '#111111', 0, 0, 0],
      ['Struck', 'struck', 'circle', 'lightgray', '#111111', 1, 0, 0]
    ];
    seedPills.forEach(([label, slug, icon, background, color, strikeAnswer, strikeQuestion, strikePreviousAnswers], index) => {
      const result = insertPill.run(label, slug, icon, background, color, strikeAnswer, strikeQuestion, strikePreviousAnswers, index + 1);
      pills.set(slug, Number(result.lastInsertRowid));
    });

    const addQuestion = (body: string, sort: number, struck = false) => {
      return (insertQuestion.get(body, struck ? 1 : 0, sort) as { id: number }).id;
    };
    const addAnswer = (
      questionId: number,
      body: string,
      slugs: string[],
      sort: number,
      options: { parentId?: number | null; struck?: boolean } = {}
    ) => {
      const answerId = (
        insertAnswer.get(
          questionId,
          options.parentId ?? null,
          body,
          options.struck ? 1 : 0,
          sort
        ) as { id: number }
      ).id;
      slugs.forEach((slug, index) => {
        const pillId = pills.get(slug);
        if (!pillId) throw new Error(`Missing seed pill ${slug}`);
        insertAnswerPill.run(answerId, pillId, index + 1);
      });
      return answerId;
    };

    const q1 = addQuestion('Are you ...', 1);
    addAnswer(q1, "I'm ...", ['yes'], 1);

    const q2 = addQuestion('Are you ...', 2);
    addAnswer(q2, "I'm ...", ['no'], 1);

    const q3 = addQuestion('Are you ...', 3);
    addAnswer(q3, "I'm ...", ['struck', 'no'], 1, { struck: true });
    addAnswer(q3, "I'm ...", ['changed', 'yes'], 2);

    const q4 = addQuestion('Are you ...', 4, true);
    addAnswer(q4, "I can't understand your question.", ['what'], 1);

    const q5 = addQuestion('Are you ...', 5);
    const a5a = addAnswer(q5, 'you mean ...', ['if'], 1);
    addAnswer(q5, "I'm ...", ['yes'], 1, { parentId: a5a });
    const a5b = addAnswer(q5, 'you mean ...', ['or'], 2);
    addAnswer(q5, "I'm ...", ['no'], 1, { parentId: a5b });
      db.exec('COMMIT');
    } catch (cause) {
      db.exec('ROLLBACK');
      throw cause;
    }
  };

  seed();
}

export { db };
