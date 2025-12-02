/**
 * Simple Access Code Middleware
 * 
 * Validates access code from request header or query parameter
 * Used to protect API endpoints during beta/demo phase
 */

const ACCESS_CODE = process.env.ACCESS_CODE || 'chess2024';

function checkAccessCode(req, res, next) {
  // Get code from header or query parameter
  const code = req.headers['x-access-code'] || req.query.code;
  
  // Allow health check endpoint without code
  if (req.path === '/health' || req.path === '/') {
    return next();
  }
  
  // Validate code
  if (code !== ACCESS_CODE) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Invalid or missing access code'
    });
  }
  
  next();
}

module.exports = { checkAccessCode };
