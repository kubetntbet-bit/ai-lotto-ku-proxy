export default async function handler(req, res) {
  try {
    const KU_URL = "https://cuthal.loxinmysy.com/share/aspx/LotteryResults.aspx?game=226";

    const resp = await fetch(KU_URL, { cache: "no-store" });
    if (!resp.ok) {
      return res.status(500).json({ error: "fetch_failed", status: resp.status });
    }

    const text = await resp.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    return res.status(200).send(text);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
