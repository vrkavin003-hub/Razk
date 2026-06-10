const { query } = require("../db");

const auditLog = async ({ req, action, entityType, entityId = null, metadata = null }) => {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
       VALUES (:userId, :action, :entityType, :entityId, :ip, :userAgent, :metadata)`,
      {
        action,
        entityId,
        entityType,
        ip: req?.ip || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        userAgent: req?.get?.("user-agent")?.slice(0, 255) || null,
        userId: req?.user?.id || null
      }
    );
  } catch (error) {
    console.warn(`Audit log failed: ${error.message}`);
  }
};

module.exports = auditLog;
