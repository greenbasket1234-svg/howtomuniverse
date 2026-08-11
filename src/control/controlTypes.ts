export type ControlUserStatus = 'active' | 'invited' | 'disabled';
export type RoleScope = 'internal' | 'advertiser';
export type PermissionAction = 'view' | 'create' | 'edit' | 'approve' | 'manage';
export type FeatureFlagState = 'disabled' | 'internal' | 'beta' | 'public';

export type OrganizationSettings = {
  timezone: string;
  currency: string;
  locale: string;
  defaultLanding: string;
  dateFormat: string;
  displayDensity: 'comfortable' | 'compact';
  sessionTimeoutMinutes: number;
  advertiserDataPolicy: 'assigned-only' | 'all-internal';
};

export type Organization = {
  organizationId: string;
  name: string;
  legalName?: string;
  businessNumber?: string;
  phone?: string;
  website?: string;
  address?: string;
  logoAssetId?: string;
  settings: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
};

export type ControlUser = {
  userId: string;
  name: string;
  email?: string;
  title?: string;
  department?: string;
  status: ControlUserStatus;
  avatarUrl?: string;
  lastLoginAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Membership = {
  membershipId: string;
  organizationId: string;
  userId: string;
  roleIds: string[];
  advertiserIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type RoleDefinition = {
  roleId: string;
  name: string;
  description: string;
  scope: RoleScope;
  permissionKeys: string[];
  system?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FeaturePermission = {
  featureKey: string;
  label: string;
  group: string;
  actions: PermissionAction[];
  advertiserVisible?: boolean;
};

export type ExternalContact = {
  contactId: string;
  advertiserId: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdvertiserWorkspace = {
  workspaceId: string;
  advertiserId: string;
  status: 'active' | 'paused' | 'archived';
  internalManagerIds: string[];
  externalContactIds: string[];
  permissionSetId?: string;
  portalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdvertiserFeatureAccess = {
  advertiserId: string;
  featureKey: string;
  enabled: boolean;
  limit?: number;
  updatedAt: string;
};

export type SharedAssetRelation = {
  shareId: string;
  advertiserId: string;
  assetId: string;
  label?: string;
  audience: 'advertiser' | 'internal';
  status: 'shared' | 'hidden';
  createdAt: string;
  updatedAt: string;
};

export type ApprovalRequest = {
  approvalId: string;
  advertiserId: string;
  targetType: 'monthly-report' | 'proposal' | 'creative' | 'copy' | 'blog' | 'document';
  targetId?: string;
  title: string;
  status: 'pending' | 'approved' | 'revision_requested' | 'cancelled';
  requestedBy?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanEntitlement = {
  featureKey: string;
  enabled: boolean;
  limit?: number;
  unit?: string;
};

export type SubscriptionPlanDefinition = {
  planId: string;
  name: string;
  description?: string;
  monthlyPrice?: number;
  vatIncluded?: boolean;
  status: 'draft' | 'active' | 'archived';
  entitlements: PlanEntitlement[];
  createdAt: string;
  updatedAt: string;
};

export type FeatureFlag = {
  featureKey: string;
  label: string;
  state: FeatureFlagState;
  allowedUserIds?: string[];
  allowedAdvertiserIds?: string[];
  updatedAt: string;
};

export type Notice = {
  noticeId: string;
  title: string;
  body: string;
  audience: 'internal' | 'advertiser' | 'all';
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
};

export type AuditEvent = {
  auditId: string;
  actorId?: string;
  organizationId?: string;
  advertiserId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  result: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type SecurityPolicy = {
  sessionTimeoutMinutes: number;
  requireApprovalForExternalShare: boolean;
  maskSensitiveInfo: boolean;
  allowLocalSecretStorage: false;
  twoFactorEnabled: false;
  ssoEnabled: false;
};
