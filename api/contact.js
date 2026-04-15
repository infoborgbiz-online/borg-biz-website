export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { naam, email, dienst, bericht } = req.body;

    if (!naam || !email) return res.status(400).json({ error: 'Naam en email zijn verplicht' });

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres' });

    const ODOO_URL      = process.env.ODOO_URL;
    const ODOO_DB       = process.env.ODOO_DB;
    const ODOO_USERNAME = process.env.ODOO_USERNAME;
    const ODOO_API_KEY  = process.env.ODOO_API_KEY;

    // Controleer of alle variabelen aanwezig zijn
    if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
        console.error('Ontbrekende omgevingsvariabelen:', {
            ODOO_URL: !!ODOO_URL,
            ODOO_DB: !!ODOO_DB,
            ODOO_USERNAME: !!ODOO_USERNAME,
            ODOO_API_KEY: !!ODOO_API_KEY
        });
        return res.status(500).json({ error: 'Serverconfiguratie ontbreekt' });
    }

    try {
        // Stap 1: Authenticeren via XML-RPC (meest betrouwbaar voor Odoo Online)
        const authXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${ODOO_DB}</string></value></param>
    <param><value><string>${ODOO_USERNAME}</string></value></param>
    <param><value><string>${ODOO_API_KEY}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`;

        const authRes = await fetch(`${ODOO_URL}/xmlrpc/2/common`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: authXml
        });

        const authText = await authRes.text();
        console.log('Auth response volledig:', authText);

        // Controleer op false (verkeerde credentials)
        if (authText.includes('<boolean>0</boolean>') || authText.includes('<value><boolean>0')) {
            console.error('Verkeerde credentials - DB, gebruikersnaam of API key klopt niet');
            throw new Error('Verkeerde Odoo credentials');
        }

        // UID uit XML-RPC response halen
        const uidMatch = authText.match(/<int>(\d+)<\/int>/);
        if (!uidMatch) {
            console.error('Geen UID in response:', authText);
            throw new Error('Odoo authenticatie mislukt — controleer gebruikersnaam en API key');
        }

        const uid = parseInt(uidMatch[1]);
        console.log('Ingelogd als uid:', uid);

        // Stap 2: Lead aanmaken via XML-RPC
        const leadNaam       = `Website aanvraag - ${naam}`;
        const omschrijving   = `Dienst: ${dienst || 'Niet opgegeven'}\n\nBericht:\n${bericht || 'Geen bericht'}`;

        const createXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${ODOO_DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${ODOO_API_KEY}</string></value></param>
    <param><value><string>crm.lead</string></value></param>
    <param><value><string>create</string></value></param>
    <param><value><array><data>
      <value><struct>
        <member><name>name</name><value><string>${leadNaam}</string></value></member>
        <member><name>contact_name</name><value><string>${naam}</string></value></member>
        <member><name>email_from</name><value><string>${email}</string></value></member>
        <member><name>description</name><value><string>${omschrijving}</string></value></member>
        <member><name>type</name><value><string>lead</string></value></member>
        <member><name>company_id</name><value><int>3</int></value></member>
      </struct></value>
    </data></array></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`;

        const createRes = await fetch(`${ODOO_URL}/xmlrpc/2/object`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: createXml
        });

        const createText = await createRes.text();
        console.log('Create response:', createText.substring(0, 300));

        const leadIdMatch = createText.match(/<int>(\d+)<\/int>/);
        if (!leadIdMatch) {
            console.error('Lead aanmaken mislukt:', createText);
            throw new Error('Lead aanmaken mislukt');
        }

        console.log('Lead aangemaakt met ID:', leadIdMatch[1]);
        return res.status(200).json({ success: true, lead_id: parseInt(leadIdMatch[1]) });

    } catch (error) {
        console.error('Contact API fout:', error.message);
        return res.status(500).json({ error: 'Er is een fout opgetreden. Probeer het later opnieuw.' });
    }
}
