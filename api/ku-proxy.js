// api/ku-proxy.js
// Proxy ดึงผล "หวยไทย 1 นาที" แล้วแปลงเป็น JSON ให้ Auto Mode ใช้

const TARGET_URL =
  "https://cuthal.loxinmysy.com/share/aspx/LotteryResults.aspx?game=226";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function cleanCell(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "") // กันสคริปต์
    .replace(/<style[\s\S]*?<\/style>/gi, "")  // กันสไตล์
    .replace(/<[^>]+>/g, "")                  // ตัดแท็ก HTML
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function handler(req, res) {
  try {
    const upstream = await fetch(TARGET_URL, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        message: "Upstream error: " + upstream.status,
      });
    }

    const html = await upstream.text();

    // ดึงทุก <tr> จากตารางในหน้า
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let m;
    while ((m = trRegex.exec(html))) {
      rows.push(m[0]);
    }

    // หาแถวผลหวย “จริง” แถวแรกที่น่าจะใช่
    let picked = null;
    for (const rowHtml of rows) {
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cellsHtml = [];
      let tdm;
      while ((tdm = tdRegex.exec(rowHtml))) {
        cellsHtml.push(tdm[1]);
      }
      if (cellsHtml.length < 6) continue; // ต้องมีอย่างน้อย 6 คอลัมน์

      const cells = cellsHtml.map(cleanCell);

      // cells[2] = รางวัลที่ 1 ควรมีเลขอย่างน้อย 6 หลักติดกัน
      const prize1Digits = (cells[2] || "").replace(/\D/g, "");
      if (prize1Digits.length < 6) continue;

      // cells[5] = 2 ตัวล่าง ควรมีเลขอย่างน้อย 2 หลัก
      const last2Digits = (cells[5] || "").replace(/\D/g, "");
      if (last2Digits.length < 2) continue;

      // ผ่านเงื่อนไขแล้ว ใช้แถวนี้เลย
      picked = cells;
      break;
    }

    if (!picked) {
      return res.status(500).json({
        ok: false,
        message: "ไม่พบแถวผลหวยใน HTML (ลองเช็กโครงสร้างตารางอีกครั้ง)",
      });
    }

    const [roundId, time, prize1, front3, back3, last2raw] = picked;

    const prize1Digits = String(prize1).replace(/\D/g, "");
    const top2 = prize1Digits.slice(-2); // 2 ตัวบน = 2 ตัวท้ายรางวัลที่ 1
    const bot2 = String(last2raw).replace(/\D/g, "").slice(-2); // 2 ตัวล่าง = คอลัมน์สุดท้าย

    if (top2.length !== 2 || bot2.length !== 2) {
      return res.status(500).json({
        ok: false,
        message: "ดึงเลข 2 ตัวบน/ล่างไม่ได้จากแถวที่เลือก",
        debug: { roundId, time, prize1, front3, back3, last2raw },
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      source: "cuthal.loxinmysy.com",
      roundId,
      time,
      top2,
      bot2,
      meta: {
        prize1,
        front3,
        back3,
        last2: last2raw,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Proxy error: " + (err?.message || String(err)),
    });
  }
}
