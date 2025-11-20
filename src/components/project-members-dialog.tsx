"use client";

import React, { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { MemberRole } from "@prisma/client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/server/api/react";
import { toast } from "@/lib/toast";

interface ProjectMembersDialogProps {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  [MemberRole.OWNER]: "Owner",
  [MemberRole.EDITOR]: "Editor",
  [MemberRole.VIEWER]: "Viewer",
};

const ROLES: MemberRole[] = [MemberRole.OWNER, MemberRole.EDITOR, MemberRole.VIEWER];

export function ProjectMembersDialog({
  projectId,
  projectTitle,
  open,
  onClose,
}: ProjectMembersDialogProps) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>(MemberRole.EDITOR);

  const membersQuery = api.project.members.useQuery(
    { projectId },
    { enabled: open },
  );

  const invite = api.project.inviteMember.useMutation({
    onSuccess: async () => {
      toast.success("Collaborator added");
      await utils.project.members.invalidate({ projectId });
      setEmail("");
      setRole(MemberRole.EDITOR);
    },
    onError: (error) => toast.error(error.message || "Unable to invite collaborator"),
  });

  const updateRole = api.project.updateMemberRole.useMutation({
    onSuccess: async () => {
      toast.success("Updated role");
      await utils.project.members.invalidate({ projectId });
    },
    onError: (error) => toast.error(error.message || "Unable to update role"),
  });

  const removeMember = api.project.removeMember.useMutation({
    onSuccess: async () => {
      toast.success("Removed collaborator");
      await utils.project.members.invalidate({ projectId });
    },
    onError: (error) => toast.error(error.message || "Unable to remove collaborator"),
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
    <Modal open={open} onClose={onClose} title={`Share “${projectTitle}”`} footer={footer}>
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Members</h3>
          {membersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
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
                        onChange={(event) =>
                          updateRole.mutate({
                            projectId,
                            userId: member.userId,
                            role: event.target.value as MemberRole,
                          })
                        }
                        className="rounded-md border border-slate-200 bg-transparent px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700"
                      >
                        {ROLES.map((memberRole) => (
                          <option key={memberRole} value={memberRole}>
                            {ROLE_LABELS[memberRole]}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="tertiary"
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                        disabled={isSelf || removeMember.isPending}
                        onClick={() =>
                          removeMember.mutate({ projectId, userId: member.userId })
                        }
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
            <label htmlFor="project-invite-email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </label>
            <Input
              id="project-invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="project-invite-role" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Role
            </label>
            <select
              id="project-invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as MemberRole)}
              className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700"
            >
              {ROLES.map((memberRole) => (
                <option key={memberRole} value={memberRole}>
                  {ROLE_LABELS[memberRole]}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={invite.isPending || !email}
            onClick={() =>
              invite.mutate({ projectId, email, role })
            }
          >
            {invite.isPending ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ProjectMembersDialog;
