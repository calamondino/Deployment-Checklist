/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Run` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Run` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `RunItem` table. All the data in the column will be lost.
  - You are about to drop the column `done` on the `RunItem` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `RunItem` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `RunItem` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - Added the required column `title` to the `RunItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Template` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `teamId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "Run_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Run_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Run_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Run" ("finishedAt", "id", "startedAt", "startedById", "status", "teamId", "templateId") SELECT "finishedAt", "id", "startedAt", "startedById", "status", "teamId", "templateId" FROM "Run";
DROP TABLE "Run";
ALTER TABLE "new_Run" RENAME TO "Run";
CREATE TABLE "new_RunItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "checkedById" TEXT,
    "checkedAt" DATETIME,
    "note" TEXT,
    CONSTRAINT "RunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RunItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RunItem" ("id", "runId", "taskId") SELECT "id", "runId", "taskId" FROM "RunItem";
DROP TABLE "RunItem";
ALTER TABLE "new_RunItem" RENAME TO "RunItem";
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("id", "order", "templateId", "title") SELECT "id", "order", "templateId", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Team" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
CREATE TABLE "new_Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Template_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Template" ("createdAt", "id", "teamId") SELECT "createdAt", "id", "teamId" FROM "Template";
DROP TABLE "Template";
ALTER TABLE "new_Template" RENAME TO "Template";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "teamId") SELECT "createdAt", "email", "id", "name", "teamId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
