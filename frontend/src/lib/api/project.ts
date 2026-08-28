import { api } from '../axios';
import type {
  ProjectDetail,
  ProjectListItem,
  ProjectMember,
  ProjectRole,
} from '../../types/project';

export async function fetchMyProjects(): Promise<ProjectListItem[]> {
  const res = await api.get<{ data: { projects: ProjectListItem[] } }>(
    '/projects'
  );
  return res.data.data.projects;
}

export async function fetchProjectDetail(
  projectId: string
): Promise<ProjectDetail> {
  const res = await api.get<{ data: { project: ProjectDetail } }>(
    `/projects/${projectId}`
  );
  return res.data.data.project;
}

export async function createProject(input: {
  teamId: string;
  name: string;
  description?: string;
}): Promise<ProjectListItem> {
  const res = await api.post<{ data: { project: ProjectListItem } }>(
    '/projects',
    input
  );
  return res.data.data.project;
}

export async function updateProject(
  projectId: string,
  input: { name?: string; description?: string | null }
): Promise<ProjectDetail> {
  const res = await api.patch<{ data: { project: ProjectDetail } }>(
    `/projects/${projectId}`,
    input
  );
  return res.data.data.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await api.delete(`/projects/${projectId}`);
}

// Ghim / bo ghim (danh sao) 1 bang cho rieng nguoi dung hien tai
export async function setProjectStar(
  projectId: string,
  starred: boolean
): Promise<void> {
  await api.patch(`/projects/${projectId}/star`, { starred });
}

export async function addProjectMember(
  projectId: string,
  email: string
): Promise<ProjectMember> {
  const res = await api.post<{ data: { membership: ProjectMember } }>(
    `/projects/${projectId}/members`,
    { email }
  );
  return res.data.data.membership;
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<void> {
  await api.delete(`/projects/${projectId}/members/${userId}`);
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectRole
): Promise<ProjectMember> {
  const res = await api.patch<{ data: { membership: ProjectMember } }>(
    `/projects/${projectId}/members/${userId}/role`,
    { role }
  );
  return res.data.data.membership;
}
