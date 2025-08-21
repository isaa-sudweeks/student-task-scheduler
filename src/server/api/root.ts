import { inferRouterOutputs } from '@trpc/server';
import { router } from './trpc';
import { taskRouter } from './routers/task';
import { eventRouter } from './routers/event';
import { focusRouter } from './routers/focus';
import { userRouter } from './routers/user';

export const appRouter = router({
  task: taskRouter,
  event: eventRouter,
  focus: focusRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
