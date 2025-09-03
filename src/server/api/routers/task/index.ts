import { t } from '../../trpc';
import { taskCrudRouter } from './taskCrud';
import { taskBulkRouter } from './taskBulk';
import { taskScheduleRouter } from './taskSchedule';

export const taskRouter = t.mergeRouters(
  taskCrudRouter,
  taskBulkRouter,
  taskScheduleRouter,
);
