// api/ku-proxy.js
// Proxy ดึงผล "หวยไทย 1 นาที" แล้วแปลงเป็น JSON ให้ Auto Mode ใช้

const TARGET_URL =
  "https://cuthal.loxinmysy.com/share/aspx/LotteryResults.aspx?game=226";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function cleanCell(html) {
  return html
    .replace(/<[^>]+>/g, "")   // ตัดแท็ก HTML
    .replace(/&nbsp;/g, " ")
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

    // หาแถวแรกสุดของตาราง (ข้ามหัวตาราง)
    const rowMatch = html.match(
      /<tr[^>]*>\s*<td[^>]*>\s*\d+\s*<\/td>[\s\S]*?<\/tr>/i
    );
    if (!rowMatch) {
      return res.status(500).json({
        ok: false,
        message: "ไม่พบแถวผลหวยใน HTML",
      });
    }

    const rowHtml = rowMatch[0];

    // ดึง <td> 6 ช่อง: งวดที่, เวลา, รางวัลที่1, หน้า3ตัว, ท้าย3ตัว, 2ตัว
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let m;
    while ((m = tdRegex.exec(rowHtml)) && cells.length < 6) {
      cells.push(cleanCell(m[1]));
    }

    if (cells.length < 6) {
      return res.status(500).json({
        ok: false,
        message: "จำนวนคอลัมน์ไม่ครบ 6 ช่อง",
      });
    }

    const roundId = cells[0];   // งวดที่
    const time = cells[1];      // เวลา
    const prize1 = cells[2];    // รางวัลที่ 1 (6 ตัว)
    const front3 = cells[3];    // หน้า 3 ตัว
    const back3 = cells[4];     // ท้าย 3 ตัว
    const last2raw = cells[5];  // 2 ตัว

    // เลข 2 ตัวบน = 2 ตัวท้ายของรางวัลที่ 1
    const top2 = String(prize1).replace(/\D/g, "").slice(-2);

    // เลข 2 ตัวล่าง = ช่อง 2 ตัว (คอลัมน์สุดท้าย)
    const bot2 = String(last2raw).replace(/\D/g, "").slice(-2);

    if (top2.length !== 2 || bot2.length !== 2) {
      return res.status(500).json({
        ok: false,
        message: "ไม่สามารถดึงเลข 2 ตัวบน/ล่างจาก HTML ได้",
        debug: { prize1, last2raw },
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
