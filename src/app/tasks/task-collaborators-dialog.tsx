"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { MemberRole } from "@prisma/client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/server/api/react";
import { toast } from "@/lib/toast";

interface TaskCollaboratorsDialogProps {
  open: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  [MemberRole.OWNER]: "Owner",
  [MemberRole.EDITOR]: "Editor",
  [MemberRole.VIEWER]: "Viewer",
};

const ASSIGNABLE_ROLES: MemberRole[] = [
  MemberRole.OWNER,
  MemberRole.EDITOR,
  MemberRole.VIEWER,
];

export function TaskCollaboratorsDialog({ open, onClose }: TaskCollaboratorsDialogProps) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const { data: tasks = [], isLoading: tasksLoading } = api.task.catalog.useQuery(undefined, {
    enabled: open,
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>(MemberRole.EDITOR);

  useEffect(() => {
    if (!open) {
      setInviteEmail("");
      setInviteRole(MemberRole.EDITOR);
      return;
    }
    if (tasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }
    setSelectedTaskId((prev) => {
      if (prev && tasks.some((task) => task.id === prev)) return prev;
      return tasks[0]?.id ?? null;
    });
  }, [open, tasks]);

  const membersQuery = api.task.members.useQuery(
    { taskId: selectedTaskId ?? "" },
    { enabled: open && Boolean(selectedTaskId) },
  );

  const invite = api.task.inviteMember.useMutation({
    onSuccess: async () => {
      toast.success("Invite sent");
      if (selectedTaskId) {
        await utils.task.members.invalidate({ taskId: selectedTaskId });
      }
      setInviteEmail("");
      setInviteRole(MemberRole.EDITOR);
    },
    onError: (error) => toast.error(error.message || "Unable to invite collaborator"),
  });

  const updateRole = api.task.updateMemberRole.useMutation({
    onError: (error) => toast.error(error.message || "Unable to update role"),
    onSuccess: async (_, variables) => {
      toast.success("Updated role");
      await utils.task.members.invalidate({ taskId: variables.taskId });
    },
  });

  const removeMember = api.task.removeMember.useMutation({
    onError: (error) => toast.error(error.message || "Unable to remove member"),
    onSuccess: async (_, variables) => {
      toast.success("Removed member");
      await utils.task.members.invalidate({ taskId: variables.taskId });
    },
  });

  const footer = useMemo(
    () => (
      <Button variant="tertiary" onClick={onClose}>
        Close
      </Button>
    ),
    [onClose],
  );

  return (
    <Modal open={open} onClose={onClose} title="Share tasks" footer={footer}>
      {tasksLoading ? (
        <p className="text-sm text-muted-foreground">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Create a task to start inviting collaborators.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="task-select" className="text-sm font-medium">
              Task
            </label>
            <select
              id="task-select"
              value={selectedTaskId ?? ""}
              onChange={(event) => setSelectedTaskId(event.target.value || null)}
              className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700"
            >
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Collaborators</h3>
            {membersQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading collaborators…</p>
            ) : (membersQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No collaborators yet.</p>
            ) : (
              <ul className="space-y-2">
                {membersQuery.data?.map((member) => {
                  const isSelf = member.userId === session?.user?.id;
                  return (
                    <li
                      key={member.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                    >
                      <div className="space-y-0.5">
                        <p className="font-medium">
                          {member.user?.name ?? member.user?.email ?? "Unknown user"}
                          {isSelf ? " (you)" : ""}
                        </p>
                        {member.user?.email && (
                          <p className="text-xs text-muted-foreground">{member.user.email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Change role"
                          disabled={isSelf || updateRole.isPending}
                          value={member.role}
                          onChange={(event) => {
                            if (!selectedTaskId) return;
                            const nextRole = event.target.value as MemberRole;
                            updateRole.mutate({
                              taskId: selectedTaskId,
                              userId: member.userId,
                              role: nextRole,
                            });
                          }}
                          className="rounded-md border border-slate-200 bg-transparent px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700"
                        >
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="tertiary"
                          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                          disabled={isSelf || removeMember.isPending}
                          onClick={() => {
                            if (!selectedTaskId) return;
                            removeMember.mutate({ taskId: selectedTaskId, userId: member.userId });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-medium">Invite collaborator</h3>
            <div className="space-y-1">
              <label htmlFor="invite-email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@example.com"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="invite-role" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as MemberRole)}
                className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <Button
              disabled={invite.isPending || !inviteEmail || !selectedTaskId}
              onClick={() => {
                if (!selectedTaskId || !inviteEmail) return;
                invite.mutate({
                  taskId: selectedTaskId,
                  email: inviteEmail,
                  role: inviteRole,
                });
              }}
            >
              {invite.isPending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default TaskCollaboratorsDialog;
