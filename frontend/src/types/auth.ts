export interface Organization {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  type: string;
}

export interface MeResponse {
  user: { id: string; email: string; name: string };
  organizations: Organization[];
  projectsByOrg: Record<string, Project[]>;
}

export interface AuthSession {
  token: string;
  projectId: string | null;
  orgId: string | null;
}
