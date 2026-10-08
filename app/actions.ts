"use server";
import { prisma } from "./lib/prisma";
import { getOrCreateUser } from "./lib/getOrCreateUser";
import { redirect } from "next/navigation";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function createRoom() {
  const user = await getOrCreateUser();

  if (!user) {
    throw new Error("You must be signed in to create a room.");
  }

  let room;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      room = await prisma.room.create({
        data: {
          name: `${user.name ?? "Untitled"}'s Room`,
          creatorId: user.id,
          code: generateRoomCode(),
        },
      });
      break;
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      throw err;
    }
  }

  if (!room) {
    throw new Error("Could not create a room, please try again.");
  }

  redirect(`/room/${room.id}`);
}

export async function findRoomIdByCode(code: string) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;

  const room = await prisma.room.findUnique({
    where: { code: trimmed },
    select: { id: true },
  });

  return room?.id ?? null;
}

export async function renameRoom(roomId: string, newName: string) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Not signed in.");

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.creatorId !== user.id) {
    throw new Error("Only the room creator can rename this room.");
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { name: newName },
  });
}

export async function toggleRoomLock(roomId: string) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Not signed in.");

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.creatorId !== user.id) {
    throw new Error("Only the room creator can lock or unlock this room.");
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { locked: !room.locked },
  });

  return !room.locked;
}

export async function removeParticipant(roomId: string, targetUserId: string) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Not signed in.");

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.creatorId !== user.id) {
    throw new Error("Only the room creator can remove participants.");
  }

  if (targetUserId === room.creatorId) {
    throw new Error("The room creator can't be removed.");
  }

  await prisma.participant.deleteMany({
    where: { roomId, userId: targetUserId },
  });

  // Ban them too, so they can't just reopen the link and silently rejoin
  if (!room.bannedUserIds.includes(targetUserId)) {
    await prisma.room.update({
      where: { id: roomId },
      data: { bannedUserIds: { push: targetUserId } },
    });
  }
}

export async function unbanParticipant(roomId: string, targetUserId: string) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Not signed in.");

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.creatorId !== user.id) {
    throw new Error("Only the room creator can unban participants.");
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { bannedUserIds: room.bannedUserIds.filter((id) => id !== targetUserId) },
  });
}

export async function deleteRoom(roomId: string) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Not signed in.");

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.creatorId !== user.id) {
    throw new Error("Only the room creator can delete this room.");
  }

  await prisma.chatMessage.deleteMany({ where: { roomId } });
  await prisma.note.deleteMany({ where: { roomId } });
  await prisma.participant.deleteMany({ where: { roomId } });
  await prisma.room.delete({ where: { id: roomId } });

  redirect("/");
}

export async function leaveRoom(roomId: string) {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Not signed in.");

  await prisma.participant.deleteMany({
    where: { roomId, userId: user.id },
  });

  redirect("/");
}