import { router } from "./trpc";
import { taskRouter } from "./routers/task";
export const appRouter = router({ task: taskRouter });
export type AppRouter = typeof appRouter;
