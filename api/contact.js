export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { naam, email, dienst, bericht } = req.body;

    if (!naam || !email) {
        return res.status(400).json({ error: 'Naam en email zijn verplicht' });
    }

    // Simpele email validatie
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
        return res.status(400).json({ error: 'Ongeldig e-mailadres' });
    }

    const ODOO_URL      = process.env.ODOO_URL;
    const ODOO_DB       = process.env.ODOO_DB;
    const ODOO_USERNAME = process.env.ODOO_USERNAME;
    const ODOO_API_KEY  = process.env.ODOO_API_KEY;

    try {
        // Stap 1: Authenticeren bij Odoo
        const authRes = await fetch(`${ODOO_URL}/web/session/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                id: 1,
                params: {
                    db:       ODOO_DB,
                    login:    ODOO_USERNAME,
                    password: ODOO_API_KEY
                }
            })
        });

        const authData = await authRes.json();

        if (!authData.result || !authData.result.uid) {
            console.error('Odoo auth mislukt:', authData);
            throw new Error('Odoo authenticatie mislukt');
        }

        const sessionCookie = authRes.headers.get('set-cookie');

        // Stap 2: Lead aanmaken in Odoo CRM
        const leadNaam   = `Website aanvraag - ${naam}`;
        const omschrijving = `Dienst: ${dienst || 'Niet opgegeven'}\n\nBericht:\n${bericht || 'Geen bericht'}`;

        const leadRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': sessionCookie
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                id: 2,
                params: {
                    model: 'crm.lead',
                    method: 'create',
                    args: [{
                        name:         leadNaam,
                        contact_name: naam,
                        email_from:   email,
                        description:  omschrijving,
                        type:         'lead'
                    }],
                    kwargs: {}
                }
            })
        });

        const leadData = await leadRes.json();

        if (leadData.error) {
            console.error('Odoo lead error:', leadData.error);
            throw new Error(leadData.error.data?.message || 'Lead aanmaken mislukt');
        }

        return res.status(200).json({ success: true, lead_id: leadData.result });

    } catch (error) {
        console.error('Contact API fout:', error.message);
        return res.status(500).json({ error: 'Er is een fout opgetreden. Probeer het later opnieuw.' });
    }
}
