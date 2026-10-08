import { prisma } from "../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const participants = await prisma.participant.findMany({
    where: { roomId: id },
    include: { user: true },
  });

  return NextResponse.json(participants);
}