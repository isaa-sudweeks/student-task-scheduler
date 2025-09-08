import { inferRouterOutputs, inferRouterInputs } from '@trpc/server';
import { router } from './trpc';
import { courseRouter } from './routers/course';
import { eventRouter } from './routers/event';
import { focusRouter } from './routers/focus';
import { projectRouter } from './routers/project';
import { taskRouter } from './routers/task';
import { userRouter } from './routers/user';

export const appRouter = router({
  task: taskRouter,
  event: eventRouter,
  focus: focusRouter,
  project: projectRouter,
  course: courseRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
