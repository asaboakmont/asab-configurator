export type PortalRole = 'admin' | 'designer' | 'dealer' | 'technician';
export type ProjectStatus = 'draft' | 'verification_requested' | 'changes_requested' | 'verified' | 'quoted' | 'ordered' | 'completed' | 'archived';
export interface PortalProject {
  id: string;
  owner_id: string;
  title: string;
  status: ProjectStatus;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface PortalProfile { id: string; display_name: string; phone: string; city: string; created_at: string }
export interface PortalMembership { organization_id: string; user_id: string; role: PortalRole; active: boolean }
export interface ConfigurationRevision {
  id: string;
  project_id: string;
  revision: number;
  configuration: Record<string, unknown>;
  created_by: string;
  created_at: string;
}
