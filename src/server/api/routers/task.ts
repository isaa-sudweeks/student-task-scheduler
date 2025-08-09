import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { db } from "@/server/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";

export const taskRouter = router({
  list: publicProcedure.query(async () => {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) return [];
    return db.task.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    });
  }),
  create: publicProcedure.input(z.object({ title: z.string().min(1).max(200) })).mutation(async ({ input }) => {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) throw new Error("Not authenticated");
    return db.task.create({ data: { title: input.title, userId } });
  }),
  delete: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) throw new Error("Not authenticated");
    return db.task.delete({ where: { id: input.id } });
  }),
});
