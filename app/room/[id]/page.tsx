import Link from "next/link";
import Chat from "../../components/Chat";
import { prisma } from "../../lib/prisma";
import FileUpload from "../../components/FileUpload";
import NotesList from "../../components/NotesList";
import { notFound, redirect } from "next/navigation";
import { getOrCreateUser } from "../../lib/getOrCreateUser";
import ParticipantList from "./ParticipantList";
import PomodoroTimer from "../../components/PomodoroTimer";
import RoomSettings from "../../components/RoomSettings";
import TutorChat from "../../components/TutorChat";
import Whiteboard from "../../components/Whiteboard";
import VoiceCall from "../../components/VoiceCall";
import CopyRoomLink from "../../components/CopyRoomLink";
import RoomWorkspace from "./RoomWorkspace";
import KickListener from "../../components/KickListener";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [roomById, user] = await Promise.all([
    prisma.room.findUnique({ where: { id } }),
    getOrCreateUser(),
  ]);

  let room = roomById;

  if (!room) {
    const roomByCode = await prisma.room.findUnique({
      where: { code: id.toUpperCase() },
    });
    if (roomByCode) {
      redirect(`/room/${roomByCode.id}`);
    }
  }

  if (!room) {
    notFound();
  }

  const isCreator = user?.id === room.creatorId;

  // Banned users can never re-enter, regardless of lock state
  if (user && room.bannedUserIds.includes(user.id)) {
    return (
      <main className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">You've been removed from this room</h1>
        <p className="text-muted text-sm">
          The host removed you. Ask them if you think this was a mistake.
        </p>
      </main>
    );
  }

  // If the room is locked, only the creator and people already in it may enter
  if (room.locked && user && !isCreator) {
    const existingParticipant = await prisma.participant.findUnique({
      where: { userId_roomId: { userId: user.id, roomId: room.id } },
    });

    if (!existingParticipant) {
      return (
        <main className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
          <h1 className="text-2xl font-bold mb-2">This room is locked 🔒</h1>
          <p className="text-muted text-sm">
            The host has locked this room. Ask them to unlock it or invite you again.
          </p>
        </main>
      );
    }
  }

  if (user) {
    try {
      await prisma.participant.upsert({
        where: {
          userId_roomId: {
            userId: user.id,
            roomId: room.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roomId: room.id,
        },
      });
    } catch (err: any) {
      // P2002 = unique constraint collision from a near-simultaneous request
      // (e.g. React double-invoking this in dev). The row already exists
      // either way, so there's nothing left to do.
      if (err?.code !== "P2002") throw err;
    }
  }
  const participants = await prisma.participant.findMany({
    where: { roomId: room.id },
    include: { user: true },
  });

  return (
    <main className="flex flex-col items-center flex-1 px-8 md:px-16 py-14">
      {user && <KickListener roomId={room.id} currentUserId={user.id} />}

      <div className="w-full max-w-5xl">
        {/* Hero */}
        <div className="relative w-full rounded-3xl border border-border bg-surface overflow-hidden mb-10 p-10 md:p-14 shadow-2xl">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-24 w-80 h-80 rounded-full bg-accent2/25 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />

          <div className="relative flex items-start justify-between flex-wrap gap-6">
            <div>
              <p className="text-sm font-mono text-accent2 mb-3">
                {participants.length} {participants.length === 1 ? "person" : "people"} studying
                {room.locked && " · 🔒 locked"}
              </p>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-5">
                {room.name}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <CopyRoomLink roomId={room.id} roomCode={room.code} />
                <Link
                  href="/weak-topics"
                  className="text-xs font-mono border border-border bg-background text-foreground px-3 py-1.5 rounded-md hover:opacity-80"
                >
                  📊 My weak topics
                </Link>
              </div>
            </div>
            <RoomSettings
              roomId={room.id}
              roomName={room.name}
              isCreator={isCreator}
              locked={room.locked}
              participants={participants}
              creatorId={room.creatorId}
            />
          </div>
        </div>

        <RoomWorkspace
          study={
            <div className="space-y-8">
              <PomodoroTimer roomId={room.id} />
              <div>
                <h2 className="font-semibold mb-3 text-lg text-foreground">Who&apos;s here:</h2>
                <ParticipantList roomId={room.id} initialParticipants={participants} />
              </div>
            </div>
          }
          notes={
            <div className="space-y-8">
              <div>
                <h2 className="font-semibold mb-3 text-lg text-foreground">Upload a file:</h2>
                <FileUpload roomId={room.id} />
              </div>
              <div>
                <h2 className="font-semibold mb-3 text-lg text-foreground">Uploaded files:</h2>
                <NotesList roomId={room.id} />
              </div>
            </div>
          }
          tutor={<TutorChat roomId={room.id} />}
          whiteboard={<Whiteboard roomId={room.id} />}
          voice={<VoiceCall roomId={room.id} />}
          chat={<Chat roomId={room.id} currentUserId={user?.id ?? ""} />}
        />
      </div>
    </main>
  );
}