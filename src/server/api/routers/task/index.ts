import { t } from '../../trpc';
import { taskCrudRouter } from './taskCrud';
import { taskBulkRouter } from './taskBulk';
import { taskScheduleRouter } from './taskSchedule';
import { taskReminderRouter } from './taskReminders';

export const taskRouter = t.mergeRouters(
  taskCrudRouter,
  taskBulkRouter,
  taskScheduleRouter,
  taskReminderRouter,
);

export { validateTaskRelationships } from './utils';
