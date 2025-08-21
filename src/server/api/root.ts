import { inferRouterOutputs } from '@trpc/server';
import { router } from './trpc';
import { taskRouter } from './routers/task';
import { eventRouter } from './routers/event';
import { focusRouter } from './routers/focus';
import { projectRouter } from './routers/project';
import { courseRouter } from './routers/course';

export const appRouter = router({
  task: taskRouter,
  event: eventRouter,
  focus: focusRouter,
  project: projectRouter,
  course: courseRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
