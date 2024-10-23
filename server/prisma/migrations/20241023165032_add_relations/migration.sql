-- CreateTable
CREATE TABLE "Player" (
    "player_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "gameID" TEXT NOT NULL,
    "game_timeStamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "winnerId" INTEGER,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("gameID")
);

-- CreateTable
CREATE TABLE "_PlayersPlayed" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Player_email_key" ON "Player"("email");

-- CreateIndex
CREATE UNIQUE INDEX "_PlayersPlayed_AB_unique" ON "_PlayersPlayed"("A", "B");

-- CreateIndex
CREATE INDEX "_PlayersPlayed_B_index" ON "_PlayersPlayed"("B");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player"("player_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlayersPlayed" ADD CONSTRAINT "_PlayersPlayed_A_fkey" FOREIGN KEY ("A") REFERENCES "GameSession"("gameID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlayersPlayed" ADD CONSTRAINT "_PlayersPlayed_B_fkey" FOREIGN KEY ("B") REFERENCES "Player"("player_id") ON DELETE CASCADE ON UPDATE CASCADE;
