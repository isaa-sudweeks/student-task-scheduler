import { TRPCError } from '@trpc/server';
import { MemberRole } from '@prisma/client';
import { db } from '@/server/db';

const ANY_ROLES = [MemberRole.OWNER, MemberRole.EDITOR, MemberRole.VIEWER] as const;

type RoleSubset = readonly MemberRole[];

function normalizeRoles(roles?: RoleSubset) {
  return roles && roles.length > 0 ? roles : ANY_ROLES;
}

export async function assertTaskMember({
  userId,
  taskId,
  roles,
}: {
  userId: string;
  taskId: string;
  roles?: RoleSubset;
}) {
  const membership = await db.taskMember.findFirst({
    where: { taskId, userId, role: { in: normalizeRoles(roles) } },
    select: { id: true, role: true },
  });
  if (!membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this task.',
    });
  }
  return membership;
}

export async function assertTaskOwner({
  userId,
  taskId,
}: {
  userId: string;
  taskId: string;
}) {
  return assertTaskMember({ userId, taskId, roles: [MemberRole.OWNER] });
}

export async function assertProjectMember({
  userId,
  projectId,
  roles,
}: {
  userId: string;
  projectId: string;
  roles?: RoleSubset;
}) {
  const membership = await db.projectMember.findFirst({
    where: { projectId, userId, role: { in: normalizeRoles(roles) } },
    select: { id: true, role: true },
  });
  if (!membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this project.',
    });
  }
  return membership;
}

export async function assertProjectOwner({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) {
  return assertProjectMember({ userId, projectId, roles: [MemberRole.OWNER] });
}

export async function assertCourseMember({
  userId,
  courseId,
  roles,
}: {
  userId: string;
  courseId: string;
  roles?: RoleSubset;
}) {
  const membership = await db.courseMember.findFirst({
    where: { courseId, userId, role: { in: normalizeRoles(roles) } },
    select: { id: true, role: true },
  });
  if (!membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this course.',
    });
  }
  return membership;
}

export async function assertCourseOwner({
  userId,
  courseId,
}: {
  userId: string;
  courseId: string;
}) {
  return assertCourseMember({ userId, courseId, roles: [MemberRole.OWNER] });
}
