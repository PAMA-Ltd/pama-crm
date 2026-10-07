"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import PageHeader from "@/components/crm/page-header";
import { useWorkspace } from "@/components/crm/workspace-provider";
import {
  inviteOrganizationMember,
  listOrganizationMembers,
  type OrganizationRole,
} from "@/lib/convex/organizations";
import { createTeam, listTeams } from "@/lib/convex/teams";

export default function TeamPage() {
  const { organization } = useWorkspace();
  const members =
    useQuery(listOrganizationMembers, { organizationId: organization._id }) ?? [];
  const teams = useQuery(listTeams, { organizationId: organization._id }) ?? [];
  const invite = useMutation(inviteOrganizationMember);
  const create = useMutation(createTeam);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>("member");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await invite({ organizationId: organization._id, email, role });
      setEmail("");
      setInviteOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to invite member.",
      );
    }
  }

  async function submitTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await create({ organizationId: organization._id, name: teamName });
      setTeamName("");
      setTeamOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create team.",
      );
    }
  }

  const teamNameById = new Map(teams.map((team) => [team._id, team.name]));

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title="Team"
        description={`${members.length} members across ${teams.length} teams`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setTeamOpen(true)}>
              New Team
            </Button>
            <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
              Invite teammate
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-5xl space-y-4">
          {teams.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <article
                  key={team._id}
                  className="border-line-strong bg-card rounded-xl border p-4"
                >
                  <h2>{team.name}</h2>
                  <p className="caption-style text-subtle mt-1">
                    {team.memberCount}{" "}
                    {team.memberCount === 1 ? "member" : "members"}
                  </p>
                  {team.description && (
                    <p className="text-soft mt-3">{team.description}</p>
                  )}
                </article>
              ))}
            </div>
          )}

          <section className="border-line-strong bg-card overflow-hidden rounded-xl border">
            <div className="border-border border-b p-4">
              <h2>Organization members</h2>
            </div>
            <div className="divide-border divide-y">
              {members.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {member.name || member.email || "CRM member"}
                    </p>
                    <p className="caption-style text-subtle mt-1 truncate">
                      {member.email || member.userSubject}
                    </p>
                  </div>
                  <div className="caption-style text-soft flex items-center gap-3">
                    <span>
                      {member.teamId
                        ? teamNameById.get(member.teamId) ?? "Team"
                        : "No team"}
                    </span>
                    <span className="capitalize">{member.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite teammate</DialogTitle>
            <DialogDescription>
              The invite is tied to the email address they use to sign in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitInvite}>
            <div className="grid gap-4 p-6">
              <Field label="Email" htmlFor="invite-email" required>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <Field label="Role" htmlFor="invite-role">
                <select
                  id="invite-role"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as OrganizationRole)
                  }
                  className="border-line-strong bg-secondary text-foreground h-10 rounded-lg border px-3 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </Field>
              {error && <p className="caption-style text-danger">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
            <DialogDescription>
              Create a real team for this workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTeam}>
            <div className="p-6">
              <Field label="Team name" htmlFor="team-name" required>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  required
                  autoFocus
                />
              </Field>
            </div>
            <DialogFooter>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setTeamOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create team
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
