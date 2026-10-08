-- CreateTable
CREATE TABLE "QuestionResult" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "topic" TEXT,
    "selectedIndex" INTEGER NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionResult_userId_topic_idx" ON "QuestionResult"("userId", "topic");

-- CreateIndex
CREATE INDEX "QuestionResult_attemptId_idx" ON "QuestionResult"("attemptId");

-- AddForeignKey
ALTER TABLE "QuestionResult" ADD CONSTRAINT "QuestionResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
