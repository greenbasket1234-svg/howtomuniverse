import type { ControlUser, Organization, RoleDefinition } from './controlTypes';
import { loadControlUsers, loadOrganization, loadRoles, saveControlUsers, saveOrganization, saveRoles } from './controlStore';

export interface UserRepository {
  list(): Promise<ControlUser[]>;
  save(rows:ControlUser[]): Promise<void>;
}
export interface OrganizationRepository {
  get(): Promise<Organization>;
  save(value:Organization): Promise<void>;
}
export interface RoleRepository {
  list(): Promise<RoleDefinition[]>;
  save(rows:RoleDefinition[]): Promise<void>;
}

export class LocalUserRepository implements UserRepository {
  async list(){return loadControlUsers();}
  async save(rows:ControlUser[]){saveControlUsers(rows);}
}
export class LocalOrganizationRepository implements OrganizationRepository {
  async get(){return loadOrganization();}
  async save(value:Organization){saveOrganization(value);}
}
export class LocalRoleRepository implements RoleRepository {
  async list(){return loadRoles();}
  async save(rows:RoleDefinition[]){saveRoles(rows);}
}

/**
 * 백엔드 전환 시 같은 인터페이스의 Api*Repository로 교체합니다.
 * 현재 프론트엔드 Ver.1에서는 비밀키·인증 토큰을 브라우저에 저장하지 않습니다.
 */
export function createControlRepositories(){
  return {
    users:new LocalUserRepository(),
    organization:new LocalOrganizationRepository(),
    roles:new LocalRoleRepository(),
  };
}
