export async function getEnrichedTaskForOwner(env, ownerUserId, taskId = "") {
  const baseSql = `
    SELECT
      t.*,
      c.session_date,
      c.start_time,
      c.end_time,
      c.room,
      COALESCE(e.employee_name, eu.name) AS employee_name,
      mu.name AS mentor_name,
      COALESCE(e.employee_name, eu.name) AS target_name
    FROM tasks t
    LEFT JOIN checkpoints c ON c.checkpoint_id = t.checkpoint_id
    LEFT JOIN employees e ON e.employee_id = t.employee_id
    LEFT JOIN users eu ON eu.user_id = e.user_id
    LEFT JOIN users mu ON mu.user_id = t.mentor_user_id
  `;
  if (taskId) {
    return env.DB.prepare(`
      ${baseSql}
      WHERE t.owner_user_id = ? AND t.task_id = ?
      LIMIT 1
    `).bind(ownerUserId, taskId).first();
  }
  return env.DB.prepare(`
    ${baseSql}
    WHERE t.owner_user_id = ? AND t.status IN ('Pending', 'Open')
    ORDER BY t.due_date ASC, t.created_at ASC
    LIMIT 1
  `).bind(ownerUserId).first();
}
