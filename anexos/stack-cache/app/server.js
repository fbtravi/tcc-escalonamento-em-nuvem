const express = require("express");
const { createClient } = require("redis");

const app = express();
const port = Number(process.env.PORT || 3000);
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const cacheTtlSeconds = Number(process.env.CACHE_TTL_SECONDS || 90);

const redisClient = createClient({ url: redisUrl });
redisClient.on("error", (err) => {
  console.error("Redis error:", err.message);
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOddsFromUpstream(matchId) {
  // Simulates expensive external aggregation/normalization.
  await delay(1200);

  const base = Number(matchId) % 5;
  return {
    matchId,
    home: (1.5 + base * 0.1).toFixed(2),
    draw: (2.8 + base * 0.1).toFixed(2),
    away: (3.2 + base * 0.1).toFixed(2),
    generatedAt: new Date().toISOString()
  };
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/v1/odds/:matchId", async (req, res) => {
  const { matchId } = req.params;
  const key = `odds:${matchId}`;

  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return res.json({ source: "redis", data: JSON.parse(cached) });
    }

    const odds = await fetchOddsFromUpstream(matchId);
    await redisClient.setEx(key, cacheTtlSeconds, JSON.stringify(odds));

    return res.json({ source: "upstream", data: odds });
  } catch (error) {
    return res.status(500).json({ error: "internal_error", detail: error.message });
  }
});

async function start() {
  await redisClient.connect();
  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});
