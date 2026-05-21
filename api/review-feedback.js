const nodemailer = require('nodemailer');

const CLIENTS = {
    'diamond-kapsalon': {
        naam: 'Diamond Kapsalon',
        email: 'PLACEHOLDER_EMAIL_MAHMUD'
    },
    'borg-biz': {
        naam: 'Borg Biz',
        email: 'info@borgbiz.nl'
    }
};

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { client_id, klant_naam, bericht } = req.body;

    const client = CLIENTS[client_id];
    if (!client) return res.status(400).json({ error: 'Onbekende klant' });

    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_USER || !SMTP_PASS) {
        return res.status(500).json({ error: 'Mail niet geconfigureerd' });
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    const datum = new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' });

    await transporter.sendMail({
        from: `"Borg Biz Reviews" <${SMTP_USER}>`,
        to: client.email,
        subject: `Feedback van klant - ${client.naam}`,
        html: `
            <div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:2rem;">
                <h2 style="color:#1E293B;margin-bottom:0.5rem;">Nieuwe klantfeedback</h2>
                <p style="color:#64748B;font-size:0.9rem;margin-bottom:1.5rem;">${datum}</p>
                <table style="width:100%;border-collapse:collapse;font-size:0.92rem;">
                    <tr>
                        <td style="padding:0.6rem 0;color:#64748B;width:120px;">Klant</td>
                        <td style="padding:0.6rem 0;color:#1E293B;font-weight:600;">${klant_naam}</td>
                    </tr>
                    <tr>
                        <td style="padding:0.6rem 0;color:#64748B;">Bedrijf</td>
                        <td style="padding:0.6rem 0;color:#1E293B;">${client.naam}</td>
                    </tr>
                </table>
                <div style="margin-top:1.5rem;background:#F8FAFC;border-left:4px solid #E2E8F0;padding:1rem 1.25rem;border-radius:0 8px 8px 0;">
                    <p style="color:#64748B;font-size:0.8rem;margin-bottom:0.4rem;font-weight:600;">FEEDBACK</p>
                    <p style="color:#1E293B;line-height:1.6;">${bericht}</p>
                </div>
                <p style="margin-top:1.5rem;font-size:0.78rem;color:#94A3B8;">Verstuurd via het review systeem van Borg Biz</p>
            </div>
        `
    });

    return res.status(200).json({ success: true });
};
