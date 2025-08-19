import { router } from './trpc';
import { taskRouter } from './routers/task';
import { eventRouter } from './routers/event';
import { focusRouter } from './routers/focus';
export const appRouter=router({task:taskRouter, event:eventRouter, focus:focusRouter});
export type AppRouter=typeof appRouter;
