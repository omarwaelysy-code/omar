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

    if (decoded?.email) {
      try {
        const superCheck = await pool.query(
          "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND (role = 'super_admin' OR company_id = 'system' OR company_id = 'SYSTEM') LIMIT 1",
          [decoded.email]
        );
        if (superCheck.rows.length > 0 || decoded.role === 'super_admin') {
          (req.user as any).is_super_admin = true;
        }
      } catch (e) {
        // silent catch
      }
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

    // Resolve company_id from 'x-company-id' header if present to support seamless workspace switching
    const requestedCompanyId = req.headers['x-company-id'] as string;
    if (requestedCompanyId && requestedCompanyId !== decoded.company_id) {
      const isSuperAdminRole = decoded.role === 'super_admin' || (req.user as any)?.is_super_admin === true;
      
      try {
        const userRes = await pool.query('SELECT role FROM users WHERE email = $1 AND company_id = $2', [decoded.email, requestedCompanyId]);
        if (userRes.rows.length > 0) {
          req.user.company_id = requestedCompanyId;
          req.user.role = isSuperAdminRole ? 'super_admin' : userRes.rows[0].role;
        } else if (isSuperAdminRole) {
          req.user.company_id = requestedCompanyId;
          req.user.role = 'super_admin';
        }
      } catch (dbErr) {
        console.error('Error switching company context in middleware:', dbErr);
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
 * For non-super-admin: req.user.company_id is strictly authoritative.
 * Client-supplied headers (x-company-id), query parameters (?company_id=),
 * or body properties are NEVER trusted to switch tenant.
 * 
 * For verified super_admin: allows cross-company targeting if explicitly supplied.
 * Never mutates req.user.
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
  return req.user.company_id;
}

