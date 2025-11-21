import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PG_ESSAYS = {
  EQUITY: path.resolve(__dirname, './files/078_the_equity_equation.md'),
  INEQUALITY: path.resolve(__dirname, './files/049_inequality_and_risk.md'),
  LESSON: path.resolve(__dirname, './files/182_the_lesson_to_unlearn.md'),
  SPAM: path.resolve(__dirname, './files/018_a_plan_for_spam.md'),
  NERDS: path.resolve(__dirname, './files/021_why_nerds_are_unpopular.md'),
  STARTUP: path.resolve(__dirname, './files/039_how_to_start_a_startup.md'),
};

export const PG_ESSAY_NAMES = {
  EQUITY: '078_the_equity_equation.md',
  INEQUALITY: '049_inequality_and_risk.md',
  LESSON: '182_the_lesson_to_unlearn.md',
  SPAM: '018_a_plan_for_spam.md',
  NERDS: '021_why_nerds_are_unpopular.md',
  STARTUP: '039_how_to_start_a_startup.md',
};

export const PG_ESSAY_STATS = {
  EQUITY: { words: 1142, chars: 6491, topic: 'Startup equity formula' },
  INEQUALITY: { words: 2854, chars: 17662, topic: 'Economic inequality & startups' },
  LESSON: { words: 4059, chars: 23683, topic: 'Education system critique' },
  SPAM: { words: 5374, chars: 33244, topic: 'Bayesian spam filtering' },
  NERDS: { words: 5727, chars: 33517, topic: 'Social dynamics in schools' },
  STARTUP: { words: 9841, chars: 56256, topic: 'How to start a startup' },
};
