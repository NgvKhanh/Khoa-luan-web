import { api } from '../axios';
import type { TeamDetail, TeamListItem, TeamMember, TeamRole } from '../../types/team';

export async function fetchMyTeams(): Promise<TeamListItem[]> {
  const res = await api.get<{ data: { teams: TeamListItem[] } }>('/teams');
  return res.data.data.teams;
}

export async function fetchTeamDetail(teamId: string): Promise<TeamDetail> {
  const res = await api.get<{ data: { team: TeamDetail } }>(`/teams/${teamId}`);
  return res.data.data.team;
}

export async function createTeam(input: {
  name: string;
  description?: string;
}): Promise<TeamListItem> {
  const res = await api.post<{ data: { team: TeamListItem } }>('/teams', input);
  return res.data.data.team;
}

export async function updateTeam(
  teamId: string,
  input: { name?: string; description?: string | null }
): Promise<TeamDetail> {
  const res = await api.patch<{ data: { team: TeamDetail } }>(
    `/teams/${teamId}`,
    input
  );
  return res.data.data.team;
}

export async function deleteTeam(teamId: string): Promise<void> {
  await api.delete(`/teams/${teamId}`);
}

export async function addTeamMember(
  teamId: string,
  email: string
): Promise<TeamMember> {
  const res = await api.post<{ data: { membership: TeamMember } }>(
    `/teams/${teamId}/members`,
    { email }
  );
  return res.data.data.membership;
}

export async function removeTeamMember(
  teamId: string,
  userId: string
): Promise<void> {
  await api.delete(`/teams/${teamId}/members/${userId}`);
}

export async function updateMemberRole(
  teamId: string,
  userId: string,
  role: TeamRole
): Promise<TeamMember> {
  const res = await api.patch<{ data: { membership: TeamMember } }>(
    `/teams/${teamId}/members/${userId}/role`,
    { role }
  );
  return res.data.data.membership;
}
