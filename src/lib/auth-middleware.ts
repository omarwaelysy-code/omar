import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LicensingMiddleware } from './subscription/middlewares/LicensingMiddleware';
import { FeatureFlagMiddleware } from './subscription/middlewares/FeatureFlagMiddleware';
import pool from './postgres';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username?: string;
    company_id?: string;
    role: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;

    // Resolve company_id from 'x-company-id' header if present to support seamless workspace switching
    const requestedCompanyId = req.headers['x-company-id'] as string;
    if (requestedCompanyId && requestedCompanyId !== decoded.company_id) {
      const isSuperAdminEmail = decoded.email === 'omarwaelysy@gmail.com' || decoded.email === 'omarwaelsys@gmail.com' || decoded.email === 'acc.wael2005@gmail.com';
      
      try {
        const userRes = await pool.query('SELECT role FROM users WHERE email = $1 AND company_id = $2', [decoded.email, requestedCompanyId]);
        if (userRes.rows.length > 0) {
          req.user.company_id = requestedCompanyId;
          req.user.role = isSuperAdminEmail ? 'super_admin' : userRes.rows[0].role;
        } else if (isSuperAdminEmail) {
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
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};
