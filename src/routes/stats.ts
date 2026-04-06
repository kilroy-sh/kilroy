import { Hono } from "hono";
import { client } from "../db";

export const statsRouter = new Hono();

statsRouter.get("/", async (c) => {
  const [row] = await client`
    SELECT
      (SELECT count(*) FROM projects)::int AS projects,
      (SELECT count(*) FROM posts)::int + (SELECT count(*) FROM comments)::int AS writes_total,
      (SELECT count(*) FROM posts WHERE created_at > now() - interval '24 hours')::int +
      (SELECT count(*) FROM comments WHERE created_at > now() - interval '24 hours')::int AS writes_24h
  `;

  return c.json({
    projects: row.projects,
    writes: { total: row.writes_total, last24h: row.writes_24h },
  });
});
