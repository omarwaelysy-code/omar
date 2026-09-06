import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LicensingMiddleware } from './subscription/middlewares/LicensingMiddleware';
import { FeatureFlagMiddleware } from './subscription/middlewares/FeatureFlagMiddleware';
import pool from './postgres';
import { getJwtSecret } from './env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username?: string;
    company_id?: string;
    role: string;
    is_super_admin?: boolean;
    authorized_company_ids?: string[];
    permissions?: any;
    role_ids?: string[];
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.user = decoded;

    let authorizedCompanyIds: string[] = [];
    let isSuperAdminAccount = decoded.role === 'super_admin' || decoded.is_super_admin === true;

    if (decoded?.email) {
      try {
        const userMembershipsRes = await pool.query(
          `SELECT id, company_id, role, permissions, role_ids 
           FROM users 
           WHERE LOWER(email) = LOWER($1) AND company_id IS NOT NULL`,
          [decoded.email]
        );

        authorizedCompanyIds = userMembershipsRes.rows
          .map((r: any) => r.company_id)
          .filter(Boolean);

        if (decoded.company_id && !authorizedCompanyIds.includes(decoded.company_id)) {
          authorizedCompanyIds.push(decoded.company_id);
        }

        if (
          !isSuperAdminAccount &&
          userMembershipsRes.rows.some((r: any) => r.role === 'super_admin' || r.company_id?.toLowerCase() === 'system')
        ) {
          isSuperAdminAccount = true;
        }

        (req.user as any).authorized_company_ids = authorizedCompanyIds;
        if (isSuperAdminAccount) {
          (req.user as any).is_super_admin = true;
        }

        // Resolve requested company context: prioritize header, then query, then body
        const headerCompanyId = (req.headers['x-company-id'] as string)?.trim();
        const queryCompanyId = (req.query?.company_id as string)?.trim();
        const bodyCompanyId = (typeof req.body?.company_id === 'string' ? req.body.company_id : undefined)?.trim();
        const requestedCompanyId = headerCompanyId || queryCompanyId || bodyCompanyId;

        if (requestedCompanyId && requestedCompanyId !== decoded.company_id) {
          if (isSuperAdminAccount) {
            req.user.company_id = requestedCompanyId;
            req.user.role = 'super_admin';
          } else if (authorizedCompanyIds.includes(requestedCompanyId)) {
            const membership = userMembershipsRes.rows.find((r: any) => r.company_id === requestedCompanyId);
            req.user.company_id = requestedCompanyId;
            if (membership) {
              req.user.id = membership.id;
              req.user.role = membership.role;
              (req.user as any).permissions = membership.permissions;
              (req.user as any).role_ids = membership.role_ids;
            }
          }
          // If requestedCompanyId is NOT in authorizedCompanyIds:
          // Tenant isolation is preserved: req.user.company_id remains decoded.company_id
        }
      } catch (e) {
        console.error('Error in user authorization/membership resolution:', e);
      }
    }

    if (!req.user.authorized_company_ids) {
      (req.user as any).authorized_company_ids = decoded.company_id ? [decoded.company_id] : [];
    }

    // ================================================================
    // SESSION VALIDATION: Ensure this token's session_token still matches
    // the active_session_token in the database. If a force-login happened
    // from another device, the DB token will differ and we reject old tokens.
    // ================================================================
    if (decoded.session_token && decoded.id) {
      try {
        const sessionRes = await pool.query(
          'SELECT active_session_token FROM users WHERE id = $1 LIMIT 1',
          [decoded.id]
        );
        if (sessionRes.rows.length > 0) {
          const dbToken = sessionRes.rows[0].active_session_token;
          // If DB has a token and it doesn't match our JWT's token → session was invalidated
          if (dbToken && dbToken !== decoded.session_token) {
            return res.status(401).json({ 
              error: 'SESSION_INVALIDATED',
              message: 'تم تسجيل دخولك من مكان آخر. تم إنهاء هذه الجلسة.'
            });
          }
        }
      } catch (sessionErr) {
        // Non-fatal: if DB check fails, allow request to proceed
        console.error('Session validation error (non-fatal):', sessionErr);
      }
    }
    
    // Enforce Licensing and Feature Flags
    LicensingMiddleware(req as AuthRequest, res, (err?: any) => {
      if (err) return next(err);
      FeatureFlagMiddleware(req as AuthRequest, res, (err2?: any) => {
        if (err2) return next(err2);
        next();
      });
    });
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const isSuperAdminAccount = req.user?.role === 'super_admin' || (req.user as any)?.is_super_admin === true;
    if (!req.user || (!roles.includes(req.user.role) && !(roles.includes('super_admin') && isSuperAdminAccount))) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

/**
 * SECURITY P0-1 / P0-13: Authoritative Tenant Resolution Helper
 * 
 * Resolves the active company ID safely:
 * - For super_admin: allows cross-company targeting if explicitly supplied.
 * - For normal users: allows switching ONLY to companies the user is explicitly authorized to access.
 * - If client requests an unauthorized company (via header, query, or body), the request is rejected/ignored
 *   and scoped strictly to the user's authenticated/authorized company.
 */
export function getAuthenticatedCompanyId(req: AuthRequest, allowSuperAdminOverride: boolean = true): string | undefined {
  if (!req.user) return undefined;
  const isSuperAdmin = req.user.role === 'super_admin' || (req.user as any)?.is_super_admin === true;
  if (isSuperAdmin && allowSuperAdminOverride) {
    const rawOverride = (req.query?.company_id as string) || (req.headers?.['x-company-id'] as string) || (req.body?.company_id as string);
    if (typeof rawOverride === 'string' && rawOverride.trim() !== '') {
      return rawOverride.trim();
    }
  }

  const authorizedCompanies: string[] = (req.user as any)?.authorized_company_ids || (req.user.company_id ? [req.user.company_id] : []);
  const requested = ((req.headers?.['x-company-id'] as string) || (req.query?.company_id as string) || (req.body?.company_id as string))?.trim();
  
  if (requested && authorizedCompanies.includes(requested)) {
    return requested;
  }

  return req.user.company_id;
}

