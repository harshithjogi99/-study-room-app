import { redirect, notFound } from "next/navigation";
import { prisma } from "../../lib/prisma";

export default async function ShortRoomLink({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const room = await prisma.room.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true },
  });

  if (!room) {
    notFound();
  }

  redirect(`/room/${room.id}`);
}