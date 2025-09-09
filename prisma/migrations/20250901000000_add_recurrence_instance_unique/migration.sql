-- CreateIndex
CREATE UNIQUE INDEX "Task_userId_title_dueAt_recurrenceType_recurrenceInterval_key" ON "Task"("userId", "title", "dueAt", "recurrenceType", "recurrenceInterval");
