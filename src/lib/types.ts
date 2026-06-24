export type Pill = {
  id: number;
  label: string;
  slug: string;
  icon: string;
  background: string;
  color: string;
  strike_answer: boolean;
  strike_question: boolean;
  strike_previous_answers: boolean;
  sort_order: number;
};

export type Answer = {
  id: number;
  question_id: number;
  parent_id: number | null;
  body: string;
  edit_body: string;
  struck: boolean;
  sort_order: number;
  pills: Pill[];
  children: Answer[];
};

export type Question = {
  id: number;
  body: string;
  struck: boolean;
  sort_order: number;
  answers: Answer[];
};
