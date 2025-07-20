import express from 'express';
import { Request, Response } from 'express';
import { ContactService } from './services/contactService';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); // to parse JSON bodies

const contactService = new ContactService();

// quick health check route
app.get('/health', (req: Request, res: Response) => {
    res.status(200).send('Hello Doc! FluxKart Identity Service is healthy and ready to reconcile!');
});

// core endpoint to identify contact using email/phone
app.post('/identify', async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;

    // validate input types (allow null but not wrong types)
    if (typeof email !== 'string' && typeof phoneNumber !== 'string' && email !== null && phoneNumber !== null) {
        return res.status(400).json({ error: "Invalid input. 'email' and 'phoneNumber' must be strings or null." });
    }

    // need at least one identifier
    if (!email && !phoneNumber) {
        return res.status(400).json({ error: "Please provide either an email or a phone number for identification." });
    }

    try {
        const result = await contactService.identify({ email, phoneNumber });
        res.status(200).json(result);
    } catch (error: any) {
        console.error("Error during contact identification:", error); // logs for debugging
        res.status(500).json({ error: error.message || "An unexpected error occurred while identifying the contact." });
    }
});

// start the server
app.listen(port, () => {
    console.log(`Identity service running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`POST to identify: http://localhost:${port}/identify`);
});
