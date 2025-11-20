import { t } from '../../trpc';
import { taskCrudRouter } from './taskCrud';
import { taskBulkRouter } from './taskBulk';
import { taskScheduleRouter } from './taskSchedule';
import { taskReminderRouter } from './taskReminders';
import { taskSyllabusRouter } from './taskSyllabus';

export const taskRouter = t.mergeRouters(
  taskCrudRouter,
  taskBulkRouter,
  taskScheduleRouter,
  taskReminderRouter,
  taskSyllabusRouter,
);

export { validateTaskRelationships } from './utils';
