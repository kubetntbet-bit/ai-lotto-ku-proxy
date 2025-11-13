import axios from "axios";
import * as cheerio from "cheerio";

const KU_URL =
  "https://cuthal.loxinmysy.com/share/aspx/LotteryResults.aspx?game=226";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const response = await axios.get(KU_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html"
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const table = $("table").first();
    const rows = table.find("tr");

    if (rows.length < 2) {
      return res.status(500).json({
        error: "ไม่พบข้อมูล KU",
        note: "โครงสร้างหน้าเว็บ KU อาจเปลี่ยน"
      });
    }

    const last = rows.eq(rows.length - 1).find("td");

    const roundText = $(last[0]).text().trim();
    const rawTop = $(last[1]).text().trim();
    const rawBot = $(last[2]).text().trim();

    const top2 = rawTop.replace(/\D/g, "").slice(-2);
    const bot2 = rawBot.replace(/\D/g, "").slice(-2);

    res.status(200).json({
      round: roundText,
      top2,
      bot2,
      rawTop,
      rawBot
    });

  } catch (e) {
    res.status(500).json({
      error: "KU proxy error",
      detail: e.message
    });
  }
}
