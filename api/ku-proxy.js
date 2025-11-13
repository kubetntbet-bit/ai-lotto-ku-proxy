// api/ku-proxy.js
// Proxy ดึงผล "หวยไทย 1 นาที" แล้วแปลงเป็น JSON ให้ Auto Mode ใช้

const TARGET_URL =
  "https://cuthal.loxinmysy.com/share/aspx/LotteryResults.aspx?game=226";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function cleanCell(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function handler(req, res) {
  try {
    const upstream = await fetch(TARGET_URL, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        message: "Upstream error: " + upstream.status,
      });
    }

    const html = await upstream.text();

    // 1) พยายามตัดเอาเฉพาะ table ที่เป็น "หวยไทย - 1 นาที"
    let workHtml = html;
    const tblMatch = html.match(
      /หวยไทย\s*-\s*1\s*นาที[\s\S]*?(<table[\s\S]*?<\/table>)/i
    );
    if (tblMatch) {
      workHtml = tblMatch[1];
    }

    // 2) ดึงทุกแถวใน table
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let m;
    while ((m = trRegex.exec(workHtml))) {
      rows.push(m[0]);
    }

    let picked = null;
    let pickedRawRow = null;

    // 3) วนหาแถวแรกที่เป็น "ข้อมูลผลหวย"
    for (const rowHtml of rows) {
      // เซลล์อาจเป็น <td> หรือ <th> ทั้งคู่เลยใช้ t[dh]
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cellsHtml = [];
      let cm;
      while ((cm = cellRegex.exec(rowHtml))) {
        cellsHtml.push(cm[1]);
      }
      if (cellsHtml.length < 6) continue; // ต้องมีอย่างน้อย 6 ช่อง

      const cells = cellsHtml.map(cleanCell);

      // cells[2] (รางวัลที่ 1) ควรมีเลขอย่างน้อย 6 หลักติดกัน
      const prize1Digits = (cells[2] || "").replace(/\D/g, "");
      if (prize1Digits.length < 6) continue;

      // cells[5] (2 ตัว) ควรมีเลขอย่างน้อย 2 หลัก
      const last2Digits = (cells[5] || "").replace(/\D/g, "");
      if (last2Digits.length < 2) continue;

      picked = cells;
      pickedRawRow = rowHtml;
      break;
    }

    if (!picked) {
      return res.status(500).json({
        ok: false,
        message: "ไม่พบแถวผลหวยใน HTML (โครงสร้างตารางเปลี่ยน)",
      });
    }

    const [roundId, time, prize1, front3, back3, last2raw] = picked;

    const prize1Digits = String(prize1).replace(/\D/g, "");
    const top2 = prize1Digits.slice(-2);
    const bot2 = String(last2raw).replace(/\D/g, "").slice(-2);

    if (top2.length !== 2 || bot2.length !== 2) {
      return res.status(500).json({
        ok: false,
        message: "ดึงเลข 2 ตัวบน/ล่างไม่ได้จากแถวที่เลือก",
        debug: {
          roundId,
          time,
          prize1,
          front3,
          back3,
          last2raw,
          rawRowSnippet: pickedRawRow.slice(0, 300),
        },
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
