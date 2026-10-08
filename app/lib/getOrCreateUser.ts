import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";

export async function getOrCreateUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {
      email,
      name: clerkUser.firstName ?? undefined,
    },
    create: {
      clerkId: clerkUser.id,
      email,
      name: clerkUser.firstName ?? undefined,
    },
  });

  return user;
}